import {createHash,randomUUID} from 'node:crypto';
import {sql,eq} from 'drizzle-orm';
import {drizzle} from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import {beforeAll,beforeEach,afterAll,describe,it,expect} from 'vitest';
import * as schema from '@/lib/db/schema';
import {admitProgrammeSubjects,SUBJECT_ADMISSION_ACTION} from '@/lib/editorial/programme-subject-admission';
import {OFFICIAL_COURSE_STANDING_REFERENCE} from '@/lib/editorial/official-course-dossier';
const value=process.env.LEIPROVA_SUBJECT_TEST_DATABASE_URL;
if(value){const u=new URL(value);if(!['localhost','127.0.0.1','[::1]'].includes(u.hostname)||u.pathname!=='/leiprova_automation_test'||u.port!=='55446'||u.username!=='leiprova_owner')throw Error('Somente banco sintético isolado loopback55446.');}
const client=value?postgres(value,{max:1,prepare:false}):null,db=client?drizzle(client,{schema}):null;
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
let actor:typeof schema.users.$inferSelect,source:typeof schema.opportunitySourceDocuments.$inferSelect,snapshot:typeof schema.opportunityDocumentSnapshots.$inferSelect;
const heading='DIREITO PREVIDENCIÁRIO';
const request=()=>({actorPublicId:actor.publicId,approvalReference:OFFICIAL_COURSE_STANDING_REFERENCE,mode:'preview' as const,input:{schemaVersion:1,subjects:[{slug:'direito-previdenciario',name:'Direito Previdenciário',proofs:[{opportunityId:7,roleName:'Juiz Federal Substituto',examEditionId:null,sourceDocumentId:source.id,snapshotId:snapshot.id,url:snapshot.documentUrl,checksum:snapshot.checksumSha256,headingPage:1,headingQuote:heading}]}]}});
describe.skipIf(!db)('admissão do catálogo — PostgreSQL sintético',()=>{
 beforeAll(async()=>{
  expect((await db!.execute<{name:string}>(sql`select current_database() as name`))[0].name).toBe('leiprova_automation_test');
  const tag=randomUUID(),now=new Date();
  [actor]=await db!.insert(schema.users).values({publicId:randomUUID(),name:'Administrador QA sintético',email:`${tag}@example.invalid`,passwordHash:'not-a-password',role:'admin'}).returning();
  const landing=`https://conhecimento.fgv.br/concursos/qa-synthetic-taxonomy-${tag}`;
  const [category]=await db!.select().from(schema.contestCategoryCareers).limit(1);
  // Fixed production scope IDs exist only in this deliberately synthetic target.
  // Seed has no opportunity7: create a labelled fixture, never mutate production.
  const [existing]=await db!.select().from(schema.contestOpportunities).where(eq(schema.contestOpportunities.id,7));
  if(!existing) await db!.execute(sql`insert into contest_opportunities(id,public_id,slug,category_id,career_track_id,jurisdiction_code,scope,cycle_year,institution_acronym,institution_name,role_name,title,summary,status_as_of,official_url,source_checked_at)
    overriding system value values(7,${randomUUID()},'trf-5-juiz-federal-2026',${category.categoryId},${category.careerTrackId},'BR','national',2026,'TEST-7','Instituição fictícia de software','Juiz Federal Substituto','Fixture QA sem validade jurídica','Somente teste de catálogo','2026-10-12',${landing},${now.toISOString()}::text::timestamptz)`);
  await db!.update(schema.contestOpportunities).set({editorialStatus:'draft'}).where(eq(schema.contestOpportunities.id,7));
  await db!.update(schema.contestOpportunities).set({slug:'trf-5-juiz-federal-2026',roleName:'Juiz Federal Substituto',cycleYear:2026,examEditionId:null,officialUrl:landing,officialNoticeNumber:`QA-${tag}`,noticePublishedAt:now.toISOString().slice(0,10),sourceCheckedAt:now}).where(eq(schema.contestOpportunities.id,7));
  [source]=await db!.insert(schema.opportunitySourceDocuments).values({publicId:randomUUID(),opportunityId:7,documentType:'official_announcement',title:'Fonte sintética sem validade jurídica',sourceUrl:landing,sourceHost:'conhecimento.fgv.br',observedAt:now,lastSeenAt:now,httpStatus:200,sourcePolicy:'metadata_only',status:'approved',reviewedByUserId:actor.id,reviewedAt:now}).returning();
  const bytes=Buffer.from('%PDF-synthetic-taxonomy-not-a-real-notice'),text=`Fonte sintética de teste sem validade jurídica.\n${heading}\n${'Exercício fictício de software. '.repeat(5)}`;
  [snapshot]=await db!.insert(schema.opportunityDocumentSnapshots).values({publicId:randomUUID(),sourceDocumentId:source.id,documentUrl:`https://conhecimento.fgv.br/sites/default/files/qa-synthetic-taxonomy-${tag}.pdf`,sourceHost:'conhecimento.fgv.br',fileName:'synthetic.pdf',mimeType:'application/pdf',documentBytes:bytes,checksumSha256:hash(bytes.toString()),byteLength:bytes.length,pageCount:1,extractedText:text,pageTexts:[text],textLength:text.length,parserVersion:'synthetic-test',sourcePolicy:'official_document',authorizationScope:'owner-approval-2026-09-01',authorizedAt:now,status:'approved',reviewedByUserId:actor.id,reviewedAt:now,reviewNotes:'Somente QA sem fetch.'}).returning();
  await db!.insert(schema.opportunityOrganizerAssignments).values({opportunityId:7,sourceDocumentId:source.id,responsibleType:'institutional_commission',role:'primary_responsible',organizerSlug:'qa-synthetic-taxonomy',organizerName:'Comissão fictícia',validFrom:'2026-01-01',status:'reviewed',reviewedByUserId:actor.id,reviewedAt:now});
  await db!.update(schema.contestOpportunities).set({editorialStatus:'reviewed',publishedAt:now,reviewedByUserId:actor.id,reviewedAt:now}).where(eq(schema.contestOpportunities.id,7));
 });
 beforeEach(async()=>{
  await db!.execute(sql`delete from audit_logs where action=${SUBJECT_ADMISSION_ACTION}`);
  await db!.execute(sql`delete from quiz_subjects where slug='direito-previdenciario'`);
 });
 afterAll(async()=>client?.end());
 it('prévia read-only; aplicação cria somente disciplina e audit JSONB/false, repetição não duplica',async()=>{
  const r=request(),preview=await admitProgrammeSubjects(db!,r);expect(preview.wouldCreate).toBe(1);expect(preview.created).toBe(0);
  expect(await db!.execute(sql`select id from quiz_subjects where slug='direito-previdenciario'`)).toHaveLength(0);
  const result=await admitProgrammeSubjects(db!,{...r,mode:'apply',expectedFingerprint:preview.fingerprint});expect(result).toMatchObject({created:1,requirementsClassified:0,questionsApproved:0,productsReleased:0,humanReview:false});
  const [audit]=await db!.execute<{kind:string;human:boolean}>(sql`select jsonb_typeof(metadata) kind,(metadata->>'humanReview')::boolean human from audit_logs where action=${SUBJECT_ADMISSION_ACTION}`);expect(audit).toEqual({kind:'object',human:false});
  const next=await admitProgrammeSubjects(db!,r);expect((await admitProgrammeSubjects(db!,{...r,mode:'apply',expectedFingerprint:next.fingerprint})).created).toBe(0);
 });
 it('admite documento oficial direto aprovado, sem exigir que a URL do PDF seja um portal',async()=>{
  const now=new Date(),tag=randomUUID(),pdf=`https://conhecimento.fgv.br/sites/default/files/concursos/qa-direct-document-${tag}.pdf`;
  const [doc]=await db!.insert(schema.opportunitySourceDocuments).values({publicId:randomUUID(),opportunityId:7,documentType:'notice',title:'Edital sintético direto, sem validade jurídica',sourceUrl:pdf,sourceHost:'conhecimento.fgv.br',observedAt:now,lastSeenAt:now,httpStatus:200,sourcePolicy:'official_document',sourceContentStored:true,status:'approved',reviewedByUserId:actor.id,reviewedAt:now}).returning();
  const {id:unusedId,publicId:unusedPublic,...values}=snapshot;void unusedId;void unusedPublic;
  const [copy]=await db!.insert(schema.opportunityDocumentSnapshots).values({...values,publicId:randomUUID(),sourceDocumentId:doc.id,documentUrl:pdf,fileName:'direct-synthetic.pdf'}).returning();
  const r=request();Object.assign(r.input.subjects[0].proofs[0],{sourceDocumentId:doc.id,snapshotId:copy.id,url:pdf});
  const preview=await admitProgrammeSubjects(db!,r);
  expect((await admitProgrammeSubjects(db!,{...r,mode:'apply',expectedFingerprint:preview.fingerprint})).created).toBe(1);
 });
 it('recusa alteração do catálogo entre prévia e aplicação, sem cadastro/audit parcial',async()=>{
  const r=request(),preview=await admitProgrammeSubjects(db!,r);
  await db!.execute(sql`update quiz_subjects set updated_at=now() where id=(select min(id) from quiz_subjects)`);
  await expect(admitProgrammeSubjects(db!,{...r,mode:'apply',expectedFingerprint:preview.fingerprint})).rejects.toThrow(/mudou/);
  expect(await db!.execute(sql`select id from quiz_subjects where slug='direito-previdenciario'`)).toHaveLength(0);
 });
 it('não reativa entrada inativa nem renomeia disciplina existente',async()=>{
  await db!.insert(schema.quizSubjects).values({slug:'direito-previdenciario',name:'Direito Previdenciário',shortName:'Prev',isActive:false});
  await expect(admitProgrammeSubjects(db!,request())).rejects.toThrow(/inativa/);
 });
 it('snapshot de outro cargo/bytes inválidos bloqueia antes de escrever',async()=>{
  const r=request();r.input.subjects[0].proofs[0].checksum='f'.repeat(64);
  await expect(admitProgrammeSubjects(db!,r)).rejects.toThrow(/bytes/);
  expect(await db!.execute(sql`select id from quiz_subjects where slug='direito-previdenciario'`)).toHaveLength(0);
 });
});
