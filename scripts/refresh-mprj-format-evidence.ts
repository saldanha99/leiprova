/**
 * Renovação diária da evidência de formato do MPRJ (20/41), sem entrada manual.
 * Roda pelo timer leiprova-mprj-format-refresh (deploy/mprj-format-refresh.sh), no serviço opportunity-approver.
 *
 * Mesmo procedimento de docs/CONTRATO-FORMATO-MPRJ.md (preview e apply com --refresh, fonte oficial atual),
 * com a entrada derivada do contrato aprovado no banco em vez de um arquivo privado. Falha (código 1) sem
 * aplicar nada quando:
 * - não há exatamente 1 contrato aprovado do MPRJ, ou ele não confere com a própria impressão;
 * - a prévia não preserva o contrato original (fonte, hash da página, parser ou fatos de formato mudaram);
 * - a aplicação não confirma o mesmo contrato, a evidência nova não vale por mais 24 h ou o produto fica sem questões.
 * Aprovação: owner_standing_authorization (OK do Vinícius de 21/11/2026 para o timer diário). Sem IA.
 */
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../src/lib/db/schema";
import { approvedProductQuestionExists } from "../src/lib/commerce/product-binding-query";
import { requireStandingCourseMaintenanceDatabaseUrl } from "../src/lib/editorial/official-course-admission";
import { OFFICIAL_COURSE_STANDING_REFERENCE } from "../src/lib/editorial/official-course-dossier";
import { officialQuestionContractSchema, questionContractFingerprint } from "../src/lib/editorial/official-question-contract";
import { reviewOfficialQuestionContract } from "../src/lib/editorial/official-question-contract-review";

const PRODUCT_SLUG = "mpe-rj-promotor-de-justica-2026";
const MIN_REMAINING_MS = 24 * 60 * 60 * 1000;

class RefreshError extends Error {}
const fail = (message: string): never => { throw new RefreshError(message); };

async function main() {
  const client = postgres(requireStandingCourseMaintenanceDatabaseUrl(process.env.MIGRATION_DATABASE_URL),
    { max: 1, prepare: false, connect_timeout: 5, idle_timeout: 10 });
  const db = drizzle(client, { schema });
  try {
    const [identity] = await client`select current_database() as name, current_user as username`;
    if (identity?.name !== "leiprova" || identity.username !== "leiprova_owner") fail("Banco ou papel fora do escopo.");

    const contracts = await client<{ id: string; payload: unknown; actor: string; role: string }[]>`
      select c.id, c.payload, u.public_id::text as actor, u.role
      from opportunity_question_contracts c join users u on u.id = c.reviewed_by_user_id
      where c.opportunity_id = 20 and c.exam_edition_id = 41 and c.stage_key = 'objective' and c.status = 'approved'`;
    if (contracts.length !== 1) fail(`Esperado 1 contrato aprovado do MPRJ; há ${contracts.length}.`);
    const [row] = contracts;
    const current = officialQuestionContractSchema.parse(row.payload);
    if (questionContractFingerprint(current) !== row.id) fail("Contrato aprovado não confere com a própria impressão.");
    if (!current.formatEvidence) fail("Contrato aprovado sem evidência de formato.");
    if (row.role !== "admin") fail("Revisor do contrato não é administrador.");
    const { formatEvidence: previousEvidence, ...base } = current;

    const request = {
      input: { contract: base }, actorPublicId: row.actor, approvalReference: OFFICIAL_COURSE_STANDING_REFERENCE,
      refreshMprjEvidence: true,
    };
    const preview = await reviewOfficialQuestionContract(db, { ...request, mode: "preview" });
    if (preview.contractId !== row.id || preview.refreshRequired) {
      fail("Prévia não preserva o contrato original: fonte, página, parser ou fatos de formato mudaram. Nada aplicado.");
    }
    const applied = await reviewOfficialQuestionContract(db, { ...request, mode: "apply", expectedFingerprint: preview.fingerprint });
    if (applied.contractId !== row.id) fail("Aplicação não confirmou o contrato original.");

    const [evidence] = await client<{ id: string; expires_at: Date; verification_date: string }[]>`
      select id, expires_at, verification_date::text from official_question_format_evidence
      where opportunity_id = 20 and status = 'approved' order by expires_at desc limit 1`;
    if (!evidence || evidence.expires_at.getTime() - Date.now() < MIN_REMAINING_MS) fail("Evidência aprovada não vale por mais 24 h.");

    const [eligible] = await db.execute<{ count: number }>(sql`
      select count(distinct binding.question_id)::int as count from contest_product_question_bindings binding
      where binding.product_slug = ${PRODUCT_SLUG}
        and ${approvedProductQuestionExists(sql`binding.product_slug`, sql`binding.question_id`)}`);
    if (!eligible || eligible.count <= 0) fail("Produto MPRJ sem questões válidas depois da renovação.");

    console.log(JSON.stringify({
      ok: true, contractId: row.id, previousEvidenceId: previousEvidence?.evidenceId ?? null, evidenceId: evidence.id,
      verificationDate: evidence.verification_date, expiresAt: evidence.expires_at.toISOString(),
      validQuestions: eligible.count, product: PRODUCT_SLUG,
    }));
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  // Mensagens do operador são fixas e sem conteúdo da fonte; erro de rede/banco sai só com o tipo.
  const detail = error instanceof RefreshError || (error instanceof Error && /[ãçéóí]/u.test(error.message))
    ? error.message : error instanceof Error ? error.name : "erro";
  console.error(`Renovação MPRJ não aplicada: ${detail}`);
  process.exitCode = 1;
});
