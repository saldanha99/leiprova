import { randomUUID, createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "@/lib/db/schema";
import { findMostSimilarQuestion, ORIGINALITY_REJECTION_THRESHOLD_BPS } from "./originality";
import { deterministicNoticeQuestionUuid } from "./notice-question-generator";
import { readOfficialQuestionContract, lockQuestionContracts } from "./question-contract-service";
import { currentQuestionContractExists } from "./question-contract-query";
import { approvedProductQuestionCount, MINIMUM_COURSE_QUESTION_COUNT } from "@/lib/commerce/minimum-course-content";
import { AGENT_FOR_WORK, AGENT_WORK_DAILY_LIMIT, AGENT_WORK_LEASE_MINUTES,
  agentInputHash, agentWorkKindSchema, validateAgentWorkResult, workPayloadSchema,
  agentWorkResultSchema,
  type AgentWorkKind, type AgentWorkPayload } from "./agent-work-contract";

// O requisito sai da chave ("mapping:<id>", "author:<id>"): ler o payload, com os
// artigos candidatos, custava segundos por reserva.
const requirementIdOf = (alias: "work" | "other") =>
  `case when ${alias}.job_key ~ '^(mapping|author):[0-9]{1,18}$' then split_part(${alias}.job_key, ':', 2)::bigint end`;

/** Faixa por edição, calculada uma vez por reserva: o alvo é conteúdo válido
 * por produto, não rascunhos ligados à edição. Um curso com 68 rascunhos mas
 * somente 67 vínculos válidos continua prioritário até completar o piso. */
export const AGENT_OPPORTUNITY_PRIORITY_CTES = sql`product_content as materialized (
      select priority_product.opportunity_id, priority_product.status,
        ${approvedProductQuestionCount(sql`priority_product.slug`, sql`priority_product.opportunity_id`)} as valid_question_count
      from contest_store_products priority_product
      where priority_product.opportunity_id is not null and priority_product.status <> 'retired'
    ),
    opportunity_content as materialized (
      select opportunity_id,
        bool_or(status = 'released') as has_released_product,
        bool_or(status = 'draft') as has_draft_product,
        min(valid_question_count) as minimum_valid_question_count
      from product_content group by opportunity_id
    ),
    opportunity_tier as materialized (
      select opportunity.id,
        case
          when coalesce(content.has_released_product, false)
            and not coalesce(content.has_draft_product, false) then 2
          when opportunity.exam_date < (now() at time zone 'America/Sao_Paulo')::date + 14
            or coalesce(content.minimum_valid_question_count, 0) >= ${MINIMUM_COURSE_QUESTION_COUNT} then 1
          else 0 end as tier,
        case when opportunity.exam_date >= (now() at time zone 'America/Sao_Paulo')::date
          then opportunity.exam_date end as upcoming_exam
      from contest_opportunities opportunity
      left join opportunity_content content on content.opportunity_id = opportunity.id
    )`;
// Somente o despacho de mapeamentos precisa desta fotografia. O predicado
// completo é materializado por oportunidade, nunca por requisito da fila.
const MAPPING_CONTRACT_READINESS_CTE = sql`mapping_contract_readiness as materialized (
      select mapping_opportunity.id, exists (
        select 1 from opportunity_question_contracts mapping_contract
        where mapping_contract.opportunity_id = mapping_opportunity.id
          and ${currentQuestionContractExists(sql`mapping_contract.id`, sql`mapping_opportunity.id`)}
      ) as has_current_contract
      from contest_opportunities mapping_opportunity
    )`;
/** Nos mapeamentos, contrato vigente
 * e matéria conhecida precedem a faixa de produto: um mapa sem contrato não
 * pode abastecer autoria, mesmo em uma edição com prova próxima. Depois, faixa
 * 0 primeiro e prova
 * mais próxima (passada ou sem data no fim) e matéria conhecida no mesmo edital.
 * A prioridade ordena as tarefas elegíveis do próprio agente, sem deixar
 * um agente ocioso por pendências de outro. Tarefa sem edital não tem faixa e
 * segue a ordem de chegada. */
const CLAIM_FROM = sql.raw(`from editorial_agent_work work
    left join opportunity_requirements requirement on requirement.id = ${requirementIdOf("work")}
    left join opportunity_tier tier on tier.id = requirement.opportunity_id`);
const PRODUCT_DEADLINE_ORDER = sql.raw(`tier.tier nulls first, tier.upcoming_exam nulls last,
          (requirement.subject_id is null) nulls last`);

export type AgentDatabase = PostgresJsDatabase<typeof schema>;
export type AgentWork = {
  jobKey: string; kind: AgentWorkKind; inputHash: string; payload: AgentWorkPayload;
  leaseToken: string; leaseExpiresAt: string;
};

export async function enqueueAgentWork(db: AgentDatabase, key: string, kind: AgentWorkKind, input: AgentWorkPayload) {
  if (!/^[a-z0-9:._-]{1,220}$/.test(key)) throw new Error("Identidade de tarefa inválida.");
  const payload = workPayloadSchema.parse(input);
  const hash = agentInputHash(payload);
  if (Buffer.byteLength(JSON.stringify(payload)) > 480_000) throw new Error("Pacote excede limite seguro.");
  const rows = await db.execute(sql`
    insert into editorial_agent_work (job_key,kind,input_hash,payload)
    values (${key},${kind},${hash},${JSON.stringify(payload)}::jsonb)
    on conflict (job_key) do update set input_hash=excluded.input_hash,payload=excluded.payload,
      status='pending',attempts=0,lease_token=null,lease_expires_at=null,result=null,
      last_error_code=null,updated_at=now()
    where editorial_agent_work.input_hash <> excluded.input_hash
      and editorial_agent_work.status <> 'running'
    returning job_key
  `);
  return rows.length > 0;
}

/** Serializa só a reserva, não a execução. Todas as tentativas são auditadas. */
export async function claimAgentWork(db: AgentDatabase, now = new Date(), agent?:string) {
  if(agent && !Object.values(AGENT_FOR_WORK).includes(agent)) throw new Error("Agente inválido.");
  const kinds=Object.entries(AGENT_FOR_WORK).filter(([,name])=>!agent||name===agent).map(([kind])=>kind);
  const prioritizesMappings = kinds.includes('legal_mapping');
  const mappingReadiness = prioritizesMappings ? sql`, ${MAPPING_CONTRACT_READINESS_CTE}` : sql``;
  const mappingJoin = prioritizesMappings ? sql`left join mapping_contract_readiness mapping_readiness
    on mapping_readiness.id = requirement.opportunity_id` : sql``;
  const productOrder = prioritizesMappings ? sql`case when work.kind='legal_mapping' and coalesce(mapping_readiness.has_current_contract, false)
            and requirement.subject_id is not null then 0 else 1 end,
          tier.tier nulls first,
          tier.upcoming_exam nulls last, (requirement.subject_id is null) nulls last` : PRODUCT_DEADLINE_ORDER;
  return db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(621743,37)`);
    await tx.execute(sql`
      update editorial_agent_work set status=case when attempts>=3 then 'failed' else 'pending' end,
        lease_token=null,lease_expires_at=null,last_error_code='lease_expired',updated_at=${now.toISOString()}::timestamptz
      where status='running' and lease_expires_at <= ${now.toISOString()}::timestamptz
    `);
    const leaseToken = randomUUID();
    const expires = new Date(now.getTime()+AGENT_WORK_LEASE_MINUTES*60000).toISOString();
    const [job] = await tx.execute<AgentWork>(sql`
      update editorial_agent_work set status='running',attempts=attempts+1,
        lease_token=${leaseToken}::uuid,lease_expires_at=${expires}::timestamptz,
        updated_at=${now.toISOString()}::timestamptz
      where job_key=(with ${AGENT_OPPORTUNITY_PRIORITY_CTES}${mappingReadiness}
        select work.job_key ${CLAIM_FROM} ${mappingJoin}
        where work.status='pending' and work.attempts<3
        and (work.kind<>'authoring' or ${currentQuestionContractExists(sql`work.payload->>'questionContractId'`,sql`requirement.opportunity_id`)})
        and work.kind in (${sql.join(kinds.map(kind=>sql`${kind}`),sql`,`)})
        order by case work.kind when 'legal_change' then 0 when 'authoring' then 1 when 'discovery' then 2 else 3 end,
          ${productOrder},
          work.created_at,work.job_key for update of work skip locked limit 1)
      returning job_key as "jobKey",kind,input_hash as "inputHash",payload,
        lease_token::text as "leaseToken",lease_expires_at::text as "leaseExpiresAt"
    `);
    if (!job) return { state: "idle" as const };
    workPayloadSchema.parse(job.payload); agentWorkKindSchema.parse(job.kind);
    await tx.execute(sql`insert into editorial_agent_runs(lease_token,job_key,started_at)
      values(${leaseToken}::uuid,${job.jobKey},${now.toISOString()}::timestamptz)`);
    return { state: "claimed" as const, agent: AGENT_FOR_WORK[job.kind], job };
  });
}

/** Shared exact expression: batched preparation and locked completion agree. */
export const REQUIREMENT_CONTEXT_HASH_SQL = sql`encode(sha256(convert_to(jsonb_build_array(to_jsonb(r),to_jsonb(o),
      d.status,d.source_url,d.checksum_sha256,s.status,s.checksum_sha256,
      (select jsonb_agg(to_jsonb(oa) order by oa.id) from opportunity_organizer_assignments oa
        where oa.opportunity_id=o.id))::text,'UTF8')),'hex')`;

/** Hash do contexto impede aceitar respostas depois de retificação/revogação. */
export async function requirementContext(db: AgentDatabase, id: number, lock=false) {
  const [row] = await db.execute<{ hash: string }>(sql`
    select ${REQUIREMENT_CONTEXT_HASH_SQL} hash
    from opportunity_requirements r join contest_opportunities o on o.id=r.opportunity_id
    join opportunity_source_documents d on d.id=r.source_document_id
    join opportunity_document_snapshots s on s.id=r.source_snapshot_id
    where r.id=${id} and r.editorial_status <> 'suspended' and o.editorial_status='reviewed'
      and d.status='approved' and s.status='approved'
    ${lock ? sql`for share of r,o,d,s` : sql``}
  `);
  return row?.hash ?? null;
}

export async function completeAgentWork(db: AgentDatabase,
  request: { jobKey: string; inputHash: string; leaseToken: string; result: unknown }, now = new Date()) {
  const digest=(value:string)=>createHash("sha256").update(value).digest("hex");
  const completionTokenHash=digest(request.leaseToken);
  const resultHash=digest(JSON.stringify(agentWorkResultSchema.parse(request.result)));
  return db.transaction(async tx => {
    const [job] = await tx.execute<AgentWork>(sql`
      select job_key as "jobKey",kind,input_hash as "inputHash",payload,lease_token::text as "leaseToken",
        lease_expires_at::text as "leaseExpiresAt" from editorial_agent_work
      where job_key=${request.jobKey} and status='running' and input_hash=${request.inputHash}
        and lease_token=${request.leaseToken}::uuid and lease_expires_at>${now.toISOString()}::timestamptz for update
    `);
    if (!job) {
      // Uma resposta de rede perdida pode ser repetida sem criar outro lote.
      const [receipt]=await tx.execute<{outcome:string;ids:string[]}>(sql`
        select a.metadata->>'outcome' outcome,a.metadata->'importedQuestionPublicIds' ids from audit_logs a
        join editorial_agent_work w on w.job_key=a.entity_id
        where a.action='automation.agent.prepared' and a.entity_id=${request.jobKey}
          and a.metadata->>'inputHash'=${request.inputHash} and w.input_hash=${request.inputHash}
          and w.status in ('prepared','blocked') and a.metadata->>'completionTokenHash'=${completionTokenHash}
          and a.metadata->>'resultHash'=${resultHash} order by a.id desc limit 1
      `);
      if(receipt) return {state:receipt.outcome,importedQuestionPublicIds:receipt.ids,publicationAllowed:false,humanReviewRequired:true,replayed:true};
      throw new Error("Reserva vencida ou contexto substituído; resposta não aplicada.");
    }
    const payload = workPayloadSchema.parse(job.payload);
    const result = validateAgentWorkResult(job.kind,payload,request.result);
    if (job.kind === 'authoring' && result.outcome === 'prepared' && payload.questionContractId) {
      // Contrato/oportunidade precedem requisito e fontes, como na aprovação.
      await lockQuestionContracts(tx,[payload.questionContractId]);
    }
    await tx.execute(sql`select public.lock_editorial_agent_context(${payload.requirementId??null}::bigint,
      ${`{${payload.articles.map(article=>article.id).join(',')}}`}::bigint[])`);
    let current = true;
    if (payload.requirementId) {
      current = await requirementContext(tx as unknown as AgentDatabase,payload.requirementId,true) === payload.context.sourceContextHash;
    }
    if (job.kind === 'authoring' && result.outcome === 'prepared') {
      if (!payload.questionContractId || !payload.opportunityId) current = false;
      else {
        const scoped=await readOfficialQuestionContract(tx,payload.opportunityId,payload.questionContractId);
        if (!scoped) current=false;
        else {
          const [bank]=await tx.execute<{id:number}>(sql`select id::int id from quiz_banks where slug=${payload.bank??''} and is_active`);
          if (!bank || scoped.contract.bankId!==bank.id) current=false;
        }
      }
    }
    for (const article of payload.articles) {
      const [live] = await tx.execute(sql`
        select a.id from legal_articles a join legal_versions v on v.id=a.legal_version_id
        join legal_acts l on l.id=v.legal_act_id
        where a.id=${article.id} and v.id=${article.versionId} and v.checksum_sha256=${article.checksum}
          and a.literal_text=${article.text} and a.editorial_status='reviewed' and a.source_rights='official_text'
          and v.status='current' and l.is_active and (v.valid_from is null or v.valid_from<=current_date)
          and (v.valid_until is null or v.valid_until>=current_date)
      `);
      if (!live) current=false;
    }
    if (payload.parentKey) {
      const [parent] = await tx.execute(sql`select job_key from editorial_agent_work
        where job_key=${payload.parentKey} and input_hash=${payload.parentHash ?? ""} and status='prepared' for share`);
      if (!parent) current=false;
    }
    if (!current) {
      await tx.execute(sql`update editorial_agent_work set status='superseded',lease_token=null,
        lease_expires_at=null,last_error_code='source_context_changed',updated_at=now() where job_key=${job.jobKey}`);
      return { state: "superseded", publicationAllowed: false };
    }
    const importedQuestionPublicIds:string[]=[];
    if(job.kind==='authoring' && result.outcome==='prepared') {
      // Serializa a comparação de originalidade entre os autores automáticos.
      await tx.execute(sql`select pg_advisory_xact_lock(621743,38)`);
      const [context]=await tx.execute<{subjectId:number|null;topicId:number|null;topic:string;bankId:number}>(sql`
        select r.subject_id::int as "subjectId",r.topic_id::int as "topicId",coalesce(t.name,r.requirement_text) topic,b.id::int as "bankId"
        from opportunity_requirements r left join quiz_topics t on t.id=r.topic_id
        join quiz_banks b on b.slug=${payload.bank??""} and b.is_active where r.id=${payload.requirementId??0}
      `);
      if(!context?.subjectId || !payload.opportunityId) throw new Error("Disciplina/cargo ausente: importação não aplicada.");
      const existing=await tx.select({publicId:schema.questions.publicId,prompt:schema.questions.prompt}).from(schema.questions);
      // Conferir o lote inteiro antes de inserir: um item recusado não pode
      // deixar rascunhos parciais nem prender o Autor até o lease expirar.
      const compared=[...existing];
      for(const [index,question] of result.questions.entries()) {
        const similarity=findMostSimilarQuestion(question.prompt,compared);
        if(similarity.scoreBps>=ORIGINALITY_REJECTION_THRESHOLD_BPS) {
          const blocked=agentWorkResultSchema.parse({...result,outcome:'blocked',
            summary:'Lote bloqueado pelo controle de originalidade; nenhuma questão importada.',
            limitations:[...result.limitations.slice(0,18),
              'Enunciado próximo do acervo ou repetido no próprio lote. Exige nova proposta original.',
              'A resposta original permanece no arquivo local; este recibo não aprova conteúdo.'],
            questions:[],mappings:[],discoveries:[]});
          await tx.execute(sql`update editorial_agent_work set status='blocked',result=${JSON.stringify(blocked)}::jsonb,
            lease_token=null,lease_expires_at=null,last_error_code='originality_rejected',updated_at=now()
            where job_key=${job.jobKey}`);
          await tx.insert(schema.auditLogs).values({action:'automation.agent.prepared',entityType:'editorial_agent_work',
            entityId:job.jobKey,metadata:{kind:job.kind,inputHash:job.inputHash,outcome:'blocked',
              questions:0,mappings:0,discoveries:0,submittedQuestions:result.questions.length,
              rejectionReason:'originality_rejected',rejectedQuestionIndex:index,
              similarityMaxBps:similarity.scoreBps,similarityReferencePublicId:similarity.referencePublicId,
              publicationAllowed:false,humanReviewRequired:true,importedQuestionPublicIds:[],
              completionTokenHash,resultHash}});
          return {state:'blocked',importedQuestionPublicIds:[],publicationAllowed:false,humanReviewRequired:true};
        }
        compared.push({publicId:deterministicNoticeQuestionUuid(`${job.jobKey}:${job.inputHash}:${index}:${question.prompt}`),
          prompt:question.prompt});
      }
      for(const [index,question] of result.questions.entries()) {
        const article=payload.articles.find(item=>item.id===question.articleId)!;
        const [version]=await tx.execute<{verifiedAt:string}>(sql`select verified_at::text as "verifiedAt" from legal_versions where id=${article.versionId}`);
        const publicId=deterministicNoticeQuestionUuid(`${job.jobKey}:${job.inputHash}:${index}:${question.prompt}`);
        const similarity=findMostSimilarQuestion(question.prompt,existing);
        if(similarity.scoreBps>=ORIGINALITY_REJECTION_THRESHOLD_BPS) throw new Error("Enunciado próximo do acervo; lote não importado.");
        const [saved]=await tx.insert(schema.questions).values({publicId,
          legalArticleId:article.id,subjectId:context.subjectId,topicId:context.topicId,
          quizMode:'original_style',styleBankId:context.bankId,questionContractId:payload.questionContractId,
          type:payload.questionContract!.format,
          prompt:question.prompt,explanation:question.explanation,learningObjective:String(payload.context.requirement??payload.title),
          topic:context.topic.slice(0,2000),difficulty:{easy:1,medium:3,hard:5}[question.difficulty],
          examBoardStyle:payload.bank,editorialStatus:'draft',sourceRights:'original_authorial',
          sourceTitle:`${article.act} — ${article.articleRef}`,sourceUrl:article.url,
          authorshipMethod:'ai_assisted',generatorModel:result.generatorModel,promptVersion:payload.version,
          createdByUserId:null,cleanRoomAttestedAt:null,submittedAt:null,verifiedAt:new Date(version.verifiedAt),
          originalityCheckedAt:now,similarityMaxBps:similarity.scoreBps,
          similarityReferencePublicId:similarity.referencePublicId,
        }).returning({id:schema.questions.id});
        await tx.insert(schema.questionOptions).values(question.options.map((option,sortOrder)=>({questionId:saved.id,
          optionKey:option.key,text:option.text,isCorrect:option.correct,rationale:option.rationale,sortOrder})));
        await tx.insert(schema.questionOpportunities).values({questionId:saved.id,opportunityId:payload.opportunityId,relationship:'direct_requirement'});
        existing.push({publicId,prompt:question.prompt});importedQuestionPublicIds.push(publicId);
      }
    }
    await tx.execute(sql`update editorial_agent_work set status=${result.outcome},result=${JSON.stringify(result)}::jsonb,
      lease_token=null,lease_expires_at=null,last_error_code=null,updated_at=now() where job_key=${job.jobKey}`);
    await tx.insert(schema.auditLogs).values({action:"automation.agent.prepared",entityType:"editorial_agent_work",
      entityId:job.jobKey,metadata:{kind:job.kind,inputHash:job.inputHash,outcome:result.outcome,
        questions:result.questions.length,mappings:result.mappings.length,discoveries:result.discoveries.length,
        publicationAllowed:false,humanReviewRequired:true,importedQuestionPublicIds,completionTokenHash,resultHash}});
    return { state: result.outcome, importedQuestionPublicIds, publicationAllowed: false, humanReviewRequired: true };
  });
}

export async function agentWorkSummary(db: AgentDatabase) {
  const counts=await db.execute<{kind:AgentWorkKind;status:string;count:number}>(sql`select kind,status,count(*)::int count from editorial_agent_work group by kind,status order by kind,status`);
  const [runs]=await db.execute<{used:number;lastRunAt:string|null}>(sql`select count(*) filter (where started_at>now()-interval '24 hours')::int used,
    max(started_at)::text "lastRunAt" from editorial_agent_runs`);
  return { counts, budget:{used:runs.used,limit:AGENT_WORK_DAILY_LIMIT},lastRunAt:runs.lastRunAt,publicationAllowed:false };
}
