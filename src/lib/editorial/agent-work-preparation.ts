import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { AGENT_WORK_VERSION, agentInputHash, agentWorkResultSchema, validateDiscoveryUrl, workPayloadSchema,
  type AgentWorkPayload, type WorkArticle } from "./agent-work-contract";
import { AGENT_OPPORTUNITY_PRIORITY_CTES, REQUIREMENT_CONTEXT_HASH_SQL, enqueueAgentWork, requirementContext, type AgentDatabase } from "./agent-work-queue";
import { MINIMUM_COURSE_QUESTION_COUNT } from "@/lib/commerce/minimum-course-content";
import { STYLE_PROFILE_SEEDS } from "./style-profiles";
import { suggestLegalRequirementMapping, type MappingArticle } from "./legal-requirement-mapping";
import { discoveryPortalPolicy } from "./discovery-policy";
import { prepareCourseIntake } from "./course-intake";
import { officialQuestionContractSchema, questionContractFingerprint } from "./official-question-contract";
import { currentQuestionContractExists } from "./question-contract-query";

type Requirement = { id:number; opportunityId:number; text:string; locator:string; title:string;
  role:string; year:number; jurisdiction:string; documentUrl:string; bank:string|null;
  checksum:string; verifiedOn:string; sourceContextHash:string; };

export const AGENT_PREPARATION_BATCH_SIZE = 100;
export const AGENT_PREPARATION_CACHE_ACTION = "automation.agent_requirement.preparation_cached";
// Bump this when retrieval, instructions or matching semantics change.
export const AGENT_PREPARATION_ALGORITHM_PROFILE_HASH = createHash("sha256").update(JSON.stringify({
  version: "retrieval-preparation-v3-scoped-format", contract: AGENT_WORK_VERSION, profiles: STYLE_PROFILE_SEEDS,
  retrieval: { language: "portuguese", words: 24, articles: 8, bytes: 220000, exactCitation: "legal-requirement-mapping-v1" },
})).digest("hex");

export function preparationBatchSize(input = AGENT_PREPARATION_BATCH_SIZE) {
  if (!Number.isSafeInteger(input) || input < 1 || input > AGENT_PREPARATION_BATCH_SIZE) throw new Error("Lote de preparação precisa conter entre1 e100 requisitos.");
  return input;
}

/** Normative fingerprint once per round, including text edits without timestamps,
 * activation/revocation, legal rights and date-bound eligibility. No body is returned. */
export const AGENT_PREPARATION_CORPUS_HASH_SQL = sql`
  select encode(sha256(convert_to(coalesce(jsonb_agg(jsonb_build_array(a.id,a.legal_version_id,a.article_ref,
    encode(sha256(convert_to(a.literal_text,'UTF8')),'hex'),a.editorial_status,a.source_rights,
    v.status,v.checksum_sha256,v.source_url,v.valid_from,v.valid_until,v.verified_at::date,
    l.id,l.title,l.short_title,l.act_type,l.act_number,l.act_year,l.jurisdiction,l.is_active) order by a.id)::text,'[]'),'UTF8')),'hex') hash
  from legal_articles a join legal_versions v on v.id=a.legal_version_id join legal_acts l on l.id=v.legal_act_id
  where a.editorial_status='reviewed' and a.source_rights='official_text' and v.status='current' and l.is_active
    and (v.valid_from is null or v.valid_from<=current_date) and (v.valid_until is null or v.valid_until>=current_date)
    and length(a.literal_text) between 20 and 80000`;

export function mappingPreparationBatchQuery(corpusHash: string, batchSize: number) {
  const limit = preparationBatchSize(batchSize) + 1;
  return sql`with ${AGENT_OPPORTUNITY_PRIORITY_CTES}, eligible as materialized (
    select r.id::int id,r.opportunity_id::int as "opportunityId",r.requirement_text text,r.source_locator locator,
      o.title,o.role_name role,o.cycle_year as "year",o.jurisdiction_code jurisdiction,s.document_url as "documentUrl",
      s.checksum_sha256 checksum,s.updated_at::date::text as "verifiedOn",${REQUIREMENT_CONTEXT_HASH_SQL} as "sourceContextHash",
      (select b.slug from opportunity_organizer_assignments oa join quiz_banks b on b.id=oa.quiz_bank_id
        where oa.opportunity_id=o.id and oa.status='reviewed' and oa.valid_until is null and b.is_active
        order by case oa.role when 'examination_provider' then 0 else 1 end,oa.id limit 1) bank,
      cache.metadata as cache,work.input_hash as "mappingInputHash",work.status as "mappingStatus",
      case when content.opportunity_id is not null and coalesce(content.minimum_valid_question_count,0)<${MINIMUM_COURSE_QUESTION_COUNT}
        then 0 when content.opportunity_id is null then 2 else 1 end priority,
      case when o.exam_date>=(now() at time zone 'America/Sao_Paulo')::date then o.exam_date end deadline
    from opportunity_requirements r join contest_opportunities o on o.id=r.opportunity_id
    join opportunity_source_documents d on d.id=r.source_document_id join opportunity_document_snapshots s on s.id=r.source_snapshot_id
    left join opportunity_content content on content.opportunity_id=o.id
    left join editorial_agent_work work on work.job_key='mapping:'||r.id::text
    left join lateral (select audit.metadata from audit_logs audit
      where audit.entity_type='editorial_agent_preparation' and audit.entity_id=r.id::text and audit.action=${AGENT_PREPARATION_CACHE_ACTION}
      order by audit.created_at desc,audit.id desc limit 1) cache on true
    where r.editorial_status in('draft','pending_review','reviewed') and o.editorial_status='reviewed'
      and d.status='approved' and s.status='approved' and coalesce(work.status,'')<>'running'
  ), due as materialized (select * from eligible
    where cache->>'sourceContextHash' is distinct from "sourceContextHash"
      or cache->>'corpusHash' is distinct from ${corpusHash}
      or cache->>'algorithmProfileHash' is distinct from ${AGENT_PREPARATION_ALGORITHM_PROFILE_HASH}
      or cache->>'mappingInputHash' is distinct from "mappingInputHash"
      or "mappingInputHash" is null
  ), balanced as (select *,row_number() over(partition by "opportunityId" order by id) as position from due)
  select * from balanced order by priority,position,deadline nulls last,id limit ${limit}`;
}

export function authoringPreparationBatchQuery(batchSize: number) {
  return sql`with ${AGENT_OPPORTUNITY_PRIORITY_CTES}, due as materialized (
    select parent.job_key key,parent.input_hash hash,parent.payload,parent.result,r.id,
      qc.id as "questionContractId",qc.payload as "questionContract",
      r.opportunity_id as "opportunityId",case when content.opportunity_id is not null
        and coalesce(content.minimum_valid_question_count,0)<${MINIMUM_COURSE_QUESTION_COUNT} then 0 else 1 end priority
    from editorial_agent_work parent
    join opportunity_requirements r on r.id=case when parent.payload->>'requirementId'~'^[0-9]{1,18}$' then(parent.payload->>'requirementId')::bigint end
    join contest_opportunities o on o.id=r.opportunity_id join opportunity_source_documents d on d.id=r.source_document_id
    join opportunity_document_snapshots s on s.id=r.source_snapshot_id
    join opportunity_question_contracts qc on qc.opportunity_id=o.id
    join quiz_banks qb on qb.id=qc.bank_id and qb.slug=parent.payload->>'bank'
    left join opportunity_content content on content.opportunity_id=o.id
    left join editorial_agent_work author on author.job_key='author:'||r.id::text
    where parent.kind='legal_mapping' and parent.status='prepared' and parent.result->>'outcome'='prepared'
      and case when jsonb_typeof(parent.result->'mappings')='array' then jsonb_array_length(parent.result->'mappings')>0 else false end
      and parent.payload->>'bank' is not null and parent.payload->>'role' is not null
      and r.subject_id is not null and r.editorial_status in('draft','pending_review','reviewed') and o.editorial_status='reviewed' and d.status='approved' and s.status='approved'
      and parent.payload->'context'->>'sourceContextHash'=${REQUIREMENT_CONTEXT_HASH_SQL}
      and ${currentQuestionContractExists(sql`qc.id`,sql`o.id`)}
      and not exists (select 1 from jsonb_array_elements(parent.payload->'articles') candidate
        where not exists (select 1 from legal_articles article join legal_versions version on version.id=article.legal_version_id
          join legal_acts act on act.id=version.legal_act_id
          where article.id=(candidate->>'id')::bigint and version.id=(candidate->>'versionId')::bigint
            and version.checksum_sha256=candidate->>'checksum' and article.literal_text=candidate->>'text'
            and article.editorial_status='reviewed' and article.source_rights='official_text' and version.status='current'
            and act.is_active and (version.valid_from is null or version.valid_from<=current_date)
            and (version.valid_until is null or version.valid_until>=current_date)))
      and coalesce(author.status,'')<>'running'
      and (author.job_key is null or author.payload->>'parentHash' is distinct from parent.input_hash
        or author.payload->>'questionContractId' is distinct from qc.id
        or author.payload->'context'->>'sourceContextHash' is distinct from parent.payload->'context'->>'sourceContextHash')
  ), balanced as (select *,row_number() over(partition by "opportunityId" order by id,key) as position from due)
  select key,hash,payload,result,"questionContractId","questionContract" from balanced order by priority,position,id,key limit ${preparationBatchSize(batchSize) + 1}`;
}

export async function prepareAgentWork(db:AgentDatabase, now=new Date(), options:{followupsOnly?:boolean;batchSize?:number}={}) {
  let mappings=0, authoring=0, discovery=0, legalChanges=0;
  const batchSize = preparationBatchSize(options.batchSize);
  let corpusHash = "";
  // Requisito retirado ou suspenso (reextração do programa) não gasta reserva de agente.
  if(!options.followupsOnly) await db.execute(sql`
    update editorial_agent_work work set status='superseded',last_error_code='requirement_withdrawn',updated_at=now()
    where work.status='pending' and work.kind in ('legal_mapping','authoring')
      and work.payload->>'requirementId' ~ '^[0-9]{1,18}$'
      and not exists (select 1 from opportunity_requirements requirement
        where requirement.id=(work.payload->>'requirementId')::bigint
          and requirement.editorial_status in ('draft','pending_review','reviewed'))
  `);
  if(!options.followupsOnly) {
    const [corpus] = await db.execute<{hash:string}>(AGENT_PREPARATION_CORPUS_HASH_SQL);
    if(!corpus || !/^[a-f0-9]{64}$/u.test(corpus.hash)) throw new Error("Fingerprint normativo indisponível; preparação não iniciada.");
    corpusHash = corpus.hash;
  }
  const selectedRequirements=options.followupsOnly ? [] : await db.execute<Requirement>(mappingPreparationBatchQuery(corpusHash,batchSize));
  const mappingHasMore = selectedRequirements.length > batchSize;
  const requirements = selectedRequirements.slice(0,batchSize);
  for (const requirement of requirements) {
    const sourceContextHash=requirement.sourceContextHash;
    if (!sourceContextHash) continue;
    const search=(requirement.text.match(/[\p{L}]{5,}/gu)??[]).slice(0,24).join(" OR ");
    const retrieved=search ? await db.execute<WorkArticle & {actId:number;actType:string;actNumber:string|null;actYear:number|null;jurisdiction:string;verifiedOn:string}>(sql`
      select a.id::int id,l.short_title act,a.article_ref as "articleRef",v.id::int as "versionId",
        v.checksum_sha256 checksum,a.literal_text text,v.source_url url,l.id::int as "actId",
        l.act_type as "actType",l.act_number as "actNumber",l.act_year as "actYear",l.jurisdiction,
        v.verified_at::date::text as "verifiedOn"
      from legal_articles a join legal_versions v on v.id=a.legal_version_id join legal_acts l on l.id=v.legal_act_id
      where a.editorial_status='reviewed' and a.source_rights='official_text' and v.status='current' and l.is_active
        and (v.valid_from is null or v.valid_from<=current_date) and (v.valid_until is null or v.valid_until>=current_date)
        and length(a.literal_text) between 20 and 80000
        and to_tsvector('portuguese',l.title||' '||a.literal_text) @@ websearch_to_tsquery('portuguese',${search})
      order by ts_rank(to_tsvector('portuguese',l.title||' '||a.literal_text),
        websearch_to_tsquery('portuguese',${search})) desc,a.id limit 8
    `) : [];
    let size=0;
    const bounded=retrieved.filter(article=>{size+=Buffer.byteLength(article.text);return size<=220000;});
    const articles:WorkArticle[]=bounded.map(({id,act,articleRef,versionId,checksum,text,url})=>({id,act,articleRef,versionId,checksum,text,url}));
    const exactCitation=suggestLegalRequirementMapping({requirement:{id:requirement.id,requirementText:requirement.text,
      sourceLocator:requirement.locator,source:{url:requirement.documentUrl,checksumSha256:requirement.checksum,verifiedOn:requirement.verifiedOn}},
      articles:bounded.map((article):MappingArticle=>({legalActId:article.actId,legalVersionId:article.versionId,legalArticleId:article.id,
        actType:article.actType,actNumber:article.actNumber??"",actYear:article.actYear??0,actTitle:article.act,
        jurisdiction:article.jurisdiction,articleRef:article.articleRef,literalText:article.text,
        source:{url:article.url,checksumSha256:article.checksum,verifiedOn:article.verifiedOn},uncertainties:[]})),
      officialSourceUrls:[requirement.documentUrl,...articles.map(article=>article.url)]});
    const profile=STYLE_PROFILE_SEEDS.find(item=>item.bankSlug===requirement.bank);
    const payload:AgentWorkPayload={version:AGENT_WORK_VERSION,title:requirement.title,
      instructions:"Proponha vínculos de literalidade entre o requisito e os artigos fornecidos. Não confunda doutrina/jurisprudência com lei seca. Cite trecho literal e explique a pertinência por cargo. Se não houver fundamento suficiente, outcome blocked e limitações explícitas. Não aprovar, não publicar, não buscar questões de terceiros.",
      requirementId:requirement.id,opportunityId:requirement.opportunityId,role:requirement.role,
      ...(profile?{bank:profile.bankSlug}:{}),articles,sourceUrls:[requirement.documentUrl],
      context:{sourceContextHash,requirement:requirement.text,locator:requirement.locator,
        year:requirement.year,jurisdiction:requirement.jurisdiction,profile:profile??null,
        matchingPolicy:"retrieval_candidates_not_editorial_approval",exactCitation,humanReviewRequired:true}};
    if(await enqueueAgentWork(db,`mapping:${requirement.id}`,"legal_mapping",payload)) {
      mappings++;
      if(!articles.length) {
        const result={schemaVersion:1,publicationAllowed:false,outcome:"blocked",summary:"Nenhum artigo oficial vigente do corpus disponível corresponde à busca deste requisito.",
          limitations:["É necessário ampliar/revisar o corpus ou delimitar o requisito. Não substituir doutrina ou jurisprudência por lei seca."],evidence:[],mappings:[],discoveries:[],questions:[]};
        await db.execute(sql`update editorial_agent_work set status='blocked',result=${JSON.stringify(result)}::jsonb,
          last_error_code='official_corpus_missing',updated_at=now() where job_key=${`mapping:${requirement.id}`} and status='pending'`);
      }
    }
    // Cache lives outside payload/inputHash. Concurrent claim/change cannot be
    // called cached: only the exact non-running mapping records this receipt.
    await db.execute(sql`insert into audit_logs(action,entity_type,entity_id,metadata)
      select ${AGENT_PREPARATION_CACHE_ACTION},'editorial_agent_preparation',${String(requirement.id)},
        ${JSON.stringify({sourceContextHash,corpusHash,algorithmProfileHash:AGENT_PREPARATION_ALGORITHM_PROFILE_HASH,
          mappingInputHash:agentInputHash(payload),requirementId:requirement.id,policy:"retrieval_cache_only",humanReview:false,publicationAllowed:false})}::jsonb
      from editorial_agent_work work where work.job_key=${`mapping:${requirement.id}`}
        and work.input_hash=${agentInputHash(payload)} and work.status<>'running'`);
  }
  const selectedParents=await db.execute<{key:string; hash:string; payload:AgentWorkPayload; result:unknown;questionContractId:string;questionContract:unknown}>(authoringPreparationBatchQuery(batchSize));
  const authoringHasMore = selectedParents.length > batchSize;
  const parents = selectedParents.slice(0,batchSize);
  for(const parent of parents) {
    const payload=workPayloadSchema.parse(parent.payload);
    const result=agentWorkResultSchema.parse(parent.result);
    const scoped=officialQuestionContractSchema.safeParse(parent.questionContract);
    if(!scoped.success || questionContractFingerprint(scoped.data)!==parent.questionContractId ||
      scoped.data.opportunityId!==payload.opportunityId || scoped.data.roleName!==payload.role) continue;
    if(!payload.bank || !payload.role || !payload.requirementId ||
      await requirementContext(db,payload.requirementId)!==payload.context.sourceContextHash) continue;
    const ids=new Set(result.mappings.map(item=>item.articleId));
    const selected=payload.articles.filter(article=>ids.has(article.id));
    if(!selected.length) continue;
    if(await enqueueAgentWork(db,`author:${payload.requirementId}`,"authoring",{...payload,
      questionContractId:parent.questionContractId,questionContract:scoped.data,
      parentKey:parent.key,parentHash:parent.hash,articles:selected,
      instructions:"Crie até cinco questões originais de literalidade/aplicação da lei, por banca E cargo deste pacote, com resposta única e justificativa de cada alternativa. Use exatamente questionContract.format e questionContract.optionKeys; nunca inferir formato pelo nome da banca. C/E usa internamente A=Certo e B=Errado, preservando os códigos oficiais C/E no contrato. Fundamento somente nos artigos versionados fornecidos. Não consultar simulados/provas. Perfil interno, não material oficial da banca. São propostas para revisão editorial: publicationAllowed false. Não altere banco ou conteúdo público.",
      context:{...payload.context,profile:scoped.data.profile,mappingProposals:result.mappings,humanReviewRequired:true}})) authoring++;
  }
  // A confirmação de uma resposta não deve repetir a busca completa no corpus.
  // A preparação integral continua no ciclo de seis horas da VPS.
  const batches = {batchSize,mappingExamined:requirements.length,authoringExamined:parents.length,mappingHasMore,authoringHasMore,hasMore:mappingHasMore||authoringHasMore};
  if(options.followupsOnly) return {mappings,authoring,discovery,legalChanges,...batches,humanReviewRequired:true,publicationAllowed:false};
  const courseIntake=await prepareCourseIntake(db);
  const portals=await db.execute<{bank:string; url:string}>(sql`
    select b.slug bank,p.official_url url from exam_source_portals p join quiz_banks b on b.id=p.quiz_bank_id
    where p.is_active and b.is_active and b.slug in (${sql.join(STYLE_PROFILE_SEEDS.map(profile=>sql`${profile.bankSlug}`),sql`,`)})
    order by b.slug
  `);
  const date=now.toISOString().slice(0,10);
  await db.execute(sql`update editorial_agent_work set status='superseded',lease_token=null,lease_expires_at=null,
    last_error_code='newer_discovery_window',updated_at=now()
    where kind='discovery' and status='pending' and payload->'context'->>'date' < ${date}`);
  for(const portal of portals) {
    const policy=discoveryPortalPolicy(portal.bank,portal.url);
    const urls=policy.urls.map(validateDiscoveryUrl);
    if(await enqueueAgentWork(db,`discovery:${portal.bank}:${date}`,"discovery",{
      version:AGENT_WORK_VERSION,title:`Radar de editais — ${portal.bank} — ${date}`,articles:[],sourceUrls:urls,
      instructions:"Use agent-browser para consultar este portal oficial e suas páginas de concursos. Liste até 20 editais/retificações/avisos recentes pertinentes às carreiras jurídicas, cartórios, policiais, tribunais, procuradorias, fiscal/controle, legislativa ou trabalhista. Registre URL oficial, cargo, UF, banca quando comprovada e evidência. Não ler/copiar questões ou gabaritos; não burlar bloqueios. Se não houver novidades, prepared com discoveries vazio e resumo da cobertura. Se houver bloqueio de acesso, blocked com motivo, sem inventar concursos. Somente propostas, nenhuma publicação.",
      context:{date,bank:portal.bank,humanReviewRequired:true,coverage:"listed_official_portal_not_all_Brazil",accessPolicy:policy.limitation}})) {
      discovery++;
      if(policy.blocked) await db.execute(sql`update editorial_agent_work set status='blocked',
        last_error_code=${policy.blocked},result=${JSON.stringify({schemaVersion:1,publicationAllowed:false,outcome:'blocked',
          summary:'Coleta suspensa por bloqueio observado no portal.',limitations:[policy.limitation],evidence:[],mappings:[],discoveries:[],questions:[]})}::jsonb,
        updated_at=now() where job_key=${`discovery:${portal.bank}:${date}`} and status='pending'`);
    }
  }
  const changes=await db.execute<{id:number;title:string;url:string;checksum:string;status:string}>(sql`
    select s.id::int,l.short_title title,s.source_url url,s.checksum_sha256 checksum,s.status
    from legal_source_snapshots s join legal_acts l on l.id=s.legal_act_id
    where s.status='pending_review' and l.is_active order by s.id desc limit 40
  `);
  for(const change of changes) {
    if(await enqueueAgentWork(db,`legal-change:${change.id}`,"legal_change",{
      version:AGENT_WORK_VERSION,title:`Verificação de alteração — ${change.title}`,articles:[],sourceUrls:[change.url],
      instructions:"Verifique a fonte normativa oficial usando agent-browser. Explique alteração ou ausência de mudança material, vigência e limitações. Não ativar versão, não marcar revisão humana nem publicar questões. Registre evidências e encaminhe à revisão administrativa.",
      context:{snapshotId:change.id,checksum:change.checksum,status:change.status,humanReviewRequired:true}})) legalChanges++;
  }
  return {mappings,authoring,discovery,legalChanges,courseIntake,...batches,humanReviewRequired:true,publicationAllowed:false};
}
