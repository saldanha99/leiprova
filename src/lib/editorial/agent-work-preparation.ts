import { sql } from "drizzle-orm";
import { AGENT_WORK_VERSION, agentWorkResultSchema, validateDiscoveryUrl, workPayloadSchema,
  type AgentWorkPayload, type WorkArticle } from "./agent-work-contract";
import { enqueueAgentWork, requirementContext, type AgentDatabase } from "./agent-work-queue";
import { STYLE_PROFILE_SEEDS } from "./style-profiles";
import { suggestLegalRequirementMapping, type MappingArticle } from "./legal-requirement-mapping";
import { discoveryPortalPolicy } from "./discovery-policy";

type Requirement = { id:number; opportunityId:number; text:string; locator:string; title:string;
  role:string; year:number; jurisdiction:string; documentUrl:string; bank:string|null;
  checksum:string; verifiedOn:string; };

export async function prepareAgentWork(db:AgentDatabase, now=new Date(), options:{followupsOnly?:boolean}={}) {
  let mappings=0, authoring=0, discovery=0, legalChanges=0;
  const requirements=options.followupsOnly ? [] : await db.execute<Requirement>(sql`
    select r.id::int id,r.opportunity_id::int as "opportunityId",r.requirement_text text,r.source_locator locator,
      o.title,o.role_name role,o.cycle_year as "year",o.jurisdiction_code jurisdiction,s.document_url as "documentUrl",
      s.checksum_sha256 checksum,s.updated_at::date::text as "verifiedOn",
      (select b.slug from opportunity_organizer_assignments oa join quiz_banks b on b.id=oa.quiz_bank_id
        where oa.opportunity_id=o.id and oa.status='reviewed' and oa.valid_until is null and b.is_active
        order by case oa.role when 'examination_provider' then 0 else 1 end,oa.id limit 1) bank
    from opportunity_requirements r join contest_opportunities o on o.id=r.opportunity_id
    join opportunity_source_documents d on d.id=r.source_document_id
    join opportunity_document_snapshots s on s.id=r.source_snapshot_id
    where r.editorial_status in ('draft','pending_review','reviewed') and o.editorial_status='reviewed'
      and d.status='approved' and s.status='approved' order by r.id limit 2000
  `);
  for (const requirement of requirements) {
    const sourceContextHash=await requirementContext(db,requirement.id);
    if (!sourceContextHash) continue;
    const search=(requirement.text.match(/[\p{L}]{5,}/gu)??[]).slice(0,24).join(" OR ");
    if(!search) continue;
    const retrieved=await db.execute<WorkArticle & {actId:number;actType:string;actNumber:string|null;actYear:number|null;jurisdiction:string;verifiedOn:string}>(sql`
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
    `);
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
  }
  const parents=await db.execute<{key:string; hash:string; payload:AgentWorkPayload; result:unknown}>(sql`
    select job_key key,input_hash hash,payload,result from editorial_agent_work where kind='legal_mapping' and status='prepared'
    order by created_at limit 2000
  `);
  for(const parent of parents) {
    const payload=workPayloadSchema.parse(parent.payload);
    const result=agentWorkResultSchema.parse(parent.result);
    if(!payload.bank || !payload.role || !payload.requirementId ||
      await requirementContext(db,payload.requirementId)!==payload.context.sourceContextHash) continue;
    const ids=new Set(result.mappings.map(item=>item.articleId));
    const selected=payload.articles.filter(article=>ids.has(article.id));
    if(!selected.length) continue;
    if(await enqueueAgentWork(db,`author:${payload.requirementId}`,"authoring",{...payload,
      parentKey:parent.key,parentHash:parent.hash,articles:selected,
      instructions:"Crie até cinco questões originais de literalidade/aplicação da lei, por banca E cargo deste pacote, com resposta única e justificativa de cada alternativa. Fundamento somente nos artigos versionados fornecidos. Não consultar simulados/provas. Perfil interno, não material oficial da banca. São propostas para revisão humana: publicationAllowed false. Não altere banco ou conteúdo público.",
      context:{...payload.context,mappingProposals:result.mappings,humanReviewRequired:true}})) authoring++;
  }
  // A confirmação de uma resposta não deve repetir a busca completa no corpus.
  // A preparação integral continua no ciclo de seis horas da VPS.
  if(options.followupsOnly) return {mappings,authoring,discovery,legalChanges,humanReviewRequired:true,publicationAllowed:false};
  const portals=await db.execute<{bank:string; url:string}>(sql`
    select b.slug bank,p.official_url url from exam_source_portals p join quiz_banks b on b.id=p.quiz_bank_id
    where p.is_active and b.is_active order by b.slug
  `);
  const date=now.toISOString().slice(0,10);
  await db.execute(sql`update editorial_agent_work set status='superseded',lease_token=null,lease_expires_at=null,
    last_error_code='newer_discovery_window',updated_at=now()
    where kind='discovery' and status in ('pending','running') and payload->'context'->>'date' < ${date}`);
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
  return {mappings,authoring,discovery,legalChanges,humanReviewRequired:true,publicationAllowed:false};
}
