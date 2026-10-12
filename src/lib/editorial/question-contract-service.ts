import { sql } from "drizzle-orm";
import type { ApprovalExecutor } from "./approval-lock";
import { officialQuestionContractSchema, questionContractFingerprint } from "./official-question-contract";
import { currentQuestionContractExists, questionContractContentHash, questionOptionsMatchContract } from "./question-contract-query";

type Executor = Pick<ApprovalExecutor, "execute">;
export async function readQuestionContractById(db: Executor, contractId: string | null | undefined) {
  if (!contractId || !/^[a-f0-9]{64}$/u.test(contractId)) return null;
  const [row]=await db.execute<{opportunityId:number}>(sql`select opportunity_id::int as "opportunityId" from opportunity_question_contracts where id=${contractId}`);
  return row ? readOfficialQuestionContract(db,row.opportunityId,contractId) : null;
}
export async function readOfficialQuestionContract(db: Executor, opportunityId: number, contractId?: string) {
  const rows = await db.execute<{ id: string; payload: unknown }>(sql`
    select qc.id,qc.payload from opportunity_question_contracts qc
    where qc.opportunity_id=${opportunityId} ${contractId ? sql`and qc.id=${contractId}` : sql``}
      and ${currentQuestionContractExists(sql`qc.id`, sql`qc.opportunity_id`)} limit 2
  `);
  if (rows.length !== 1) return null;
  const parsed = officialQuestionContractSchema.safeParse(rows[0].payload);
  if (!parsed.success || questionContractFingerprint(parsed.data) !== rows[0].id) return null;
  return { id: rows[0].id, contract: parsed.data };
}

export async function lockQuestionContracts(db: Executor, contractIds: readonly string[]) {
  const ids = [...new Set(contractIds)].sort();
  if (ids.length > 250 || ids.some(id => !/^[a-f0-9]{64}$/u.test(id))) throw new Error("Escopo de contratos inválido.");
  if (!ids.length) return;
  await db.execute(sql`select public.lock_question_contract_context(array[${sql.join(ids.map(id => sql`${id}`), sql`,`)}]::text[])`);
}

/** Certificar formato não aprova vínculo, questão ou programa. Só cria evidência adicional. */
export async function certifyProductBindingContracts(db: Executor, bindingIds: readonly string[], actorId: number, reference: string) {
  if (!bindingIds.length || bindingIds.length > 250 || bindingIds.some(id => !/^[a-f0-9]{64}$/u.test(id)) ||
    !Number.isSafeInteger(actorId) || actorId < 1 || reference.length < 10 || reference.length > 250) throw new Error("Escopo de certificação inválido.");
  const ids = sql`array[${sql.join(bindingIds.map(id => sql`${id}`), sql`,`)}]::text[]`;
  const candidates = await db.execute<{ id: string; contractId: string; contentHash: string }>(sql`
    select b.id,c.id as "contractId",${questionContractContentHash(sql`q.id`)} as "contentHash"
    from contest_product_question_bindings b join questions q on q.id=b.question_id
    join opportunity_question_contracts c on c.opportunity_id=b.opportunity_id
    where b.id=any(${ids}) and ${currentQuestionContractExists(sql`c.id`, sql`b.opportunity_id`)}
      and ${questionOptionsMatchContract(sql`q.id`, sql`q.type`, sql`c.id`)}
      and q.source_rights='original_authorial' and q.quiz_mode in ('dry_law','original_style')
      and (q.quiz_mode='dry_law' or q.style_bank_id=c.bank_id)
      and (q.question_contract_id is null or q.question_contract_id=c.id)
  `);
  if (candidates.length !== bindingIds.length) throw new Error("Há vínculo sem contrato oficial exato ou com formato incompatível; nenhuma certificação será criada.");
  await lockQuestionContracts(db, candidates.map(row => row.contractId));
  for (const row of candidates) {
    const existing = await db.execute<{ contractId: string; contentHash: string; status: string }>(sql`
      select contract_id as "contractId",question_content_hash as "contentHash",status from question_contract_certifications where binding_id=${row.id}
    `);
    if (existing.length) {
      if (existing[0].contractId !== row.contractId || existing[0].contentHash !== row.contentHash || existing[0].status !== "approved") {
        throw new Error("Certificação existente divergente ou suspensa; preserve a decisão e revise novamente.");
      }
      continue;
    }
    const inserted = await db.execute<{ bindingId: string }>(sql`
      insert into question_contract_certifications(binding_id,contract_id,question_content_hash,status,approval_reference,human_review,reviewed_by_user_id,reviewed_at)
      select b.id,c.id,${questionContractContentHash(sql`q.id`)},'approved',${reference},false,${actorId},clock_timestamp()
      from contest_product_question_bindings b join questions q on q.id=b.question_id
      join opportunity_question_contracts c on c.id=${row.contractId} and c.opportunity_id=b.opportunity_id
      where b.id=${row.id} and ${currentQuestionContractExists(sql`c.id`, sql`b.opportunity_id`)}
        and ${questionOptionsMatchContract(sql`q.id`, sql`q.type`, sql`c.id`)}
        and ${questionContractContentHash(sql`q.id`)}=${row.contentHash}
      on conflict(binding_id) do nothing returning binding_id as "bindingId"
    `);
    if (inserted.length !== 1) throw new Error("Questão ou contrato mudou durante a certificação.");
    await db.execute(sql`insert into audit_logs(actor_user_id,action,entity_type,entity_id,metadata)
      values(${actorId},'editorial.product_binding.question_contract.certified','contest_product_question_binding',${row.id},
        ${JSON.stringify({ contractId: row.contractId, questionContentHash: row.contentHash, approvalReference: reference,
          approvalBasis: "owner_standing_authorization", humanReview: false, publicationAllowed: false })}::jsonb)`);
  }
  return candidates;
}
