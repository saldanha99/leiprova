import { randomUUID,createHash } from "node:crypto";
import { sql,eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { beforeAll,beforeEach,afterAll,describe,it,expect } from "vitest";
import * as schema from "@/lib/db/schema";
import { AGENT_WORK_VERSION,type AgentWorkPayload } from "@/lib/editorial/agent-work-contract";
import { enqueueAgentWork,claimAgentWork,completeAgentWork,requirementContext } from "@/lib/editorial/agent-work-queue";
import { prepareAgentWork } from "@/lib/editorial/agent-work-preparation";

const url=process.env.LEIPROVA_TEST_DATABASE_URL;
if(url){const parsed=new URL(url);if(!["localhost","127.0.0.1","[::1]"].includes(parsed.hostname)||parsed.pathname!=="/leiprova_automation_test")throw new Error("Somente banco de teste em loopback.");}
const client=url?postgres(url,{max:6,prepare:false}):null;
const db=client?drizzle(client,{schema}):null;
const hash=(text:string)=>createHash('sha256').update(text).digest('hex');
const base={schemaVersion:1,publicationAllowed:false,outcome:'prepared',summary:'Teste sintético; sem publicação.',limitations:[],evidence:[]};
function discoveryPayload():AgentWorkPayload{return{version:AGENT_WORK_VERSION,title:'Descoberta sintética',instructions:'Somente teste.',context:{},articles:[],sourceUrls:['https://www.vunesp.com.br/']};}
async function fixture(){
  const database=db!;const tag=randomUUID();
  const [editor]=await database.insert(schema.users).values({publicId:randomUUID(),name:'Editor sintético',email:`${tag}@example.invalid`,passwordHash:'not-a-password',role:'editor'}).returning();
  const [category]=await database.select().from(schema.contestCategoryCareers).limit(1);
  const [topic]=await database.select().from(schema.quizTopics).limit(1);
  const [bank]=await database.select().from(schema.quizBanks).where(eq(schema.quizBanks.slug,'vunesp'));
  const [act]=await database.insert(schema.legalActs).values({slug:`agent-test-${tag}`,title:'Regra sintética',shortTitle:'Regra sintética',actType:'lei',officialUrl:'https://example.invalid/synthetic'}).returning();
  const [version]=await database.insert(schema.legalVersions).values({legalActId:act.id,sourceUrl:'https://example.invalid/synthetic',checksumSha256:hash(tag),verifiedAt:new Date(),status:'current'}).returning();
  const [article]=await database.insert(schema.legalArticles).values({legalVersionId:version.id,articleRef:'Art. 1',articleOrder:1,path:'art-1',literalText:'No exercício fictício, a equipe deve organizar os cartões antes da atividade.',editorialStatus:'reviewed'}).returning();
  const [opportunity]=await database.insert(schema.contestOpportunities).values({publicId:randomUUID(),slug:`agent-test-${tag}`,categoryId:category.categoryId,careerTrackId:category.careerTrackId,jurisdictionCode:'BR',scope:'national',cycleYear:2026,institutionAcronym:`TEST-${tag}`,institutionName:'Instituição sintética',roleName:'Cargo sintético',title:'Concurso sintético',summary:'Exclusivo para teste.',statusAsOf:'2026-09-06',editorialStatus:'draft',officialUrl:'https://example.invalid/synthetic',sourceCheckedAt:new Date()}).returning();
  const [source]=await database.insert(schema.opportunitySourceDocuments).values({publicId:randomUUID(),opportunityId:opportunity.id,documentType:'official_announcement',title:'Fonte sintética',sourceUrl:'https://example.invalid/synthetic',sourceHost:'example.invalid',observedAt:new Date(),lastSeenAt:new Date(),httpStatus:200,status:'approved',reviewedByUserId:editor.id,reviewedAt:new Date()}).returning();
  await database.update(schema.contestOpportunities).set({editorialStatus:'reviewed',reviewedByUserId:editor.id,reviewedAt:new Date(),publishedAt:new Date()}).where(eq(schema.contestOpportunities.id,opportunity.id));
  const syntheticText='Somente teste sintético de automação. '.repeat(5);
  const [snapshot]=await database.insert(schema.opportunityDocumentSnapshots).values({publicId:randomUUID(),sourceDocumentId:source.id,documentUrl:'https://example.invalid/synthetic.pdf',sourceHost:'example.invalid',fileName:'synthetic.pdf',mimeType:'application/pdf',documentBytes:Buffer.from('%PDF-synthetic'),checksumSha256:hash(tag),byteLength:Buffer.byteLength('%PDF-synthetic'),pageCount:1,extractedText:syntheticText,pageTexts:[syntheticText],textLength:syntheticText.length,parserVersion:'synthetic-test',authorizationScope:'owner-approval-2026-09-01',authorizedAt:new Date(),status:'approved',reviewedByUserId:editor.id,reviewedAt:new Date(),reviewNotes:'Somente fixture sintética.'}).returning();
  await database.insert(schema.opportunityOrganizerAssignments).values({opportunityId:opportunity.id,quizBankId:bank.id,sourceDocumentId:source.id,responsibleType:'external_organizer',role:'examination_provider',organizerSlug:'vunesp',organizerName:'Perfil sintético',validFrom:'2026-01-01',status:'reviewed',reviewedByUserId:editor.id,reviewedAt:new Date()});
  const [requirement]=await database.insert(schema.opportunityRequirements).values({opportunityId:opportunity.id,sourceDocumentId:source.id,sourceSnapshotId:snapshot.id,subjectId:topic.subjectId,topicId:topic.id,requirementText:'Regra sintética de organizar cartões.',sourceLocator:'Página sintética 1',editorialStatus:'draft'}).returning();
  const payload:AgentWorkPayload={version:AGENT_WORK_VERSION,title:opportunity.title,instructions:'Somente teste.',requirementId:requirement.id,opportunityId:opportunity.id,bank:'vunesp',role:opportunity.roleName,context:{sourceContextHash:await requirementContext(database,requirement.id),requirement:requirement.requirementText},sourceUrls:[snapshot.documentUrl],articles:[{id:article.id,act:act.shortTitle,articleRef:article.articleRef,text:article.literalText,versionId:version.id,checksum:version.checksumSha256,url:version.sourceUrl}]};
  return{payload,requirement,article,version};
}
describe.skipIf(!url)('ponte editorial — PostgreSQL isolado',()=>{
  beforeAll(async()=>{expect((await db!.execute<{name:string}>(sql`select current_database() name`))[0].name).toBe('leiprova_automation_test');});
  beforeEach(async()=>{await db!.execute(sql`delete from editorial_agent_runs`);await db!.execute(sql`delete from editorial_agent_work`);});
  afterAll(async()=>{await client?.end();});
  it('reserva concorrente não duplica tarefa e respeita papel',async()=>{
    await enqueueAgentWork(db!,'test:1','discovery',discoveryPayload());
    expect((await claimAgentWork(db!,new Date(),'Autor')).state).toBe('idle');
    const claims=await Promise.all(Array.from({length:4},()=>claimAgentWork(db!,new Date(),'Radar')));
    expect(claims.filter(x=>x.state==='claimed')).toHaveLength(1);
  });
  it('alteração de entrada cancela resposta antiga',async()=>{
    const payload=discoveryPayload();await enqueueAgentWork(db!,'test:1','discovery',payload);
    const claim=await claimAgentWork(db!);if(claim.state!=='claimed')throw new Error('Reserva ausente');
    await enqueueAgentWork(db!,'test:1','discovery',{...payload,title:'Outra edição'});
    await expect(completeAgentWork(db!,{...claim.job,result:base})).rejects.toThrow();
    expect((await claimAgentWork(db!)).state).toBe('claimed');
  });
  it('retoma lease vencido e para após três tentativas',async()=>{
    await enqueueAgentWork(db!,'test:1','discovery',discoveryPayload());const now=new Date();
    for(let i=0;i<3;i++)expect((await claimAgentWork(db!,new Date(now.getTime()+i*46*60000))).state).toBe('claimed');
    expect((await claimAgentWork(db!,new Date(now.getTime()+3*46*60000))).state).toBe('idle');
    expect((await db!.execute<{status:string}>(sql`select status from editorial_agent_work`))[0].status).toBe('failed');
  });
  it('teto diário é compartilhado e atômico',async()=>{
    for(let i=0;i<26;i++)await enqueueAgentWork(db!,`test:${i}`,'discovery',discoveryPayload());
    for(let i=0;i<24;i++)expect((await claimAgentWork(db!)).state).toBe('claimed');
    expect((await claimAgentWork(db!)).state).toBe('budget_exhausted');
  },30000);
  it('rejeita lei revogada durante a tarefa',async()=>{
    const f=await fixture();await enqueueAgentWork(db!,'mapping:test','legal_mapping',f.payload);
    const claim=await claimAgentWork(db!);if(claim.state!=='claimed')throw new Error('Reserva ausente');
    await db!.update(schema.legalVersions).set({status:'revoked'}).where(eq(schema.legalVersions.id,f.version.id));
    expect((await completeAgentWork(db!,{...claim.job,result:{...base,mappings:[{articleId:f.article.id,quote:f.article.literalText,rationale:'Vínculo sintético.'}]}})).state).toBe('superseded');
  });
  it('cria rascunho no concurso exato sem aprovar requisito ou publicar',async()=>{
    const f=await fixture();await enqueueAgentWork(db!,'author:test','authoring',f.payload);
    const claim=await claimAgentWork(db!);if(claim.state!=='claimed')throw new Error('Reserva ausente');
    const question={prompt:`No exercício fictício identificado como ${randomUUID()}, qual ato precede a atividade?`,articleId:f.article.id,quote:f.article.literalText,explanation:'A regra sintética exige organizar cartões antes de começar a atividade.',difficulty:'easy',options:['Organizar cartões','Ignorar o preparo','Interromper todos','Guardar a tarefa','Começar sem organização'].map((text,i)=>({key:'ABCDE'[i],text,correct:i===0,rationale:'Justificativa sintética usada exclusivamente neste teste.'}))};
    const receipt=await completeAgentWork(db!,{...claim.job,result:{...base,generatorModel:'synthetic-test',questions:[question]}});
    expect(receipt.state).toBe('prepared');
    const replay=await completeAgentWork(db!,{...claim.job,result:{...base,generatorModel:'synthetic-test',questions:[question]}});
    expect(replay).toMatchObject({state:'prepared',replayed:true});
    await expect(completeAgentWork(db!,{...claim.job,result:{...base,summary:'Resposta alterada',generatorModel:'synthetic-test',questions:[question]}})).rejects.toThrow();
    const [saved]=await db!.select().from(schema.questions).where(eq(schema.questions.prompt,question.prompt));
    expect(saved.editorialStatus).toBe('draft');expect(saved.reviewedByUserId).toBeNull();expect(saved.cleanRoomAttestedAt).toBeNull();
    const [link]=await db!.select().from(schema.questionOpportunities).where(eq(schema.questionOpportunities.questionId,saved.id));
    expect(link.opportunityId).toBe(f.payload.opportunityId);
    const [requirement]=await db!.select().from(schema.opportunityRequirements).where(eq(schema.opportunityRequirements.id,f.requirement.id));
    expect(requirement.editorialStatus).toBe('draft');expect(requirement.legalArticleId).toBeNull();
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
