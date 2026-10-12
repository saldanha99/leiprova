import { createHash,randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import postgres from "postgres";
import { beforeAll,afterAll,describe,it,expect } from "vitest";
import { PGEAC_OFFICIAL_PREVIOUS_EXAM as target,reviewPgeacPreviousExamRegistration,previewPgeacPreviousExam } from "@/lib/exams/pgeac-previous-exam-admission";
import { OFFICIAL_COURSE_STANDING_REFERENCE as reference } from "@/lib/editorial/official-course-dossier";

export function requirePgeacQaDatabaseUrl(value:string) {
  const parsed=new URL(value);
  if(!['postgres:','postgresql:'].includes(parsed.protocol)||!['localhost','127.0.0.1','[::1]'].includes(parsed.hostname)
    ||parsed.pathname!=='/leiprova_automation_test'||decodeURIComponent(parsed.username)!=='leiprova_owner'||parsed.search||parsed.hash)throw new Error('Somente proprietário sintético em loopback/banco leiprova_automation_test.');
  return value;
}
const url=process.env.LEIPROVA_TEST_DATABASE_URL;
const client=url?postgres(requirePgeacQaDatabaseUrl(url),{max:1,prepare:false}):null;
let actor:string,opportunity:string,source:string,career:string,bank:string;
let metadata:Awaited<ReturnType<typeof previewPgeacPreviousExam>>;
const email=`pgeac-qa-${randomUUID()}@example.invalid`;
const reviewer={email,approvalReference:reference,provenance:'admin_emails_unique' as const,executionSource:'server_cli' as const};
const request={mode:'preview' as const,opportunityPublicId:target.opportunityPublicId,expectedNoticeSha256:target.noticeSha256};
class QaRollback extends Error {}
async function rolledBack(run:(tx:postgres.TransactionSql)=>Promise<void>) {
  try{await client!.begin('isolation level serializable',async tx=>{await run(tx);throw new QaRollback();});}
  catch(error){if(!(error instanceof QaRollback))throw error;}
}
async function preview(){return client!.begin('isolation level repeatable read read only',tx=>reviewPgeacPreviousExamRegistration(tx,request,metadata,reviewer));}
async function unchanged(){
  const [counts]=await client!<{edition:number;documents:number;baseline:string|null;status:string}[]>`select
    (select count(*)::int from exam_editions where public_id=${target.editionPublicId}) edition,
    (select count(*)::int from exam_edition_documents where exam_edition_id in(select id from exam_editions where public_id=${target.editionPublicId})) documents,
    o.exam_edition_id::text baseline,p.status from contest_store_products p join contest_opportunities o on o.id=p.opportunity_id where p.slug=${target.productSlug}`;
  expect(counts).toEqual({edition:0,documents:0,baseline:null,status:'draft'});
}
describe('guarda sintética PGE-AC',()=>{
  it('recusa rede remota, banco real e proprietário diferente antes de abrir cliente',()=>{
    for(const value of ['postgres://leiprova_owner@remote/leiprova_automation_test','postgres://leiprova_owner@127.0.0.1/leiprova','postgres://postgres@127.0.0.1/leiprova_automation_test','postgres://leiprova_owner@127.0.0.1/leiprova_automation_test?options=x'])expect(()=>requirePgeacQaDatabaseUrl(value)).toThrow();
  });
});
describe.skipIf(!url)('PGE-AC edição-base e links — PostgreSQL isolado',()=>{
  beforeAll(async()=>{
    const [identity]=await client!<{database:string;role:string}[]>`select current_database() as database,current_user as role`;
    expect(identity).toEqual({database:'leiprova_automation_test',role:'leiprova_owner'});
    const bytes=readFileSync('.local/editorial/pgeac-qa-notice/pgeac-notice.pdf');
    const snapshot=JSON.parse(readFileSync('.local/editorial/pgeac-qa-notice/pgeac-notice.snapshot.json','utf8')) as {pageTexts:string[];extractedText:string;parserVersion:string};
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(target.noticeSha256);
    expect(snapshot.pageTexts).toHaveLength(40);
    await client!.begin(async tx=>{
      const [user]=await tx<{id:string}[]>`insert into users(public_id,name,email,password_hash,role) values(${randomUUID()},'QA PGEAC sintética',${email},'not-a-password','admin') returning id::text`;actor=user.id;
      const [catalog]=await tx<{category:string;career:string;bank:string}[]>`select category.id::text category,c.id::text career,b.id::text bank from contest_categories category
        join contest_category_careers l on l.category_id=category.id join quiz_career_tracks c on c.id=l.career_track_id cross join quiz_banks b
        where category.slug='procuradorias' and c.slug='procurador' and b.slug='fgv'`;career=catalog.career;bank=catalog.bank;
      const [op]=await tx<{id:string}[]>`insert into contest_opportunities(public_id,slug,category_id,career_track_id,jurisdiction_code,scope,cycle_year,institution_acronym,institution_name,
        role_name,official_notice_number,title,summary,lifecycle_status,status_as_of,official_url,notice_published_at,exam_date,source_checked_at,editorial_status)
        values(${target.opportunityPublicId},${target.opportunitySlug},${catalog.category},${career},'AC','state',2026,'PGEAC','Instituição PGEAC sintética de QA',${target.role},'VIII/2026',
          'Fixture sintética PGEAC, sem publicação','Teste de software, sem conteúdo de questões.','result_published','2026-10-12',${target.noticeUrl},'2026-02-26',${target.examDate},now(),'draft') returning id::text`;opportunity=op.id;
      const [doc]=await tx<{id:string}[]>`insert into opportunity_source_documents(public_id,opportunity_id,document_type,title,source_url,source_host,observed_at,last_seen_at,checksum_sha256,
        http_status,content_type,source_policy,source_content_stored,status,reviewed_by_user_id,reviewed_at,review_notes)
        values(${randomUUID()},${opportunity},'notice','Edital oficial público em fixture QA',${target.noticeUrl},'conhecimento.fgv.br',now(),now(),${target.noticeSha256},200,'application/pdf','official_document',true,'approved',${actor},now(),'Fixture sintética; não representa revisão de produção.') returning id::text`;source=doc.id;
      await tx`insert into opportunity_document_snapshots(public_id,source_document_id,document_url,source_host,file_name,mime_type,document_bytes,checksum_sha256,byte_length,page_count,
        extracted_text,page_texts,text_length,parser_version,source_policy,authorization_scope,authorized_at,authorized_by_user_id,status,approval_basis,reviewed_by_user_id,reviewed_at,review_notes)
        values(${randomUUID()},${source},${target.noticeUrl},'conhecimento.fgv.br','notice-official-qa.pdf','application/pdf',${bytes},${target.noticeSha256},${bytes.length},40,
          ${snapshot.extractedText},${tx.json(snapshot.pageTexts)},${snapshot.extractedText.length},${snapshot.parserVersion},'official_document','owner-approval-2026-09-01',now(),${actor},'approved','owner_override',${actor},now(),'Documento oficial público somente em banco sintético de teste.')`;
      await tx`insert into opportunity_organizer_assignments(opportunity_id,quiz_bank_id,source_document_id,responsible_type,role,organizer_slug,organizer_name,valid_from,status,reviewed_by_user_id,reviewed_at,review_notes)
        values(${opportunity},${bank},${source},'external_organizer','examination_provider','fgv','Examinador sintético FGV','2026-02-26','reviewed',${actor},now(),'Somente fixture de software.'),
          (${opportunity},null,${source},'institutional_commission','primary_responsible','pgeac','Comissão sintética PGEAC','2026-02-26','reviewed',${actor},now(),'Somente fixture de software.')`;
      await tx`update contest_opportunities set editorial_status='reviewed',published_at=now(),reviewed_by_user_id=${actor},reviewed_at=now(),review_notes='Fixture de software; sem publicação real.' where id=${opportunity}`;
      await tx`insert into audit_logs(actor_user_id,action,entity_type,entity_id,metadata) values(${actor},'editorial.official_course.composite_standing_admitted','contest_opportunity',${target.opportunityPublicId},${tx.json({approvalReference:reference,humanReview:false,productSlug:target.productSlug,syntheticFixture:true})})`;
      await tx`insert into contest_store_products(slug,opportunity_id,status,preparation_mode,preparation_reviewed_at,preparation_reviewed_by_user_id,preparation_approval_reference,preparation_opportunity_updated_at)
        values(${target.productSlug},${opportunity},'draft','historical_training',now(),${actor},${reference},(select updated_at from contest_opportunities where id=${opportunity}))`;
    });
    const observedAt=new Date().toISOString();
    metadata={mode:'preview',productSlug:target.productSlug,editionPublicId:target.editionPublicId,observedAt,portalUrl:target.portalUrl,portalHttpStatus:200,
      portalHtmlSha256:'a'.repeat(64),robotsSha256:'b'.repeat(64),examDate:target.examDate,
      documents:target.documents.map(doc=>({...doc,httpStatus:200,isPdf:true,finalUrl:doc.url,checkedAt:new Date(),contentType:'application/pdf',pageTitle:null,
        distributionMode:'external_link',sourcePolicy:'metadata_only',sourceContentStored:false,status:'pending_review'})),
      noticeEvidence:{sourceUrl:target.noticeUrl,checksumSha256:target.noticeSha256,pages:{questionCount:14,examDate:14},expectedQuestionCount:100,pageCount:40},
      publicationAllowed:false,admissionApplied:false,latestEditionVerifiedInDatabase:false,databaseWrites:0,questionsImported:0,productsReleased:0,humanReview:false,verificationPolicy:'synthetic_metadata_fixture_no_network'};
  });
  afterAll(async()=>{await client?.end();});
  it('preview real é READ ONLY e não insere edição/documentos',async()=>{
    const result=await preview();expect(result).toMatchObject({mode:'preview',databaseWrites:0,publicationAllowed:false,questionsImported:0,productsReleased:0});expect(result.fingerprint).toMatch(/^[a-f0-9]{64}$/u);await unchanged();
  });
  it('apply cria held+2pending, atribui somente baselineNULL e mantém o fingerprint de modo/JSONB em uma transação',async()=>{
    const expected=await preview();
    await rolledBack(async tx=>{
      const result=await reviewPgeacPreviousExamRegistration(tx,{...request,mode:'apply',expectedFingerprint:expected.fingerprint},metadata,reviewer);
      expect(result).toMatchObject({mode:'applied',assignedBaselineEdition:true,referencesApproved:0,productsReleased:0,questionsImported:0,humanReview:false,documentStatus:'pending_review'});
      const [edition]=await tx<{status:string;stored:boolean}[]>`select status,source_content_stored stored from exam_editions where public_id=${target.editionPublicId}`;
      expect(edition).toEqual({status:'held',stored:false});
      const docs=await tx<{status:string;mode:string;policy:string;reviewer:string|null}[]>`select status,distribution_mode mode,source_policy policy,reviewed_by_user_id::text reviewer from exam_edition_documents where exam_edition_id=(select id from exam_editions where public_id=${target.editionPublicId})`;
      expect(docs).toHaveLength(2);expect(docs.every(doc=>doc.status==='pending_review'&&doc.mode==='external_link'&&doc.policy==='metadata_only'&&doc.reviewer===null)).toBe(true);
      const [scope]=await tx<{matches:boolean;status:string;baseline:string|null;references:number;contracts:number}[]>`select p.preparation_opportunity_updated_at=o.updated_at matches,p.status,o.exam_edition_id::text baseline,
        (select count(*)::int from contest_product_exam_references where product_slug=p.slug) as references,(select count(*)::int from opportunity_question_contracts where opportunity_id=o.id) contracts
        from contest_store_products p join contest_opportunities o on o.id=p.opportunity_id where p.slug=${target.productSlug}`;
      expect(scope).toMatchObject({matches:true,status:'draft',references:0,contracts:0});expect(scope.baseline).not.toBeNull();
      const [audit]=await tx<{kind:string;human:boolean;assigned:boolean}[]>`select jsonb_typeof(metadata) kind,(metadata->>'humanReview')::boolean human,(metadata->>'assignedBaselineEdition')::boolean assigned
        from audit_logs where action='editorial.previous_exam.pgeac_metadata_registered' and entity_id=${target.editionPublicId}`;
      expect(audit).toEqual({kind:'object',human:false,assigned:true});
    });await unchanged();
  });
  it('fingerprint divergente não grava sequer uma edição',async()=>{
    await rolledBack(async tx=>{await expect(reviewPgeacPreviousExamRegistration(tx,{...request,mode:'apply',expectedFingerprint:'0'.repeat(64)},metadata,reviewer)).rejects.toThrow('Fingerprint');});await unchanged();
  });
  it('não sobrescreve baseline existente',async()=>{
    const expected=await preview();await rolledBack(async tx=>{
      const [edition]=await tx<{id:string}[]>`insert into exam_editions(public_id,career_track_id,bank_id,institution_acronym,jurisdiction_code,title,official_url,exam_date,status,source_policy,source_content_stored,source_checked_at)
        values('qa-pgeac-existing-baseline',${career},${bank},'PGEAC','AC','Edição sintética existente',${target.portalUrl},${target.examDate},'held','metadata_only',false,now()) returning id::text`;
      await tx`update contest_opportunities set exam_edition_id=${edition.id} where id=${opportunity}`;
      await expect(reviewPgeacPreviousExamRegistration(tx,{...request,mode:'apply',expectedFingerprint:expected.fingerprint},metadata,reviewer)).rejects.toThrow('já possui edição-base');
    });await unchanged();
  });
  it('snapshot rejeitado bloqueia cadastro',async()=>{
    const expected=await preview();await rolledBack(async tx=>{await tx`update opportunity_document_snapshots set status='rejected' where source_document_id=${source}`;
      await expect(reviewPgeacPreviousExamRegistration(tx,{...request,mode:'apply',expectedFingerprint:expected.fingerprint},metadata,reviewer)).rejects.toThrow('Snapshot único');});await unchanged();
  });
  it('mais de um administrador bloqueia o modo automático sem email concreto',async()=>{
    const expected=await preview();await rolledBack(async tx=>{await tx`insert into users(public_id,name,email,password_hash,role) values(${randomUUID()},'Outro QA',${`${randomUUID()}@example.invalid`},'not-a-password','admin')`;
      await expect(reviewPgeacPreviousExamRegistration(tx,{...request,mode:'apply',expectedFingerprint:expected.fingerprint},metadata,{...reviewer,email:null,provenance:'database_admin_unique'})).rejects.toThrow('Administrador único');});await unchanged();
  });
  it('edição realizada mais recente impede selecionar esta como última',async()=>{
    const expected=await preview();await rolledBack(async tx=>{await tx`insert into exam_editions(public_id,career_track_id,bank_id,institution_acronym,jurisdiction_code,title,official_url,exam_date,status,source_policy,source_content_stored,source_checked_at)
      values('qa-pgeac-newer',${career},${bank},'PGEAC','AC','Outra edição sintética',${target.portalUrl},'2026-09-01','held','metadata_only',false,now())`;
      await expect(reviewPgeacPreviousExamRegistration(tx,{...request,mode:'apply',expectedFingerprint:expected.fingerprint},metadata,reviewer)).rejects.toThrow('mais recente');});await unchanged();
  });
  it('stamp histórico divergente e metadata futura bloqueiam sem aprovar provas',async()=>{
    const expected=await preview();await rolledBack(async tx=>{await tx`update contest_store_products set preparation_opportunity_updated_at='2000-01-01' where slug=${target.productSlug}`;
      await expect(reviewPgeacPreviousExamRegistration(tx,{...request,mode:'apply',expectedFingerprint:expected.fingerprint},metadata,reviewer)).rejects.toThrow('identidade/vínculo');});
    await client!.begin('read only',async tx=>{await expect(reviewPgeacPreviousExamRegistration(tx,request,{...metadata,observedAt:'2100-01-01T00:00:00Z'},reviewer)).rejects.toThrow('futuros');});await unchanged();
  });
  it.each(['contest_opportunities','contest_store_products'])('guard de UPDATE sem retorno reverte toda aplicação — %s',async(table)=>{
    const expected=await preview();await expect(client!.begin(async tx=>{
      await tx.unsafe(`create function public.qa_pgeac_skip_update() returns trigger language plpgsql as $$begin return null; end$$`);
      await tx.unsafe(`create trigger qa_pgeac_skip_update before update on ${table} for each row execute function public.qa_pgeac_skip_update()`);
      await reviewPgeacPreviousExamRegistration(tx,{...request,mode:'apply',expectedFingerprint:expected.fingerprint},metadata,reviewer);
    })).rejects.toThrow('transação cancelada');await unchanged();
  });
});
