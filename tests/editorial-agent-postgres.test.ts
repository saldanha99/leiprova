import { randomUUID,createHash } from "node:crypto";
import { sql,eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { beforeAll,beforeEach,afterAll,describe,it,expect } from "vitest";
import * as schema from "@/lib/db/schema";
import { AGENT_WORK_DAILY_LIMIT, AGENT_WORK_LEASE_MINUTES, AGENT_WORK_VERSION,agentInputHash,type AgentWorkPayload } from "@/lib/editorial/agent-work-contract";
import { enqueueAgentWork,claimAgentWork,completeAgentWork,requirementContext,agentWorkSummary } from "@/lib/editorial/agent-work-queue";
import { AGENT_PREPARATION_CORPUS_HASH_SQL, mappingPreparationBatchQuery, prepareAgentWork } from "@/lib/editorial/agent-work-preparation";
import { prepareCourseIntake } from "@/lib/editorial/course-intake";
import { syntheticQuestionContract } from "./fixtures/question-contract";
import { questionContractFingerprint } from "@/lib/editorial/official-question-contract";
import { certifyProductBindingContracts,lockQuestionContracts } from "@/lib/editorial/question-contract-service";
import { lockApprovalScope } from "@/lib/editorial/approval-lock";
import { reviewOfficialQuestionContract } from "@/lib/editorial/official-question-contract-review";
import { OFFICIAL_COURSE_STANDING_REFERENCE } from "@/lib/editorial/official-course-dossier";
import { questionOptionsMatchContract } from "@/lib/editorial/question-contract-query";
import { approvedProductQuestionExists } from "@/lib/commerce/product-binding-query";
import { approvedProductQuestionCount } from "@/lib/commerce/minimum-course-content";
import {reviewProductQuestionBindings} from '@/lib/commerce/product-binding-review-service';
import {FACTORY_STANDING_REVIEW_REFERENCE} from '@/lib/editorial/factory-standing-review';

const url=process.env.LEIPROVA_TEST_DATABASE_URL;
if(url){const parsed=new URL(url);if(!["localhost","127.0.0.1","[::1]"].includes(parsed.hostname)||parsed.pathname!=="/leiprova_automation_test")throw new Error("Somente banco de teste em loopback.");}
const client=url?postgres(url,{max:6,prepare:false}):null;
const db=client?drizzle(client,{schema}):null;
const hash=(text:string)=>createHash('sha256').update(text).digest('hex');
const base={schemaVersion:1,publicationAllowed:false,outcome:'prepared',summary:'Teste sintético; sem publicação.',limitations:[],evidence:[]};
function discoveryPayload():AgentWorkPayload{return{version:AGENT_WORK_VERSION,title:'Descoberta sintética',instructions:'Somente teste.',context:{},articles:[],sourceUrls:['https://www.vunesp.com.br/']};}
async function fixture(operator=false,examDate?:string){
  const database=db!;const tag=randomUUID();
  const [editor]=await database.insert(schema.users).values({publicId:randomUUID(),name:'Editor sintético',email:`${tag}@example.invalid`,passwordHash:'not-a-password',role:operator?'admin':'editor'}).returning();
  const [category]=await database.select().from(schema.contestCategoryCareers).limit(1);
  const [topic]=await database.select().from(schema.quizTopics).limit(1);
  const [bank]=await database.select().from(schema.quizBanks).where(eq(schema.quizBanks.slug,operator?'fgv':'vunesp'));
  // URLs permitidas pelo parser, SEM fetch; todos os bytes/textos/atores são
  // fictícios e confinados ao banco leiprova_automation_test em loopback.
  const landing=operator?`https://conhecimento.fgv.br/concursos/qa-synthetic-${tag}`:'https://example.invalid/synthetic';
  const document=operator?`https://conhecimento.fgv.br/sites/default/files/qa-synthetic-${tag}.pdf`:'https://example.invalid/synthetic.pdf';
  const sourceHost=operator?'conhecimento.fgv.br':'example.invalid';
  const [edition]=await database.insert(schema.examEditions).values({publicId:`agent-test-${tag}`,careerTrackId:category.careerTrackId,
    bankId:bank.id,institutionAcronym:`TEST-${tag.toUpperCase()}`,jurisdictionCode:'BR',title:'Edição sintética',examDate:'2026-12-01',status:'scheduled',officialUrl:landing}).returning();
  const [act]=await database.insert(schema.legalActs).values({slug:`agent-test-${tag}`,title:'Regra sintética',shortTitle:'Regra sintética',actType:'lei',officialUrl:'https://example.invalid/synthetic'}).returning();
  const [version]=await database.insert(schema.legalVersions).values({legalActId:act.id,sourceUrl:'https://example.invalid/synthetic',checksumSha256:hash(tag),verifiedAt:new Date(),status:'current'}).returning();
  const [article]=await database.insert(schema.legalArticles).values({legalVersionId:version.id,articleRef:'Art. 1',articleOrder:1,path:'art-1',literalText:'No exercício fictício, a equipe deve organizar os cartões antes da atividade.',editorialStatus:'reviewed'}).returning();
  const [opportunity]=await database.insert(schema.contestOpportunities).values({publicId:randomUUID(),slug:`agent-test-${tag}`,categoryId:category.categoryId,careerTrackId:category.careerTrackId,jurisdictionCode:'BR',scope:'national',cycleYear:2026,institutionAcronym:`TEST-${tag.toUpperCase()}`,institutionName:'Instituição sintética',roleName:'Cargo sintético',title:'Concurso sintético',summary:'Exclusivo para teste.',statusAsOf:'2026-09-06',editorialStatus:'draft',officialUrl:landing,sourceCheckedAt:new Date(),examDate}).returning();
  const [source]=await database.insert(schema.opportunitySourceDocuments).values({publicId:randomUUID(),opportunityId:opportunity.id,documentType:'official_announcement',title:'Fonte sintética',sourceUrl:landing,sourceHost,observedAt:new Date(),lastSeenAt:new Date(),httpStatus:200,status:'approved',reviewedByUserId:editor.id,reviewedAt:new Date()}).returning();
  await database.update(schema.contestOpportunities).set({examEditionId:edition.id,officialNoticeNumber:'QA/2026',editorialStatus:'reviewed',reviewedByUserId:editor.id,reviewedAt:new Date(),publishedAt:new Date()}).where(eq(schema.contestOpportunities.id,opportunity.id));
  const syntheticText=operator?'Instituição fictícia, Cargo sintético, prova sem validade jurídica: cinco alternativas e apenas uma resposta correta. '.repeat(3):'Somente teste sintético de automação. '.repeat(5);
  const [snapshot]=await database.insert(schema.opportunityDocumentSnapshots).values({publicId:randomUUID(),sourceDocumentId:source.id,documentUrl:document,sourceHost,fileName:'synthetic.pdf',mimeType:'application/pdf',documentBytes:Buffer.from('%PDF-synthetic'),checksumSha256:hash('%PDF-synthetic'),byteLength:Buffer.byteLength('%PDF-synthetic'),pageCount:1,extractedText:syntheticText,pageTexts:[syntheticText],textLength:syntheticText.length,parserVersion:'synthetic-test',authorizationScope:'owner-approval-2026-09-01',authorizedAt:new Date(),status:'approved',reviewedByUserId:editor.id,reviewedAt:new Date(),reviewNotes:'Somente fixture sintética.'}).returning();
  const [assignment]=await database.insert(schema.opportunityOrganizerAssignments).values({opportunityId:opportunity.id,quizBankId:bank.id,sourceDocumentId:source.id,responsibleType:'external_organizer',role:'examination_provider',organizerSlug:bank.slug,organizerName:'Perfil sintético',validFrom:'2026-01-01',status:'reviewed',reviewedByUserId:editor.id,reviewedAt:new Date()}).returning();
  const contract=syntheticQuestionContract({opportunityId:opportunity.id,examEditionId:edition.id,bankId:bank.id,organizerAssignmentId:assignment.id,
    sourceDocumentId:source.id,sourceSnapshotId:snapshot.id,sourceSnapshotChecksum:snapshot.checksumSha256,
    sourceDocumentUrl:source.sourceUrl,sourceDocumentChecksum:source.checksumSha256,sourceUrl:snapshot.documentUrl,
    sourceQuote:syntheticText,identityQuote:syntheticText});
  const contractId=questionContractFingerprint(contract);
  if(!operator) await database.insert(schema.opportunityQuestionContracts).values({...contract,id:contractId,payload:contract,
    approvalReference:'synthetic-software-fixture-no-legal-validity',reviewedByUserId:editor.id,reviewedAt:new Date()});
  const [requirement]=await database.insert(schema.opportunityRequirements).values({opportunityId:opportunity.id,sourceDocumentId:source.id,sourceSnapshotId:snapshot.id,subjectId:topic.subjectId,topicId:topic.id,requirementText:'Regra sintética de organizar cartões.',sourceLocator:'Página sintética 1',editorialStatus:'draft'}).returning();
  const payload:AgentWorkPayload={version:AGENT_WORK_VERSION,title:opportunity.title,instructions:'Somente teste.',requirementId:requirement.id,opportunityId:opportunity.id,bank:operator?'fgv':'vunesp',role:opportunity.roleName,context:{sourceContextHash:await requirementContext(database,requirement.id),requirement:requirement.requirementText},sourceUrls:[snapshot.documentUrl],articles:[{id:article.id,act:act.shortTitle,articleRef:article.articleRef,text:article.literalText,versionId:version.id,checksum:version.checksumSha256,url:version.sourceUrl}]};
  payload.questionContractId=contractId;payload.questionContract=contract;
  return{payload,requirement,article,version,contractId,contract,editor,source,snapshot};
}
async function reviewAssignmentValidity(f:Awaited<ReturnType<typeof fixture>>,validUntil:string|null){
  await db!.update(schema.opportunityOrganizerAssignments).set({status:'pending_review',reviewedByUserId:null,reviewedAt:null})
    .where(eq(schema.opportunityOrganizerAssignments.id,f.contract.organizerAssignmentId));
  await db!.update(schema.opportunityOrganizerAssignments).set({status:'reviewed',validUntil,
    reviewedByUserId:f.editor.id,reviewedAt:new Date()}).where(eq(schema.opportunityOrganizerAssignments.id,f.contract.organizerAssignmentId));
}
describe.skipIf(!url)('ponte editorial — PostgreSQL isolado',()=>{
  beforeAll(async()=>{expect((await db!.execute<{name:string}>(sql`select current_database() name`))[0].name).toBe('leiprova_automation_test');});
  beforeEach(async()=>{await db!.execute(sql`delete from editorial_agent_runs`);await db!.execute(sql`delete from editorial_agent_work`);});
  afterAll(async()=>{await client?.end();});
  it('revisão automática de vínculo exige recibo da fábrica no concurso exato e audita ausência de revisão humana',async()=>{
    const f=await fixture(true),now=new Date(),slug=`standing-product-${randomUUID()}`;
    const [opportunity]=await db!.select().from(schema.contestOpportunities).where(eq(schema.contestOpportunities.id,f.requirement.opportunityId));
    const [edition]=await db!.select().from(schema.examEditions).where(eq(schema.examEditions.id,f.contract.examEditionId));
    await db!.update(schema.opportunityRequirements).set({editorialStatus:'reviewed',legalArticleId:f.article.id,legalActId:f.version.legalActId,
      reviewedByUserId:f.editor.id,reviewedAt:now,reviewNotes:'Conferência exclusivamente sintética.'}).where(eq(schema.opportunityRequirements.id,f.requirement.id));
    await db!.insert(schema.contestStoreProducts).values({slug,opportunityId:opportunity.id});
    const contractRequest={input:{contract:f.contract,productSlug:slug},actorPublicId:f.editor.publicId,
      approvalReference:OFFICIAL_COURSE_STANDING_REFERENCE,mode:'preview' as const};
    const contractPreview=await reviewOfficialQuestionContract(db!,contractRequest);
    await reviewOfficialQuestionContract(db!,{...contractRequest,mode:'apply',expectedFingerprint:contractPreview.fingerprint});
    const [question]=await db!.insert(schema.questions).values({publicId:randomUUID(),legalArticleId:f.article.id,
      subjectId:f.requirement.subjectId,topicId:f.requirement.topicId,quizMode:'original_style',styleBankId:f.contract.bankId,type:'multiple_choice',
      prompt:`Pergunta fictícia de auditoria ${randomUUID()}`,explanation:'Explicação fictícia para conferir o registro de autorização automática.',
      learningObjective:'Verificar auditoria e isolamento sem conteúdo jurídico real.',topic:'QA',editorialStatus:'reviewed',createdByUserId:f.editor.id,
      reviewedByUserId:f.editor.id,cleanRoomAttestedAt:now,sourceUrl:f.version.sourceUrl,sourceTitle:'Fonte sintética',verifiedAt:now,
      originalityCheckedAt:now,similarityMaxBps:0,authorshipMethod:'ai_assisted',generatorModel:'synthetic-software-test',promptVersion:'qa-v1',submittedAt:now}).returning();
    const options='ABCDE'.split('').map((optionKey,sortOrder)=>({optionKey,text:`Opção fictícia ${sortOrder}`,isCorrect:sortOrder===0,
      rationale:'Justificativa fictícia de software.',sortOrder}));
    await db!.insert(schema.questionOptions).values(options.map(option=>({...option,questionId:question.id})));
    const bindingId=hash(slug);
    await db!.insert(schema.contestProductQuestionBindings).values({id:bindingId,productSlug:slug,opportunityId:opportunity.id,
      requirementId:f.requirement.id,questionId:question.id,sourceDocumentId:f.source.id,sourceSnapshotId:f.snapshot.id,
      sourceSnapshotChecksum:f.contract.sourceSnapshotChecksum,legalArticleId:f.article.id,legalVersionId:f.version.id,
      legalVersionChecksum:f.version.checksumSha256,questionUpdatedAt:question.updatedAt,requirementText:f.requirement.requirementText,
      sourceLocator:f.requirement.sourceLocator,requirementQuote:f.requirement.requirementText,legalQuote:f.article.literalText,
      scopeNotes:'Apenas QA sintético de aprovação automática.',evidence:{sourceUrl:f.source.sourceUrl,legalArticleText:f.article.literalText,
        legalSourceUrl:f.version.sourceUrl,questionContent:{prompt:question.prompt,explanation:question.explanation,
          type:question.type,learningObjective:question.learningObjective,options}},proposedByUserId:f.editor.id,status:'pending_review'});
    const input={schemaVersion:1,productSlug:slug,opportunityPublicId:opportunity.publicId,examEditionPublicId:edition.publicId,
      bindingIds:[bindingId],notes:'Conferência fictícia na linha automática de testes.',confirmations:{edition:true,program:true,adherence:true}};
    const request={input,actorPublicId:f.editor.publicId,standingFactoryReviewReference:FACTORY_STANDING_REVIEW_REFERENCE};
    const factoryAudit=(contestSlug:string)=>db!.insert(schema.auditLogs).values({actorUserId:f.editor.id,action:'editorial.original_question.batch_approved',
      entityType:'question',entityId:question.publicId,metadata:{executionSource:'server_cli',contestSlug,
        approvalReference:FACTORY_STANDING_REVIEW_REFERENCE,approvalMode:'owner_standing_authorization',humanItemReview:false}});
    await factoryAudit('outro-concurso-ficticio');
    await expect(reviewProductQuestionBindings(db!,{...request,mode:'preview'})).rejects.toThrow('concurso exato');
    expect((await db!.select().from(schema.contestProductQuestionBindings).where(eq(schema.contestProductQuestionBindings.id,bindingId)))[0].status).toBe('pending_review');
    const manual=await reviewProductQuestionBindings(db!,{input,actorPublicId:f.editor.publicId,mode:'preview'});
    await factoryAudit(opportunity.slug);
    const preview=await reviewProductQuestionBindings(db!,{...request,mode:'preview'});
    expect(preview.eligible).toBe(1);expect(preview.fingerprint).not.toBe(manual.fingerprint);
    await expect(reviewProductQuestionBindings(db!,{...request,mode:'apply',expectedFingerprint:manual.fingerprint})).rejects.toThrow('preview');
    const applied=await reviewProductQuestionBindings(db!,{...request,mode:'apply',expectedFingerprint:preview.fingerprint});
    expect(applied.approved).toBe(1);
    const [audit]=await db!.select().from(schema.auditLogs).where(sql`${schema.auditLogs.action}='editorial.product_binding.approved' and ${schema.auditLogs.entityId}=${bindingId}`);
    expect(audit.metadata).toMatchObject({approvalBasis:'owner_standing_authorization',approvalReference:FACTORY_STANDING_REVIEW_REFERENCE,
      sourceProgramReference:OFFICIAL_COURSE_STANDING_REFERENCE,humanReview:false,humanReviewRecorded:false});
    expect((await db!.execute<{kind:string}>(sql`select jsonb_typeof(metadata) kind from audit_logs where id=${audit.id}`))[0].kind).toBe('object');
    expect((await db!.select().from(schema.contestStoreProducts).where(eq(schema.contestStoreProducts.slug,slug)))[0].status).toBe('draft');
    expect((await db!.execute<{count:number}>(sql`select ${approvedProductQuestionCount(sql`${slug}`)}::int count`))[0].count).toBe(1);
  });
  it('inclui produto novo sem inventar fonte e não duplica ordens nem aprova produtos',async()=>{
    const slug=`intake-test-${randomUUID()}`;
    await db!.insert(schema.contestStoreProducts).values({slug});
    const before=(await db!.select().from(schema.contestStoreProducts).where(eq(schema.contestStoreProducts.slug,slug)))[0];
    const first=await prepareCourseIntake(db!);
    expect(first.enqueued).toBeGreaterThan(0);
    expect((await prepareCourseIntake(db!)).enqueued).toBe(0);
    const [job]=await db!.execute<{status:string;payload:AgentWorkPayload}>(sql`select status,payload from editorial_agent_work where job_key=${`course-intake:${slug}`}`);
    expect(job.status).toBe('blocked');
    expect(job.payload.context.productSlug).toBe(slug);
    expect(job.payload.context.minimumQuestionCount).toBe(68);
    expect(job.payload.sourceUrls).toEqual([]);
    const after=(await db!.select().from(schema.contestStoreProducts).where(eq(schema.contestStoreProducts.slug,slug)))[0];
    expect(after).toEqual(before);
    await db!.delete(schema.contestStoreProducts).where(eq(schema.contestStoreProducts.slug,slug));
  });
  it('cria entrada com papel restrito e não reinicia pesquisa de produto retirado',async()=>{
    const slug='tj-rs-juiz-de-direito-2026';
    await db!.insert(schema.contestStoreProducts).values({slug}).onConflictDoNothing();
    const restrictedClient=postgres(url!,{max:1,prepare:false,connection:{options:'-c role=leiprova_app'}});
    try {
      const restricted=drizzle(restrictedClient,{schema});
      await prepareCourseIntake(restricted);
      const [job]=await db!.execute<{status:string}>(sql`select status from editorial_agent_work where job_key=${`course-intake:${slug}`}`);
      expect(job.status).toBe('pending');
      await db!.update(schema.contestStoreProducts).set({status:'retired'}).where(eq(schema.contestStoreProducts.slug,slug));
      await prepareCourseIntake(restricted);
      const [retired]=await db!.execute<{status:string}>(sql`select status from editorial_agent_work where job_key=${`course-intake:${slug}`}`);
      expect(retired.status).toBe('superseded');
    }finally{await restrictedClient.end();}
    await db!.delete(schema.contestStoreProducts).where(eq(schema.contestStoreProducts.slug,slug));
  });
  it('reserva concorrente não duplica tarefa e respeita papel',async()=>{
    await enqueueAgentWork(db!,'test:1','discovery',discoveryPayload());
    expect((await claimAgentWork(db!,new Date(),'Autor')).state).toBe('idle');
    const claims=await Promise.all(Array.from({length:4},()=>claimAgentWork(db!,new Date(),'Radar')));
    expect(claims.filter(x=>x.state==='claimed')).toHaveLength(1);
  });
  it.each(['missing','suspended'] as const)('prioridade de mapeamento exige contrato vigente e disciplina conhecida (%s)',async(contractState)=>{
    const future=(days:number)=>new Date(Date.now()+days*86400000).toISOString().slice(0,10);
    const waiting=await fixture(contractState==='missing',future(30));
    const unknown=await fixture(false,future(30));
    const ready=await fixture(false,future(60));
    if(contractState==='suspended')await db!.update(schema.opportunityQuestionContracts).set({status:'suspended'})
      .where(eq(schema.opportunityQuestionContracts.id,waiting.contractId));
    await db!.update(schema.opportunityRequirements).set({subjectId:null,topicId:null})
      .where(eq(schema.opportunityRequirements.id,unknown.requirement.id));
    for(const f of [waiting,unknown,ready])await enqueueAgentWork(db!,`mapping:${f.requirement.id}`,'legal_mapping',f.payload);
    // Uma mudança legal conserva precedência sobre qualquer mapeamento pronto.
    const changeKey=`legal-change:${randomUUID()}`;
    await enqueueAgentWork(db!,changeKey,'legal_change',discoveryPayload());
    expect(await claimAgentWork(db!,new Date(),'Guardião')).toMatchObject({state:'claimed',job:{jobKey:changeKey}});
    expect(await claimAgentWork(db!,new Date(),'Guardião')).toMatchObject({state:'claimed',job:{jobKey:`mapping:${ready.requirement.id}`}});
    // Prioridade é ordenação, não exclusão nem reconstrução do pacote/hash.
    for(const f of [waiting,unknown]){
      const [work]=await db!.execute<{status:string;inputHash:string}>(sql`select status,input_hash as "inputHash"
        from editorial_agent_work where job_key=${`mapping:${f.requirement.id}`}`);
      expect(work).toMatchObject({status:'pending',inputHash:agentInputHash(f.payload)});
    }
    expect(await claimAgentWork(db!,new Date(),'Guardião')).toMatchObject({state:'claimed',job:{jobKey:`mapping:${waiting.requirement.id}`}});
    expect(await claimAgentWork(db!,new Date(),'Guardião')).toMatchObject({state:'claimed',job:{jobKey:`mapping:${unknown.requirement.id}`}});
  });
  it('prontidão autoral do mapeamento não ultrapassa a faixa de produto',async()=>{
    const waiting=await fixture(true),ready=await fixture();
    await db!.insert(schema.contestStoreProducts).values([
      {slug:`priority-draft-${randomUUID()}`,opportunityId:waiting.requirement.opportunityId},
      {slug:`priority-released-${randomUUID()}`,opportunityId:ready.requirement.opportunityId,status:'released',
        releasedAt:new Date(),releasedByUserId:ready.editor.id},
    ]);
    for(const f of [ready,waiting])await enqueueAgentWork(db!,`mapping:${f.requirement.id}`,'legal_mapping',f.payload);
    expect(await claimAgentWork(db!,new Date(),'Guardião')).toMatchObject({state:'claimed',job:{jobKey:`mapping:${waiting.requirement.id}`}});
    expect(await claimAgentWork(db!,new Date(),'Guardião')).toMatchObject({state:'claimed',job:{jobKey:`mapping:${ready.requirement.id}`}});
  });
  it('mudança de escopo do intake não substitui o lease ativo do Radar',async()=>{
    const slug=`intake-lease-${randomUUID()}`;
    await db!.insert(schema.contestStoreProducts).values({slug});await prepareCourseIntake(db!);
    const key=`course-intake:${slug}`;
    // Produto sintético sem pesquisa nasce bloqueado; a reserva abaixo testa
    // somente concorrência/escopo, sem inventar fonte ou aprová-lo.
    await db!.execute(sql`update editorial_agent_work set status='blocked' where status='pending' and job_key<>${key}`);
    await db!.execute(sql`update editorial_agent_work set status='pending' where job_key=${key}`);
    const claim=await claimAgentWork(db!,new Date(),'Radar');if(claim.state!=='claimed')throw new Error('Reserva ausente');
    expect(claim.job.jobKey).toBe(key);
    await db!.update(schema.contestStoreProducts).set({status:'retired'}).where(eq(schema.contestStoreProducts.slug,slug));
    await prepareCourseIntake(db!);
    const [work]=await db!.execute<{status:string;hash:string;token:string}>(sql`select status,input_hash hash,lease_token::text token from editorial_agent_work where job_key=${key}`);
    expect(work).toMatchObject({status:'running',hash:claim.job.inputHash,token:claim.job.leaseToken});
  });
  it('não substitui uma reserva ativa e admite nova entrada somente depois da conclusão',async()=>{
    const payload=discoveryPayload();await enqueueAgentWork(db!,'test:1','discovery',payload);
    const claim=await claimAgentWork(db!);if(claim.state!=='claimed')throw new Error('Reserva ausente');
    expect(await enqueueAgentWork(db!,'test:1','discovery',{...payload,title:'Outra edição'})).toBe(false);
    const [running]=await db!.execute<{inputHash:string;leaseToken:string;status:string}>(sql`select input_hash as "inputHash",lease_token::text as "leaseToken",status from editorial_agent_work where job_key='test:1'`);
    expect(running).toMatchObject({inputHash:claim.job.inputHash,leaseToken:claim.job.leaseToken,status:'running'});
    await expect(completeAgentWork(db!,{...claim.job,result:base})).resolves.toMatchObject({state:'prepared'});
    await expect(completeAgentWork(db!,{...claim.job,result:base})).resolves.toMatchObject({state:'prepared',replayed:true});
    expect(await enqueueAgentWork(db!,'test:1','discovery',{...payload,title:'Outra edição'})).toBe(true);
    expect((await claimAgentWork(db!)).state).toBe('claimed');
  });
  it('retoma lease vencido e para após três tentativas',async()=>{
    await enqueueAgentWork(db!,'test:1','discovery',discoveryPayload());const now=new Date();
    const afterLeaseMs=(AGENT_WORK_LEASE_MINUTES+1)*60000;
    for(let i=0;i<3;i++)expect((await claimAgentWork(db!,new Date(now.getTime()+i*afterLeaseMs))).state).toBe('claimed');
    expect((await claimAgentWork(db!,new Date(now.getTime()+3*afterLeaseMs))).state).toBe('idle');
    expect((await db!.execute<{status:string}>(sql`select status from editorial_agent_work`))[0].status).toBe('failed');
  });
  it('continua após 48 reservas e mantém auditoria sem limite diário',async()=>{
    for(let i=0;i<50;i++)await enqueueAgentWork(db!,`test:${i}`,'discovery',discoveryPayload());
    for(let i=0;i<48;i++)expect((await claimAgentWork(db!)).state).toBe('claimed');
    const next=await Promise.all([claimAgentWork(db!),claimAgentWork(db!)]);
    expect(next.map(item=>item.state)).toEqual(['claimed','claimed']);
    expect(new Set(next.flatMap(item=>item.state==='claimed'?[item.job.jobKey]:[])).size).toBe(2);
    expect((await claimAgentWork(db!)).state).toBe('idle');
    expect(AGENT_WORK_DAILY_LIMIT).toBeNull();
    expect((await agentWorkSummary(db!)).budget).toEqual({used:50,limit:null});
  },30000);
  it('Autor trabalha em produto liberado mesmo com mapeamento de outro produto pendente',async()=>{
    const author=await fixture(),waiting=await fixture();
    await db!.insert(schema.contestStoreProducts).values([
      {slug:`author-released-${randomUUID()}`,opportunityId:author.requirement.opportunityId,status:'released',
        releasedAt:new Date(),releasedByUserId:author.editor.id},
      {slug:`mapping-draft-${randomUUID()}`,opportunityId:waiting.requirement.opportunityId},
    ]);
    await enqueueAgentWork(db!,`mapping:${waiting.requirement.id}`,'legal_mapping',waiting.payload);
    await enqueueAgentWork(db!,`author:${author.requirement.id}`,'authoring',author.payload);
    const claim=await claimAgentWork(db!,new Date(),'Autor');
    expect(claim).toMatchObject({state:'claimed',agent:'Autor',job:{jobKey:`author:${author.requirement.id}`}});
    const [mapping]=await db!.execute<{status:string}>(sql`select status from editorial_agent_work where job_key=${`mapping:${waiting.requirement.id}`}`);
    expect(mapping.status).toBe('pending');
  });
  it('rejeita lei revogada durante a tarefa',async()=>{
    const f=await fixture();await enqueueAgentWork(db!,'mapping:test','legal_mapping',f.payload);
    const claim=await claimAgentWork(db!);if(claim.state!=='claimed')throw new Error('Reserva ausente');
    await db!.update(schema.legalVersions).set({status:'revoked'}).where(eq(schema.legalVersions.id,f.version.id));
    expect((await completeAgentWork(db!,{...claim.job,result:{...base,mappings:[{articleId:f.article.id,quote:f.article.literalText,rationale:'Vínculo sintético.'}]}})).state).toBe('superseded');
  });
  it('cria rascunho no concurso exato sem aprovar requisito ou publicar',async()=>{
    const f=await fixture();await enqueueAgentWork(db!,`author:${f.requirement.id}`,'authoring',f.payload);
    const claim=await claimAgentWork(db!);if(claim.state!=='claimed')throw new Error('Reserva ausente');
    const question={prompt:`No exercício fictício identificado como ${randomUUID()}, qual ato precede a atividade?`,articleId:f.article.id,quote:f.article.literalText,explanation:'A regra sintética exige organizar cartões antes de começar a atividade.',difficulty:'easy',options:['Organizar cartões','Ignorar o preparo','Interromper todos','Guardar a tarefa','Começar sem organização'].map((text,i)=>({key:'ABCDE'[i],text,correct:i===0,rationale:'Justificativa sintética usada exclusivamente neste teste.'}))};
    const receipt=await completeAgentWork(db!,{...claim.job,result:{...base,generatorModel:'synthetic-test',questions:[question]}});
    expect(receipt.state).toBe('prepared');
    const replay=await completeAgentWork(db!,{...claim.job,result:{...base,generatorModel:'synthetic-test',questions:[question]}});
    expect(replay).toMatchObject({state:'prepared',replayed:true});
    await expect(completeAgentWork(db!,{...claim.job,result:{...base,summary:'Resposta alterada',generatorModel:'synthetic-test',questions:[question]}})).rejects.toThrow();
    const [saved]=await db!.select().from(schema.questions).where(eq(schema.questions.prompt,question.prompt));
    expect(saved.editorialStatus).toBe('draft');expect(saved.reviewedByUserId).toBeNull();expect(saved.cleanRoomAttestedAt).toBeNull();
    expect(saved.questionContractId).toBe(f.contractId);
    const [link]=await db!.select().from(schema.questionOpportunities).where(eq(schema.questionOpportunities.questionId,saved.id));
    expect(link.opportunityId).toBe(f.payload.opportunityId);
    const [requirement]=await db!.select().from(schema.opportunityRequirements).where(eq(schema.opportunityRequirements.id,f.requirement.id));
    expect(requirement.editorialStatus).toBe('draft');expect(requirement.legalArticleId).toBeNull();
  });
  it('não reserva autoria com banca conhecida mas sem contrato oficial',async()=>{
    const f=await fixture();
    await enqueueAgentWork(db!,`author:${f.requirement.id}`,'authoring',{...f.payload,questionContractId:undefined,questionContract:undefined});
    expect((await claimAgentWork(db!,new Date(),'Autor')).state).toBe('idle');
    const [work]=await db!.execute<{status:string;attempts:number}>(sql`select status,attempts from editorial_agent_work where job_key=${`author:${f.requirement.id}`}`);
    expect(work).toMatchObject({status:'pending',attempts:0});
  });
  it('lease legado sem contrato conclui BLOCKED honestamente sem importar questões',async()=>{
    const f=await fixture(),payload={...f.payload,questionContractId:undefined,questionContract:undefined};
    const key=`author:${f.requirement.id}`,leaseToken=randomUUID();
    await enqueueAgentWork(db!,key,'authoring',payload);
    // Simula a reserva existente anterior ao deploy, sem reabrir nem mudar seu inputHash.
    await db!.execute(sql`update editorial_agent_work set status='running',attempts=1,lease_token=${leaseToken}::uuid,
      lease_expires_at=now()+${AGENT_WORK_LEASE_MINUTES}*interval '1 minute' where job_key=${key}`);
    const receipt=await completeAgentWork(db!,{jobKey:key,inputHash:agentInputHash(payload),leaseToken,
      result:{...base,outcome:'blocked',limitations:['Formato oficial do cargo/etapa ainda não confirmado; nenhuma questão foi produzida.']}});
    expect(receipt).toMatchObject({state:'blocked',importedQuestionPublicIds:[],publicationAllowed:false});
  });
  it('contrato suspenso durante o lease impede importar e mantém a auditoria histórica',async()=>{
    const f=await fixture(),other=await fixture();
    expect(other.contractId).not.toBe(f.contractId); // Outro contrato válido não autoriza o suspenso.
    await enqueueAgentWork(db!,`author:${f.requirement.id}`,'authoring',f.payload);
    const claim=await claimAgentWork(db!,new Date(),'Autor');if(claim.state!=='claimed')throw new Error('Reserva ausente');
    await db!.update(schema.opportunityQuestionContracts).set({status:'suspended'}).where(eq(schema.opportunityQuestionContracts.id,f.contractId));
    const question={prompt:`Caso sintético isolado ${randomUUID()}: que ato precede a atividade?`,articleId:f.article.id,quote:f.article.literalText,
      explanation:'A regra sintética determina organizar cartões antes de começar a atividade.',difficulty:'easy',
      options:['Organizar cartões','Ignorar o preparo','Interromper todos','Guardar a tarefa','Começar sem organização'].map((text,i)=>({key:'ABCDE'[i],text,correct:i===0,rationale:'Justificativa sintética para teste sem publicação.'}))};
    expect((await completeAgentWork(db!,{...claim.job,result:{...base,generatorModel:'synthetic-test',questions:[question]}})).state).toBe('superseded');
    expect(await db!.select({id:schema.questions.id}).from(schema.questions).where(eq(schema.questions.prompt,question.prompt))).toHaveLength(0);
  });
  it('atribuição do examinador encerrada durante o lease impede importar',async()=>{
    const f=await fixture();await enqueueAgentWork(db!,`author:${f.requirement.id}`,'authoring',f.payload);
    const claim=await claimAgentWork(db!,new Date(),'Autor');if(claim.state!=='claimed')throw new Error('Reserva ausente');
    await reviewAssignmentValidity(f,'2026-10-12');
    const question={prompt:`Caso de examinador sintético ${randomUUID()}: que ato precede a atividade?`,articleId:f.article.id,quote:f.article.literalText,
      explanation:'A regra sintética determina organizar cartões antes de começar a atividade.',difficulty:'easy',
      options:['Organizar cartões','Ignorar o preparo','Interromper todos','Guardar a tarefa','Começar sem organização'].map((text,i)=>({key:'ABCDE'[i],text,correct:i===0,rationale:'Justificativa sintética para teste sem publicação.'}))};
    expect((await completeAgentWork(db!,{...claim.job,result:{...base,generatorModel:'synthetic-test',questions:[question]}})).state).toBe('superseded');
    expect(await db!.select({id:schema.questions.id}).from(schema.questions).where(eq(schema.questions.prompt,question.prompt))).toHaveLength(0);
  });
  it('aprovação concorrente respeita oportunidade antes de questão sem formar ciclo de locks',async()=>{
    const f=await fixture();
    const [question]=await db!.insert(schema.questions).values({publicId:randomUUID(),legalArticleId:f.article.id,
      subjectId:f.requirement.subjectId,topicId:f.requirement.topicId,quizMode:'original_style',styleBankId:f.contract.bankId,
      questionContractId:f.contractId,type:'multiple_choice',prompt:`Somente concorrência sintética ${randomUUID()}`,
      explanation:'Este rascunho serve exclusivamente para verificar a ordem de locks.',learningObjective:'Teste de locks.',topic:'QA',
      originalityCheckedAt:new Date(),verifiedAt:new Date()}).returning();
    const scope={questionIds:[question.id],legalArticleIds:[],styleBankIds:[]};
    let signalOpportunity!:()=>void,releaseOpportunity!:()=>void,signalSecond!:()=>void;
    const opportunityReady=new Promise<void>(resolve=>{signalOpportunity=resolve;});
    const opportunityRelease=new Promise<void>(resolve=>{releaseOpportunity=resolve;});
    const secondReady=new Promise<void>(resolve=>{signalSecond=resolve;});
    let opportunityLocked=false,secondPid=0;
    const first=db!.transaction(async tx=>{
      await tx.execute(sql`set local statement_timeout='10s'`);
      await lockQuestionContracts(tx,[f.contractId]);
      opportunityLocked=true;signalOpportunity();
      await opportunityRelease;
      await lockApprovalScope(tx,scope);
    }).finally(signalOpportunity);
    await opportunityReady;
    if(!opportunityLocked){releaseOpportunity();await first;throw new Error('Contrato não reservado no teste.');}
    const second=db!.transaction(async tx=>{
      await tx.execute(sql`set local statement_timeout='10s'`);
      const [backend]=await tx.execute<{pid:number}>(sql`select pg_backend_pid()::int pid`);
      secondPid=backend.pid;signalSecond();
      await lockApprovalScope(tx,scope);
    }).finally(signalSecond);
    const completions=Promise.allSettled([first,second]);
    let secondBlocked=false;
    try {
      await secondReady;
      for(let attempt=0;attempt<100;attempt++){
        const [wait]=await db!.execute<{blocked:boolean}>(sql`select cardinality(pg_blocking_pids(${secondPid}))>0 blocked`);
        if(wait.blocked){secondBlocked=true;break;}
        await new Promise(resolve=>setTimeout(resolve,20));
      }
    }finally{releaseOpportunity();}
    const outcomes=await completions;
    // A ordem antiga q→o deixa a segunda transação segurando q; quando a
    // primeira (o→q) avança, o PostgreSQL detecta deadlock e este teste falha.
    expect(secondBlocked).toBe(true);
    expect(outcomes.map(outcome=>outcome.status)).toEqual(['fulfilled','fulfilled']);
    expect((await db!.select({status:schema.questions.editorialStatus}).from(schema.questions)
      .where(eq(schema.questions.id,question.id)))[0].status).toBe('draft');
  },15000);
  it('JSONB mantém objetos/arrays e certificação adicional revalida formato, fonte e hash sem tocar fotografia',async()=>{
    const f=await fixture(),now=new Date(),slug=`agent-contract-${randomUUID()}`;
    const [source]=await db!.select().from(schema.opportunitySourceDocuments).where(eq(schema.opportunitySourceDocuments.id,f.requirement.sourceDocumentId));
    const [editor]=await db!.select({id:schema.users.id}).from(schema.users).where(eq(schema.users.id,source.reviewedByUserId!));
    await db!.update(schema.opportunityRequirements).set({editorialStatus:'reviewed',legalArticleId:f.article.id,legalActId:f.version.legalActId,
      reviewedByUserId:editor.id,reviewedAt:now,reviewNotes:'Revisão sintética exclusiva do teste de software.'}).where(eq(schema.opportunityRequirements.id,f.requirement.id));
    await db!.insert(schema.contestStoreProducts).values({slug,opportunityId:f.requirement.opportunityId});
    const [question]=await db!.insert(schema.questions).values({publicId:randomUUID(),legalArticleId:f.article.id,
      subjectId:f.requirement.subjectId,topicId:f.requirement.topicId,quizMode:'original_style',styleBankId:f.contract.bankId,
      questionContractId:f.contractId,type:'multiple_choice',prompt:`Pergunta sintética isolada de formato ${randomUUID()}`,
      explanation:'Explicação sintética suficiente para o teste de integridade do contrato.',learningObjective:'Verificar contrato sintético.',topic:'QA',
      editorialStatus:'reviewed',createdByUserId:editor.id,reviewedByUserId:editor.id,cleanRoomAttestedAt:now,
      submittedAt:now,sourceUrl:f.version.sourceUrl,sourceTitle:'Fonte sintética sem validade jurídica',originalityCheckedAt:now,verifiedAt:now}).returning();
    const options='ABCDE'.split('').map((optionKey,sortOrder)=>({optionKey,text:`Alternativa sintética ${sortOrder}`,
      isCorrect:sortOrder===0,rationale:'Justificativa sintética do teste de software.',sortOrder}));
    await db!.insert(schema.questionOptions).values(options.map(option=>({...option,questionId:question.id})));
    const bindingId=hash(slug);
    await db!.insert(schema.contestProductQuestionBindings).values({id:bindingId,productSlug:slug,opportunityId:f.requirement.opportunityId,
      requirementId:f.requirement.id,questionId:question.id,sourceDocumentId:source.id,sourceSnapshotId:f.requirement.sourceSnapshotId,
      sourceSnapshotChecksum:f.contract.sourceSnapshotChecksum,legalArticleId:f.article.id,legalVersionId:f.version.id,
      legalVersionChecksum:f.version.checksumSha256,questionUpdatedAt:question.updatedAt,requirementText:f.requirement.requirementText,
      sourceLocator:f.requirement.sourceLocator,requirementQuote:f.requirement.requirementText,legalQuote:f.article.literalText,
      scopeNotes:'Fixture de contrato restrita ao banco de teste; sem curadoria jurídica.',evidence:{sourceUrl:source.sourceUrl,
        legalArticleText:f.article.literalText,legalSourceUrl:f.version.sourceUrl,questionContent:{prompt:question.prompt,
          explanation:question.explanation,type:question.type,learningObjective:question.learningObjective,options}},
      proposedByUserId:editor.id,status:'approved',reviewedByUserId:editor.id,reviewedAt:now,
      reviewNotes:'Revisão sintética, exclusiva deste banco de teste.'});
    const count=async()=>Number((await db!.execute<{count:number}>(sql`select ${approvedProductQuestionCount(sql`${slug}`)}::int count`))[0].count);
    expect(await count()).toBe(0);
    await db!.transaction(tx=>certifyProductBindingContracts(tx,[bindingId],editor.id,'synthetic-contract-certification-test'));
    expect(await count()).toBe(1);
    const [types]=await db!.execute<{payload:string;keys:string;audit:string}>(sql`select jsonb_typeof(c.payload) payload,
      jsonb_typeof(c.option_keys) keys,(select jsonb_typeof(metadata) from audit_logs where entity_id=${bindingId}
        and action='editorial.product_binding.question_contract.certified' order by id desc limit 1) audit
      from opportunity_question_contracts c where c.id=${f.contractId}`);
    expect(types).toEqual({payload:'object',keys:'array',audit:'object'});
    expect((await db!.select({updatedAt:schema.questions.updatedAt}).from(schema.questions).where(eq(schema.questions.id,question.id)))[0].updatedAt).toEqual(question.updatedAt);
    await db!.update(schema.opportunityQuestionContracts).set({status:'suspended'}).where(eq(schema.opportunityQuestionContracts.id,f.contractId));
    expect(await count()).toBe(0);
    await expect(db!.update(schema.opportunityQuestionContracts).set({format:'true_false',optionKeys:['A','B']})
      .where(eq(schema.opportunityQuestionContracts.id,f.contractId))).rejects.toMatchObject({
        cause:{code:'P0001',message:expect.stringContaining('imutável')},
      });
  });
  it('operador real simula CTE, rejeita evidência divergente e certifica legado idempotentemente sem tocar fotografia',async()=>{
    const f=await fixture(true),now=new Date(),slug=`operator-contract-${randomUUID()}`;
    await db!.update(schema.opportunityRequirements).set({editorialStatus:'reviewed',legalArticleId:f.article.id,legalActId:f.version.legalActId,
      reviewedByUserId:f.editor.id,reviewedAt:now,reviewNotes:'Somente teste sintético de software.'}).where(eq(schema.opportunityRequirements.id,f.requirement.id));
    await db!.insert(schema.contestStoreProducts).values({slug,opportunityId:f.requirement.opportunityId});
    const [question]=await db!.insert(schema.questions).values({publicId:randomUUID(),legalArticleId:f.article.id,
      subjectId:f.requirement.subjectId,topicId:f.requirement.topicId,quizMode:'dry_law',type:'multiple_choice',
      prompt:`Pergunta fictícia do operador ${randomUUID()}`,explanation:'Explicação sintética sem validade jurídica para verificar o operador.',
      learningObjective:'Teste de certificação adicional.',topic:'QA',editorialStatus:'reviewed',createdByUserId:f.editor.id,
      reviewedByUserId:f.editor.id,cleanRoomAttestedAt:now,sourceUrl:f.version.sourceUrl,sourceTitle:'Fonte sintética',verifiedAt:now}).returning();
    const options='ABCDE'.split('').map((optionKey,sortOrder)=>({optionKey,text:`Opção fictícia ${sortOrder}`,
      isCorrect:sortOrder===0,rationale:'Justificativa exclusivamente sintética.',sortOrder}));
    await db!.insert(schema.questionOptions).values(options.map(option=>({...option,questionId:question.id})));
    const bindingId=hash(slug);
    await db!.insert(schema.contestProductQuestionBindings).values({id:bindingId,productSlug:slug,opportunityId:f.requirement.opportunityId,
      requirementId:f.requirement.id,questionId:question.id,sourceDocumentId:f.source.id,sourceSnapshotId:f.snapshot.id,
      sourceSnapshotChecksum:f.contract.sourceSnapshotChecksum,legalArticleId:f.article.id,legalVersionId:f.version.id,
      legalVersionChecksum:f.version.checksumSha256,questionUpdatedAt:question.updatedAt,requirementText:f.requirement.requirementText,
      sourceLocator:f.requirement.sourceLocator,requirementQuote:f.requirement.requirementText,legalQuote:f.article.literalText,
      scopeNotes:'Teste sintético sem validade jurídica.',evidence:{sourceUrl:f.source.sourceUrl,legalArticleText:f.article.literalText,
        legalSourceUrl:f.version.sourceUrl,questionContent:{prompt:question.prompt,explanation:question.explanation,
          type:question.type,learningObjective:question.learningObjective,options}},proposedByUserId:f.editor.id,status:'approved',
      reviewedByUserId:f.editor.id,reviewedAt:now,reviewNotes:'Somente fixture sintética.'});
    const request={input:{contract:f.contract,productSlug:slug},actorPublicId:f.editor.publicId,
      approvalReference:OFFICIAL_COURSE_STANDING_REFERENCE,mode:'preview' as const};
    const preview=await reviewOfficialQuestionContract(db!,request);
    expect(preview).toMatchObject({contractId:f.contractId,validQuestionCount:1,humanReview:false,publicationAllowed:false});
    expect(preview.certificates.map(row=>row.id)).toEqual([bindingId]);
    expect((await reviewOfficialQuestionContract(db!,request)).fingerprint).toBe(preview.fingerprint);
    expect(await db!.select().from(schema.opportunityQuestionContracts).where(eq(schema.opportunityQuestionContracts.id,f.contractId))).toHaveLength(0);
    await expect(reviewOfficialQuestionContract(db!,{...request,mode:'apply',expectedFingerprint:'0'.repeat(64)})).rejects.toThrow('preview');
    await expect(reviewOfficialQuestionContract(db!,{...request,input:{...request.input,contract:{...f.contract,sourcePage:2}}})).rejects.toThrow('não confirmados');
    // Nova captura sintética com checksum declarado incompatível com os bytes.
    // Não se edita nem se desliga a imutabilidade da captura já aprovada.
    const [badSnapshot]=await db!.insert(schema.opportunityDocumentSnapshots).values({publicId:randomUUID(),
      sourceDocumentId:f.source.id,documentUrl:f.snapshot.documentUrl,sourceHost:f.snapshot.sourceHost,
      fileName:'synthetic-invalid-checksum.pdf',mimeType:'application/pdf',documentBytes:f.snapshot.documentBytes,
      checksumSha256:'b'.repeat(64),byteLength:f.snapshot.byteLength,pageCount:f.snapshot.pageCount,
      extractedText:f.snapshot.extractedText,pageTexts:f.snapshot.pageTexts,textLength:f.snapshot.textLength,
      parserVersion:'synthetic-test-no-legal-validity',authorizationScope:f.snapshot.authorizationScope,
      authorizedAt:now,status:'approved',reviewedByUserId:f.editor.id,reviewedAt:now,reviewNotes:'Captura inválida deliberada para testar SHA dos bytes.'}).returning();
    await expect(reviewOfficialQuestionContract(db!,{...request,input:{...request.input,contract:{...f.contract,
      sourceSnapshotId:badSnapshot.id,sourceSnapshotChecksum:badSnapshot.checksumSha256}}})).rejects.toThrow('não confirmados');
    await reviewAssignmentValidity(f,'2026-10-12');
    await expect(reviewOfficialQuestionContract(db!,request)).rejects.toThrow('não confirmados');
    await reviewAssignmentValidity(f,null);
    const fresh=await reviewOfficialQuestionContract(db!,request);
    const applied=await reviewOfficialQuestionContract(db!,{...request,mode:'apply',expectedFingerprint:fresh.fingerprint});
    expect(applied.validQuestionCount).toBe(1);
    expect((await reviewOfficialQuestionContract(db!,request)).fingerprint).toBe(fresh.fingerprint);
    await expect(reviewOfficialQuestionContract(db!,{...request,mode:'apply',expectedFingerprint:fresh.fingerprint})).resolves.toMatchObject({validQuestionCount:1});
    const [certificate]=await db!.select().from(schema.questionContractCertifications).where(eq(schema.questionContractCertifications.bindingId,bindingId));
    expect(certificate.humanReview).toBe(false);
    expect((await db!.select().from(schema.questions).where(eq(schema.questions.id,question.id)))[0]).toMatchObject({questionContractId:null,updatedAt:question.updatedAt});
    const [valid]=await db!.execute<{count:number}>(sql`select ${approvedProductQuestionCount(sql`${slug}`)}::int count`);
    expect(Number(valid.count)).toBe(1);
  });
  it('certificar o produto A não concede vínculos nem certificações ao produto B de outro cargo',async()=>{
    async function productFixture(type:'multiple_choice'|'true_false',suspended=false){
      const f=await fixture(true),now=new Date(),slug=`isolated-product-${randomUUID()}`;
      await db!.update(schema.opportunityRequirements).set({editorialStatus:'reviewed',legalArticleId:f.article.id,legalActId:f.version.legalActId,
        reviewedByUserId:f.editor.id,reviewedAt:now,reviewNotes:'Somente fixture sintética isolada.'}).where(eq(schema.opportunityRequirements.id,f.requirement.id));
      await db!.insert(schema.contestStoreProducts).values({slug,opportunityId:f.requirement.opportunityId});
      const [question]=await db!.insert(schema.questions).values({publicId:randomUUID(),legalArticleId:f.article.id,
        subjectId:f.requirement.subjectId,topicId:f.requirement.topicId,quizMode:'dry_law',type,
        prompt:`Pergunta fictícia de isolamento ${randomUUID()}`,explanation:'Explicação sintética exclusivamente para verificar isolamento entre produtos.',
        learningObjective:'Isolamento de certificações comerciais.',topic:'QA',editorialStatus:suspended?'suspended':'reviewed',createdByUserId:f.editor.id,
        reviewedByUserId:f.editor.id,cleanRoomAttestedAt:now,sourceUrl:f.version.sourceUrl,sourceTitle:'Fonte sintética',verifiedAt:now}).returning();
      const options=(type==='multiple_choice'?'ABCDE':'AB').split('').map((optionKey,sortOrder)=>({optionKey,
        text:type==='true_false'?(sortOrder===0?'Certo':'Errado'):`Opção sintética isolada ${sortOrder}`,
        isCorrect:sortOrder===0,rationale:'Justificativa fictícia de software.',sortOrder}));
      await db!.insert(schema.questionOptions).values(options.map(option=>({...option,questionId:question.id})));
      const bindingId=hash(slug);
      await db!.insert(schema.contestProductQuestionBindings).values({id:bindingId,productSlug:slug,opportunityId:f.requirement.opportunityId,
        requirementId:f.requirement.id,questionId:question.id,sourceDocumentId:f.source.id,sourceSnapshotId:f.snapshot.id,
        sourceSnapshotChecksum:f.contract.sourceSnapshotChecksum,legalArticleId:f.article.id,legalVersionId:f.version.id,
        legalVersionChecksum:f.version.checksumSha256,questionUpdatedAt:question.updatedAt,requirementText:f.requirement.requirementText,
        sourceLocator:f.requirement.sourceLocator,requirementQuote:f.requirement.requirementText,legalQuote:f.article.literalText,
        scopeNotes:'Somente teste sintético, sem publicação.',evidence:{sourceUrl:f.source.sourceUrl,legalArticleText:f.article.literalText,
          legalSourceUrl:f.version.sourceUrl,questionContent:{prompt:question.prompt,explanation:question.explanation,
            type:question.type,learningObjective:question.learningObjective,options}},proposedByUserId:f.editor.id,status:'approved',
        reviewedByUserId:f.editor.id,reviewedAt:now,reviewNotes:'Revisão fictícia para isolamento.'});
      const request={input:{contract:f.contract,productSlug:slug},actorPublicId:f.editor.publicId,
        approvalReference:OFFICIAL_COURSE_STANDING_REFERENCE,mode:'preview' as const};
      return{...f,slug,question,bindingId,request};
    }
    const a=await productFixture('multiple_choice'),b=await productFixture('true_false',true);
    const beforeB=await reviewOfficialQuestionContract(db!,b.request);
    expect(beforeB).toMatchObject({validQuestionCount:0,certificates:[]});
    const previewA=await reviewOfficialQuestionContract(db!,a.request);
    expect(previewA.validQuestionCount).toBe(1);expect(previewA.certificates.map(row=>row.id)).toEqual([a.bindingId]);
    await reviewOfficialQuestionContract(db!,{...a.request,mode:'apply',expectedFingerprint:previewA.fingerprint});
    const afterB=await reviewOfficialQuestionContract(db!,b.request);
    expect(afterB).toMatchObject({validQuestionCount:0,certificates:[],fingerprint:beforeB.fingerprint});
    expect(await db!.select().from(schema.questionContractCertifications).where(eq(schema.questionContractCertifications.bindingId,b.bindingId))).toHaveLength(0);
    expect(await db!.select().from(schema.opportunityQuestionContracts).where(eq(schema.opportunityQuestionContracts.id,b.contractId))).toHaveLength(0);
    const repeatedA=await reviewOfficialQuestionContract(db!,a.request);
    expect(repeatedA.fingerprint).toBe(previewA.fingerprint);expect(repeatedA.certificates.map(row=>row.id)).toEqual([a.bindingId]);
    await reviewOfficialQuestionContract(db!,{...a.request,mode:'apply',expectedFingerprint:repeatedA.fingerprint});
    expect(await db!.select().from(schema.questionContractCertifications).where(eq(schema.questionContractCertifications.bindingId,a.bindingId))).toHaveLength(1);
    const [counts]=await db!.execute<{a:number;b:number;foreign:boolean}>(sql`select
      ${approvedProductQuestionCount(sql`${a.slug}`)}::int a,${approvedProductQuestionCount(sql`${b.slug}`)}::int b,
      ${approvedProductQuestionExists(sql`${a.slug}`,sql`${a.question.id}`,sql`${a.requirement.opportunityId}`,sql`${b.bindingId}`)} as foreign`);
    expect(counts).toEqual({a:1,b:0,foreign:false});
    // O alias do operador real deve continuar referindo a linha externa.
    const scope=await db!.execute<{id:string;allowed:boolean}>(sql`select binding.id,
      ${approvedProductQuestionExists(sql`binding.product_slug`,sql`binding.question_id`,sql`binding.opportunity_id`,sql`binding.id`)} allowed
      from contest_product_question_bindings binding where binding.id in (${a.bindingId},${b.bindingId}) order by binding.id`);
    expect(scope.find(row=>row.id===a.bindingId)?.allowed).toBe(true);
    expect(scope.find(row=>row.id===b.bindingId)?.allowed).toBe(false);
  });
  it('opções MC5 preservam letras s e recusam duplicatas diferenciadas só por newline interno',async()=>{
    const f=await fixture();
    const [question]=await db!.insert(schema.questions).values({publicId:randomUUID(),legalArticleId:f.article.id,
      subjectId:f.requirement.subjectId,topicId:f.requirement.topicId,quizMode:'dry_law',type:'multiple_choice',
      prompt:'Questão fictícia para testar normalização de espaços.',explanation:'Texto exclusivamente sintético para testar integridade de alternativas.',
      learningObjective:'Preservar palavras e rejeitar opções repetidas.',topic:'QA',verifiedAt:new Date()}).returning();
    const texts=['casas aqui','ca a  aqui','Alternativa alfa','Alternativa beta','Alternativa gama'];
    await db!.insert(schema.questionOptions).values(texts.map((text,sortOrder)=>({questionId:question.id,optionKey:'ABCDE'[sortOrder],
      text,isCorrect:sortOrder===0,rationale:'Justificativa sintética.',sortOrder})));
    const valid=async()=>(await db!.execute<{allowed:boolean}>(sql`select
      ${questionOptionsMatchContract(sql`${question.id}`,sql`${question.type}`,sql`${f.contractId}`)} allowed`))[0].allowed;
    expect(await valid()).toBe(true);
    await db!.update(schema.questionOptions).set({text:'casas\n aqui'}).where(sql`${schema.questionOptions.questionId}=${question.id} and ${schema.questionOptions.optionKey}='B'`);
    expect(await valid()).toBe(false);
  });
  it('preparação repetida é idempotente e descobre portais sem gastar API',async()=>{
    const f=await fixture();
    const first=await prepareAgentWork(db!);const repeated=await prepareAgentWork(db!);
    expect(first.discovery).toBe(4);expect(repeated.discovery).toBe(0);expect(repeated.mappings).toBe(0);
    const [mapping]=await db!.execute<{payload:AgentWorkPayload}>(sql`select payload from editorial_agent_work where job_key=${`mapping:${f.requirement.id}`}`);
    expect(mapping.payload.requirementId).toBe(f.requirement.id);expect(mapping.payload.articles.length).toBeGreaterThan(0);
    expect(mapping.payload.context.humanReviewRequired).toBe(true);
    const [blocked]=await db!.execute<{status:string}>(sql`select status from editorial_agent_work where kind='discovery' and payload->'context'->>'bank'='vunesp'`);
    expect(blocked.status).toBe('blocked');
  },30000);
  it('cache evita repetir retrieval e invalida texto legal, revogação e retificação do programa',async()=>{
    const f=await fixture();await prepareAgentWork(db!);
    const digest=async()=>((await db!.execute<{hash:string}>(AGENT_PREPARATION_CORPUS_HASH_SQL))[0]).hash;
    const firstHash=await digest();
    expect((await db!.execute<{id:number}>(mappingPreparationBatchQuery(firstHash,100))).some(row=>row.id===f.requirement.id)).toBe(false);
    // Mesmo sem alterar updated_at, o corpo oficial diferente invalida o cache.
    await db!.update(schema.legalArticles).set({literalText:f.article.literalText+' Informação sintética adicional.'}).where(eq(schema.legalArticles.id,f.article.id));
    const changedHash=await digest();expect(changedHash).not.toBe(firstHash);
    expect((await db!.execute<{id:number}>(mappingPreparationBatchQuery(changedHash,100))).some(row=>row.id===f.requirement.id)).toBe(true);
    await prepareAgentWork(db!);
    await db!.update(schema.legalVersions).set({status:'superseded'}).where(eq(schema.legalVersions.id,f.version.id));
    const revokedHash=await digest();expect(revokedHash).not.toBe(changedHash);
    expect((await db!.execute<{id:number}>(mappingPreparationBatchQuery(revokedHash,100))).some(row=>row.id===f.requirement.id)).toBe(true);
    await prepareAgentWork(db!);
    await db!.update(schema.opportunityRequirements).set({requirementText:'Programa retificado sintético.'}).where(eq(schema.opportunityRequirements.id,f.requirement.id));
    expect((await db!.execute<{id:number}>(mappingPreparationBatchQuery(revokedHash,100))).some(row=>row.id===f.requirement.id)).toBe(true);
  },30000);
  it('hasMore conserva o próximo lote em vez de repetir somente os primeiros IDs',async()=>{
    const f=await fixture();
    await db!.insert(schema.opportunityRequirements).values(Array.from({length:101},(_,index)=>({opportunityId:f.requirement.opportunityId,
      sourceDocumentId:f.requirement.sourceDocumentId,sourceSnapshotId:f.requirement.sourceSnapshotId,
      subjectId:f.requirement.subjectId,requirementText:`Regra sintética de organizar cartões — requisito${index}.`,sourceLocator:'Página sintética1'})));
    const first=await prepareAgentWork(db!,new Date(),{batchSize:100});expect(first.mappingExamined).toBe(100);expect(first.mappingHasMore).toBe(true);
    const second=await prepareAgentWork(db!,new Date(),{batchSize:100});expect(second.mappingExamined).toBeGreaterThan(0);
    expect(second.mappingHasMore).toBe(false);
  },30000);
  it('mapeamento concluído alimenta Autor automaticamente sem revisar o requisito',async()=>{
    const f=await fixture();await prepareAgentWork(db!);
    const key=`mapping:${f.requirement.id}`;
    // Isola este requisito sintético dos demais fixtures.
    await db!.execute(sql`update editorial_agent_work set status='blocked' where job_key<>${key} and status='pending'`);
    const claim=await claimAgentWork(db!,new Date(),'Guardião');if(claim.state!=='claimed')throw new Error('Reserva ausente');
    expect(claim.job.jobKey).toBe(key);
    const article=claim.job.payload.articles[0];
    await completeAgentWork(db!,{...claim.job,result:{...base,mappings:[{articleId:article.id,quote:article.text,rationale:'Vínculo sintético.'}]}});
    expect((await prepareAgentWork(db!)).authoring).toBe(1);
    const author=await claimAgentWork(db!,new Date(),'Autor');if(author.state!=='claimed')throw new Error('Reserva ausente');
    expect(author.job.payload.parentKey).toBe(key);
    expect(author.job.payload.opportunityId).toBe(f.payload.opportunityId);
  },30000);
  it('não prepara Autor sem disciplina e reprocessa o contexto após classificação draft legítima',async()=>{
    const f=await fixture();
    await db!.update(schema.opportunityRequirements).set({subjectId:null,topicId:null})
      .where(eq(schema.opportunityRequirements.id,f.requirement.id));
    const unclassifiedHash=await requirementContext(db!,f.requirement.id);
    await prepareAgentWork(db!);
    const key=`mapping:${f.requirement.id}`;
    await db!.execute(sql`update editorial_agent_work set status='blocked' where job_key<>${key} and status='pending'`);
    const claim=await claimAgentWork(db!,new Date(),'Guardião');if(claim.state!=='claimed')throw new Error('Reserva sintética ausente');
    expect(claim.job.jobKey).toBe(key);
    const article=claim.job.payload.articles[0];
    await completeAgentWork(db!,{...claim.job,result:{...base,mappings:[{articleId:article.id,quote:article.text,rationale:'Vínculo sintético.'}]}});
    expect((await prepareAgentWork(db!,new Date(),{followupsOnly:true})).authoring).toBe(0);
    expect(await db!.execute(sql`select job_key from editorial_agent_work where job_key=${`author:${f.requirement.id}`}`)).toHaveLength(0);
    await db!.update(schema.opportunityRequirements).set({subjectId:f.requirement.subjectId,updatedAt:new Date()})
      .where(eq(schema.opportunityRequirements.id,f.requirement.id));
    const classifiedHash=await requirementContext(db!,f.requirement.id);
    expect(classifiedHash).not.toBe(unclassifiedHash);
    // Parent still has the OLD context; classification cannot approve/replay it.
    expect((await prepareAgentWork(db!,new Date(),{followupsOnly:true})).authoring).toBe(0);
    await prepareAgentWork(db!);
    await db!.execute(sql`update editorial_agent_work set status='blocked' where job_key<>${key} and status='pending'`);
    const current=await claimAgentWork(db!,new Date(),'Guardião');if(current.state!=='claimed')throw new Error('Nova reserva sintética ausente');
    expect(current.job.payload.context.sourceContextHash).toBe(classifiedHash);
    const currentArticle=current.job.payload.articles[0];
    await completeAgentWork(db!,{...current.job,result:{...base,mappings:[{articleId:currentArticle.id,quote:currentArticle.text,rationale:'Vínculo sintético atual.'}]}});
    expect((await prepareAgentWork(db!,new Date(),{followupsOnly:true})).authoring).toBe(1);
    expect((await db!.select().from(schema.opportunityRequirements).where(eq(schema.opportunityRequirements.id,f.requirement.id)))[0].editorialStatus).toBe('draft');
  },30000);
  it('prepara, reserva e conclui com o papel restrito da aplicação',async()=>{
    const f=await fixture();
    const restrictedClient=postgres(url!,{max:1,prepare:false,connection:{options:'-c role=leiprova_app'}});
    const restricted=drizzle(restrictedClient,{schema});
    try {
      expect((await restricted.execute<{role:string}>(sql`select current_user role`))[0].role).toBe('leiprova_app');
      await prepareAgentWork(restricted);
      const key=`mapping:${f.requirement.id}`;
      await db!.execute(sql`update editorial_agent_work set status='blocked' where job_key<>${key} and status='pending'`);
      const claim=await claimAgentWork(restricted,new Date(),'Guardião');if(claim.state!=='claimed')throw new Error('Reserva ausente');
      const article=claim.job.payload.articles[0];
      expect((await completeAgentWork(restricted,{...claim.job,result:{...base,mappings:[{articleId:article.id,quote:article.text,rationale:'Vínculo sintético.'}]}})).state).toBe('prepared');
      await prepareAgentWork(restricted);
      const author=await claimAgentWork(restricted,new Date(),'Autor');if(author.state!=='claimed')throw new Error('Reserva de autoria ausente');
      const question={prompt:`Teste isolado ${randomUUID()}: no treinamento fictício de cartões, qual preparação antecede o início?`,articleId:article.id,quote:article.text,
        explanation:'O texto sintético determina organizar os cartões antes de iniciar a atividade fictícia.',difficulty:'easy',
        options:['Organizar cartões','Pular a preparação','Descartar os cartões','Encerrar sem iniciar','Iniciar desorganizado'].map((text,index)=>({key:'ABCDE'[index],text,correct:index===0,rationale:'Explicação sintética para teste de privilégio mínimo.'}))};
      const receipt=await completeAgentWork(restricted,{...author.job,result:{...base,generatorModel:'synthetic-test',questions:[question]}});
      expect(receipt.state).toBe('prepared');expect(receipt.importedQuestionPublicIds).toHaveLength(1);
    }finally{await restrictedClient.end();}
  },30000);
});
