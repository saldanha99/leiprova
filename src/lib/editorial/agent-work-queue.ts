import { randomUUID, createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "@/lib/db/schema";
import { findMostSimilarQuestion, ORIGINALITY_REJECTION_THRESHOLD_BPS } from "./originality";
import { deterministicNoticeQuestionUuid } from "./notice-question-generator";
import { AGENT_FOR_WORK, AGENT_WORK_DAILY_LIMIT, AGENT_WORK_LEASE_MINUTES,
  agentInputHash, agentWorkKindSchema, validateAgentWorkResult, workPayloadSchema,
  agentWorkResultSchema,
  type AgentWorkKind, type AgentWorkPayload } from "./agent-work-contract";

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
    returning job_key
  `);
  return rows.length > 0;
}

/** Serializa só a reserva, não a execução. Orçamento inclui quedas/tentativas. */
export async function claimAgentWork(db: AgentDatabase, now = new Date(), agent?:string) {
  if(agent && !Object.values(AGENT_FOR_WORK).includes(agent)) throw new Error("Agente inválido.");
  const kinds=Object.entries(AGENT_FOR_WORK).filter(([,name])=>!agent||name===agent).map(([kind])=>kind);
  return db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(621743,37)`);
    await tx.execute(sql`
      update editorial_agent_work set status=case when attempts>=3 then 'failed' else 'pending' end,
        lease_token=null,lease_expires_at=null,last_error_code='lease_expired',updated_at=${now.toISOString()}::timestamptz
      where status='running' and lease_expires_at <= ${now.toISOString()}::timestamptz
    `);
    const [budget] = await tx.execute<{ count: number }>(sql`
      select count(*)::int count from editorial_agent_runs
      where started_at >= ${new Date(now.getTime()-86400000).toISOString()}::timestamptz
    `);
    if (budget.count >= AGENT_WORK_DAILY_LIMIT) return { state: "budget_exhausted" as const };
    const leaseToken = randomUUID();
    const expires = new Date(now.getTime()+AGENT_WORK_LEASE_MINUTES*60000).toISOString();
    const [job] = await tx.execute<AgentWork>(sql`
      update editorial_agent_work set status='running',attempts=attempts+1,
        lease_token=${leaseToken}::uuid,lease_expires_at=${expires}::timestamptz,
        updated_at=${now.toISOString()}::timestamptz
      where job_key=(select job_key from editorial_agent_work where status='pending' and attempts<3
        and kind in (${sql.join(kinds.map(kind=>sql`${kind}`),sql`,`)})
        order by case kind when 'legal_change' then 0 when 'authoring' then 1 when 'discovery' then 2 else 3 end,
          created_at,job_key for update skip locked limit 1)
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

/** Hash do contexto impede aceitar respostas depois de retificação/revogação. */
export async function requirementContext(db: AgentDatabase, id: number, lock=false) {
  const [row] = await db.execute<{ hash: string }>(sql`
    select encode(sha256(convert_to(jsonb_build_array(to_jsonb(r),to_jsonb(o),
      d.status,d.source_url,d.checksum_sha256,s.status,s.checksum_sha256,
      (select jsonb_agg(to_jsonb(oa) order by oa.id) from opportunity_organizer_assignments oa
        where oa.opportunity_id=o.id))::text,'UTF8')),'hex') hash
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
    await tx.execute(sql`select public.lock_editorial_agent_context(${payload.requirementId??null}::bigint,
      ${`{${payload.articles.map(article=>article.id).join(',')}}`}::bigint[])`);
    let current = true;
    if (payload.requirementId) {
      current = await requirementContext(tx as unknown as AgentDatabase,payload.requirementId,true) === payload.context.sourceContextHash;
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
      for(const [index,question] of result.questions.entries()) {
        const article=payload.articles.find(item=>item.id===question.articleId)!;
        const [version]=await tx.execute<{verifiedAt:string}>(sql`select verified_at::text as "verifiedAt" from legal_versions where id=${article.versionId}`);
        const publicId=deterministicNoticeQuestionUuid(`${job.jobKey}:${job.inputHash}:${index}:${question.prompt}`);
        const similarity=findMostSimilarQuestion(question.prompt,existing);
        if(similarity.scoreBps>=ORIGINALITY_REJECTION_THRESHOLD_BPS) throw new Error("Enunciado próximo do acervo; lote não importado.");
        const [saved]=await tx.insert(schema.questions).values({publicId,
          legalArticleId:article.id,subjectId:context.subjectId,topicId:context.topicId,
          quizMode:'original_style',styleBankId:context.bankId,type:payload.bank==='cebraspe'?'true_false':'multiple_choice',
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
  const [budget]=await db.execute<{used:number}>(sql`select count(*)::int used from editorial_agent_runs where started_at>now()-interval '24 hours'`);
  return { counts, budget:{...budget,limit:AGENT_WORK_DAILY_LIMIT},publicationAllowed:false };
}
