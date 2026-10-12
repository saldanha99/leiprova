import {createHash} from 'node:crypto';
import {sql} from 'drizzle-orm';
import type {PostgresJsDatabase} from 'drizzle-orm/postgres-js';
import {z} from 'zod';
import * as schema from '../db/schema';
import {OFFICIAL_COURSE_STANDING_REFERENCE} from './official-course-dossier';
import {parseOfficialOpportunityDocumentUrl,parseOfficialOpportunitySourceUrl,type OfficialOpportunitySourceId} from '../opportunities/source-monitor-policy';

export const ADDITIONAL_PROGRAMME_SUBJECTS = {
 'direito-previdenciario':'Direito Previdenciário',
 'direito-economico-e-de-protecao-ao-consumidor':'Direito Econômico e de Proteção ao Consumidor',
 'direito-financeiro-e-tributario':'Direito Financeiro e Tributário',
 'direito-ambiental':'Direito Ambiental',
 'direito-internacional-publico-e-privado':'Direito Internacional Público e Privado',
 'etica-e-estatuto-juridico-da-magistratura-nacional':'Ética e Estatuto Jurídico da Magistratura Nacional',
 'direito-digital':'Direito Digital',
 'direito-da-antidiscriminacao':'Direito da Antidiscriminação',
 'legislacao-tributaria-estadual':'Legislação Tributária Estadual',
 'reforma-tributaria':'Reforma Tributária',
 'direito-civil-e-empresarial':'Direito Civil e Empresarial',
 'direito-da-infancia-e-juventude':'Direito da Infância e Juventude',
 'tutela-coletiva':'Tutela Coletiva',
 'teoria-geral-do-ministerio-publico-e-legislacao-institucional':'Teoria Geral do Ministério Público e Legislação Institucional',
 'legislacao-penal-extravagante':'Legislação Penal Extravagante',
 'principios-institucionais-do-ministerio-publico':'Princípios Institucionais do Ministério Público',
 'direito-civil-e-direito-empresarial':'Direito Civil e Direito Empresarial',
 'direito-de-pessoal-e-direito-previdenciario-publico':'Direito de Pessoal e Direito Previdenciário Público',
 'direito-tributario-e-processo-tributario':'Direito Tributário e Processo Tributário',
 'direito-financeiro':'Direito Financeiro',
} as const;
export const SUBJECT_ADMISSION_SCOPES:Record<number,string>={7:'Juiz Federal Substituto',13:'Auditor Fiscal da Administração Tributária Estadual',19:'Promotor de Justiça Substituto',20:'Promotor de Justiça Substituto',21:'Procurador do Estado — Classe I'};
export const SUBJECT_ADMISSION_SLUGS:Record<number,string>={7:'trf-5-juiz-federal-2026',13:'sefaz-al-auditor-fiscal-2026',19:'mpmt-promotor-substituto-2026-historico-objetiva',20:'mprj-promotor-substituto-xxxix-2026-historico-objetiva',21:'pgeac-procurador-classe-i-viii-2026-historico-objetiva'};
export const SUBJECT_ADMISSION_ACTION='editorial.programme.subject_catalog_admitted';
const id=z.number().int().positive().safe(), hash=z.string().regex(/^[a-f0-9]{64}$/u);
const slugs=Object.keys(ADDITIONAL_PROGRAMME_SUBJECTS) as [keyof typeof ADDITIONAL_PROGRAMME_SUBJECTS,...(keyof typeof ADDITIONAL_PROGRAMME_SUBJECTS)[]];
export const subjectAdmissionInputSchema=z.object({schemaVersion:z.literal(1),subjects:z.array(z.object({slug:z.enum(slugs),name:z.string().min(1).max(160),proofs:z.array(z.object({opportunityId:id,roleName:z.string().min(1),examEditionId:id.nullable(),sourceDocumentId:id,snapshotId:id,url:z.url(),checksum:hash,headingPage:id,headingQuote:z.string().min(1).max(200)}).strict()).min(1).max(5)}).strict()).min(1).max(20)}).strict().superRefine((input,ctx)=>{
 if(new Set(input.subjects.map(item=>item.slug)).size!==input.subjects.length)ctx.addIssue({code:'custom',message:'Disciplina repetida.'});
 for(const item of input.subjects){if(item.name!==ADDITIONAL_PROGRAMME_SUBJECTS[item.slug])ctx.addIssue({code:'custom',message:'Nome canônico exato obrigatório.'});for(const proof of item.proofs)if(SUBJECT_ADMISSION_SCOPES[proof.opportunityId]!==proof.roleName)ctx.addIssue({code:'custom',message:'Cargo fora dos cinco escopos.'});}
});
export const subjectNameKey=(value:string)=>value.normalize('NFKC').replace(/\s+/gu,' ').trim().toLocaleUpperCase('pt-BR');
export function assertSubjectLabelProof(slug:keyof typeof ADDITIONAL_PROGRAMME_SUBJECTS,quote:string,page:string){
 const expected=ADDITIONAL_PROGRAMME_SUBJECTS[slug];
 const literal=slug==='direito-digital'?`F) ${expected}`:slug==='direito-da-antidiscriminacao'?`H) ${expected}`:expected;
 if(subjectNameKey(quote)!==subjectNameKey(literal)||!page.split(/\r?\n/u).some(line=>subjectNameKey(line)===subjectNameKey(quote)))throw Error('Rótulo literal completo ausente na página oficial; não inferir disciplina de prosa.');
}
export function assertApprovedProgrammeSourceUrls(docUrl:string,documentUrl:string,docPolicy:string,expected:OfficialOpportunitySourceId){
 // An approved full-document source may itself be the exact PDF captured in
 // its approved snapshot. A landing page remains subject to the portal policy.
 if(docPolicy==='official_document'&&docUrl===documentUrl&&new URL(docUrl).pathname.toLowerCase().endsWith('.pdf')){
  parseOfficialOpportunityDocumentUrl(docUrl,expected);
 }else{
  const primary=parseOfficialOpportunitySourceUrl(docUrl,expected);
  if(primary.sourceId!==expected)throw Error('Portal primário não corresponde ao programa.');
 }
 parseOfficialOpportunityDocumentUrl(documentUrl,expected);
}
const digest=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export async function admitProgrammeSubjects(db:PostgresJsDatabase<typeof schema>,request:{input:unknown;actorPublicId:string;approvalReference:string;mode:'preview'|'apply';expectedFingerprint?:string}){
 if(!['preview','apply'].includes(request.mode)||request.approvalReference!==OFFICIAL_COURSE_STANDING_REFERENCE||(request.mode==='apply'&&!/^[a-f0-9]{64}$/u.test(request.expectedFingerprint??'')))throw Error('Autorização, modo ou fingerprint inválidos.');
 const input=subjectAdmissionInputSchema.parse(request.input),actorPublicId=z.uuid().parse(request.actorPublicId);
 const proofs=input.subjects.flatMap(s=>s.proofs),oppIds=[...new Set(proofs.map(p=>p.opportunityId))].sort((a,b)=>a-b),sourceIds=[...new Set(proofs.map(p=>p.sourceDocumentId))].sort((a,b)=>a-b),snapshotIds=[...new Set(proofs.map(p=>p.snapshotId))].sort((a,b)=>a-b);
 const list=(values:number[])=>sql.join(values.map(v=>sql`${v}`),sql`, `);
 return db.transaction(async tx=>{
  await tx.execute(sql`set local statement_timeout='30s'`);await tx.execute(sql`set local lock_timeout='5s'`);
  if(request.mode==='preview')await tx.execute(sql`set transaction read only`);
  const [actor]=await tx.execute<{id:number;role:string}>(sql`select id::int as id,role from users where public_id=${actorPublicId} ${request.mode==='apply'?sql`for share`:sql``}`);
  if(!actor||actor.role!=='admin')throw Error('Administrador explícito obrigatório.');
  if(request.mode==='apply'){
   await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended('leiprova:programme-subject-catalog:v1',0))`);
   await tx.execute(sql`lock table quiz_subjects in share row exclusive mode`);
   await tx.execute(sql`select id from contest_opportunities where id in(${list(oppIds)}) order by id for share`);
   await tx.execute(sql`select id from opportunity_source_documents where id in(${list(sourceIds)}) order by id for share`);
   await tx.execute(sql`select id from opportunity_document_snapshots where id in(${list(snapshotIds)}) order by id for share`);
  }
  const catalogue=await tx.execute<{id:number;slug:string;name:string;active:boolean;stateHash:string}>(sql`select id::int as id,slug,name,is_active as active,encode(sha256(convert_to(to_jsonb(q)::text,'UTF8')),'hex') as "stateHash" from quiz_subjects q order by id`);
  const sources=await tx.execute<{id:number;docId:number;oppId:number;role:string;slug:string;year:number;edition:number|null;oppStatus:string;status:string;docStatus:string;policy:string;docPolicy:string;url:string;docUrl:string;checksum:string;bytesChecksum:string;pages:string[];opHash:string;docHash:string;snapshotHash:string}>(sql`select s.id::int as id,d.id::int as "docId",o.id::int as "oppId",o.role_name as role,o.slug,o.cycle_year as year,o.exam_edition_id::int as edition,o.editorial_status as "oppStatus",s.status,d.status as "docStatus",s.source_policy as policy,d.source_policy as "docPolicy",s.document_url as url,d.source_url as "docUrl",s.checksum_sha256 as checksum,encode(sha256(s.document_bytes),'hex') as "bytesChecksum",s.page_texts as pages,encode(sha256(convert_to(to_jsonb(o)::text,'UTF8')),'hex') as "opHash",encode(sha256(convert_to(to_jsonb(d)::text,'UTF8')),'hex') as "docHash",encode(sha256(convert_to((to_jsonb(s)-'document_bytes'-'extracted_text'-'page_texts')::text,'UTF8')),'hex') as "snapshotHash" from opportunity_document_snapshots s join opportunity_source_documents d on d.id=s.source_document_id join contest_opportunities o on o.id=d.opportunity_id where s.id in(${list(snapshotIds)}) order by s.id`);
  for(const item of input.subjects){
   const collisions=catalogue.filter(c=>c.slug===item.slug||subjectNameKey(c.name)===subjectNameKey(item.name));
   if(collisions.some(c=>c.slug!==item.slug||c.name!==item.name||!c.active)||collisions.length>1)throw Error('Nome/slug já usado por outra disciplina ou entrada inativa; não renomear/reativar.');
   for(const p of item.proofs){const s=sources.find(s=>s.id===p.snapshotId);
    if(!s||s.docId!==p.sourceDocumentId||s.oppId!==p.opportunityId||s.role!==p.roleName||s.slug!==SUBJECT_ADMISSION_SLUGS[p.opportunityId]||s.year!==2026||s.edition!==p.examEditionId||s.oppStatus!=='reviewed'||s.status!=='approved'||s.docStatus!=='approved'||s.policy!=='official_document'||!['official_document','metadata_only'].includes(s.docPolicy)||s.url!==p.url||s.checksum!==p.checksum||s.bytesChecksum!==p.checksum||!Array.isArray(s.pages)||!s.pages[p.headingPage-1])throw Error('Fonte/cargo/edição/bytes/página divergentes.');
    assertApprovedProgrammeSourceUrls(s.docUrl,s.url,s.docPolicy,p.opportunityId===13?'cebraspe':'fgv-conhecimento');
    assertSubjectLabelProof(item.slug,p.headingQuote,s.pages[p.headingPage-1]);
   }
  }
  const fingerprint=digest({input,actorPublicId,reference:request.approvalReference,catalogue,sources:sources.map(({pages,...s})=>({...s,pagesHash:digest(pages)}))});
  const pending=input.subjects.filter(item=>!catalogue.some(c=>c.slug===item.slug));let created=0;
  if(request.mode==='apply'){
   if(request.expectedFingerprint!==fingerprint)throw Error('Catálogo, fonte ou identidade mudou desde a prévia.');
   for(const item of pending){const [subject]=await tx.insert(schema.quizSubjects).values({slug:item.slug,name:item.name,shortName:item.name,isActive:true}).returning({id:schema.quizSubjects.id});
    await tx.insert(schema.auditLogs).values({actorUserId:actor.id,action:SUBJECT_ADMISSION_ACTION,entityType:'quiz_subject',entityId:String(subject.id),metadata:{approvalBasis:'owner_standing_authorization',approvalReference:request.approvalReference,humanReview:false,operationFingerprint:fingerprint,subject:{id:subject.id,slug:item.slug,name:item.name},sourceProofs:item.proofs,legalCoverageApproved:0,requirementsClassified:0,questionsApproved:0,productsReleased:0}});created++;
   }
  }
  return {mode:request.mode,fingerprint,examined:input.subjects.length,wouldCreate:pending.length,created,humanReview:false,legalCoverageApproved:0,requirementsClassified:0,questionsApproved:0,productsReleased:0};
 },{isolationLevel:request.mode==='apply'?'serializable':'repeatable read'});
}
