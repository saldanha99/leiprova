import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { z } from "zod";
import * as schema from "../db/schema";
import { approvedProductQuestionExists } from "../commerce/product-binding-query";
import { officialQuestionContractInputSchema, officialQuestionContractSchema, MPRJ_PROMOTOR_MULTIPLE_CHOICE_PROFILE, type OfficialQuestionContract, questionContractFingerprint,officialFormatEvidenceMatches } from "./official-question-contract";
import { OFFICIAL_COURSE_STANDING_REFERENCE } from "./official-course-dossier";
import { currentQuestionContractExists, questionContractContentHash, questionOptionsMatchContract } from "./question-contract-query";
import { certifyProductBindingContracts, lockQuestionContracts } from "./question-contract-service";
import { parseOfficialOpportunitySourceUrl,parseOfficialOpportunityDocumentUrl } from "../opportunities/source-monitor-policy";
import { lockApprovalScope } from "./approval-lock";

import { observeMprjMc5Cover } from "./mprj-format-evidence";
import { planMprjFormatEvidence, readMprjFormatDocument } from "./mprj-format-admission";

const inputSchema=z.object({contract:officialQuestionContractInputSchema,productSlug:z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u).optional()}).strict();
const normalize=(text:string)=>text.normalize("NFKC").replace(/\s+/gu," ").trim();
const fingerprint=(value:unknown)=>createHash("sha256").update(JSON.stringify(value)).digest("hex");
const requestSchema=z.object({input:z.unknown(),actorPublicId:z.uuid(),approvalReference:z.literal(OFFICIAL_COURSE_STANDING_REFERENCE),
  mode:z.enum(['preview','apply']),expectedFingerprint:z.string().regex(/^[a-f0-9]{64}$/u).optional(),refreshMprjEvidence:z.boolean().optional()}).strict();

/** A fresh observation of identical format facts must not change the authorship contract. */
export function sameMprjContractFacts(previous:OfficialQuestionContract,next:OfficialQuestionContract) {
  const {formatEvidence:oldEvidence,...oldBase}=previous;
  const {formatEvidence:newEvidence,...newBase}=next;
  if(!oldEvidence || !newEvidence || questionContractFingerprint(oldBase)!==questionContractFingerprint(newBase)) return false;
  const stable=(e:NonNullable<OfficialQuestionContract['formatEvidence']>)=>[
    e.documentPublicId,e.sourceUrl,e.sourceSha256,e.pageTextSha256,e.pageNumber,e.parserVersion,
    e.format,e.optionCount,e.singleCorrect,e.questionCount,
  ];
  return JSON.stringify(stable(oldEvidence))===JSON.stringify(stable(newEvidence));
}

/** Operador de manutenção: nunca expor em formulário público nem usar credenciais do pacote. */
export async function reviewOfficialQuestionContract(db:PostgresJsDatabase<typeof schema>,request:{
  input:unknown;actorPublicId:string;approvalReference:string;mode:"preview"|"apply";expectedFingerprint?:string;refreshMprjEvidence?:boolean;
}) {
  request=requestSchema.parse(request);
  if(!["preview","apply"].includes(request.mode) || request.approvalReference!==OFFICIAL_COURSE_STANDING_REFERENCE ||
    (request.mode==='apply'&&!/^[a-f0-9]{64}$/u.test(request.expectedFingerprint??''))) throw new Error("Modo, autorização ou impressão da prévia inválidos.");
  const input=inputSchema.parse(request.input);
  const isMprj=input.contract.opportunityId===20;
  if(request.refreshMprjEvidence!==undefined && typeof request.refreshMprjEvidence!=="boolean") throw new Error("Refresh deve ser booleano explícito.");
  if(request.refreshMprjEvidence && !isMprj) throw new Error("Refresh delimitado ao MPRJ.");
  // The edital must still explicitly establish the objective multiple-choice stage.
  if(isMprj && (JSON.stringify(input.contract.profile)!==JSON.stringify(MPRJ_PROMOTOR_MULTIPLE_CHOICE_PROFILE) || input.productSlug || input.contract.examEditionId!==41 || input.contract.format!=="multiple_choice" ||
    !/múltipla escolha/iu.test(input.contract.sourceQuote) || !/100\s*\(cem\)\s*questões/iu.test(input.contract.sourceQuote) ||
    /não|nao/iu.test(input.contract.sourceQuote))) throw new Error("MPRJ exige edital literal MC/100 e admissão isolada, sem produto.");
  if(!isMprj && !officialFormatEvidenceMatches(input.contract.format,input.contract.sourceQuote)) throw new Error("Cláusula oficial não confirma o formato declarado, ou contém formatos ambíguos; revise etapa/caderno.");
  const primary=parseOfficialOpportunitySourceUrl(input.contract.sourceDocumentUrl);
  parseOfficialOpportunityDocumentUrl(input.contract.sourceUrl,primary.sourceId);
  const actorPublicId=z.uuid().parse(request.actorPublicId);
  // Network/PDF processing is bounded and outside the database transaction, on BOTH modes.
  const observation=isMprj ? await observeMprjMc5Cover() : null;
  const observedAt=Date.now();
  const verificationDate=new Date(observedAt).toISOString().slice(0,10);
  return db.transaction(async tx=>{
    let contract:OfficialQuestionContract=input.contract;
    let evidencePlan:ReturnType<typeof planMprjFormatEvidence>|null=null;
    await tx.execute(sql`set local statement_timeout='30s'`);
    await tx.execute(sql`set local lock_timeout='5s'`);
    const [actor]=await tx.execute<{id:number;role:string}>(sql`select id::int id,role from users where public_id=${actorPublicId}
      ${request.mode==='apply'?sql`for share`:sql``}`);
    if(!actor || actor.role!=='admin') throw new Error("Contrato de formato exige administrador autorizado.");
    if(request.mode==='apply') {
      await tx.execute(sql`select id from contest_opportunities where id=${contract.opportunityId} for update`);
      await tx.execute(sql`select id from opportunity_source_documents where id=${contract.sourceDocumentId} for share`);
      await tx.execute(sql`select id from opportunity_document_snapshots where id=${contract.sourceSnapshotId} for share`);
      await tx.execute(sql`select id from opportunity_organizer_assignments where id=${contract.organizerAssignmentId} for share`);
    }
    const [source]=await tx.execute<{role:string;specializationId:number|null;editionId:number|null;cycleYear:number;notice:string|null;institution:string;
      opportunityStatus:string;sourceStatus:string;snapshotStatus:string;sourceUrl:string;documentUrl:string;snapshotChecksum:string;
      sourceDocumentChecksum:string|null;bytesChecksum:string;pageText:string|null;identityText:string|null;bankId:number;assignmentStatus:string;assignmentRole:string;
      validUntil:string|null;bankActive:boolean;preferred:boolean;opportunityUpdatedAt:string;snapshotUpdatedAt:string;sourceReviewedAt:string|null;assignmentUpdatedAt:string;bankUpdatedAt:string}>(sql`
      select o.role_name role,o.specialization_id::int as "specializationId",o.exam_edition_id::int as "editionId",o.cycle_year as "cycleYear",
        o.official_notice_number notice,o.institution_acronym institution,o.editorial_status as "opportunityStatus",
        d.status as "sourceStatus",s.status as "snapshotStatus",d.source_url as "sourceUrl",d.checksum_sha256 as "sourceDocumentChecksum",s.document_url as "documentUrl",
        s.checksum_sha256 as "snapshotChecksum",encode(sha256(s.document_bytes),'hex') as "bytesChecksum",
        s.page_texts->>((${contract.sourcePage}::int)-1) as "pageText",s.page_texts->>((${contract.identityPage}::int)-1) as "identityText",
        a.quiz_bank_id::int as "bankId",a.status as "assignmentStatus",a.role as "assignmentRole",a.valid_until::text as "validUntil",
        (b.is_active and a.valid_from<=(now() at time zone 'America/Sao_Paulo')::date
          and e.status not in ('draft','canceled','archived') and e.bank_id=a.quiz_bank_id
          and e.career_track_id=o.career_track_id and e.specialization_id is not distinct from o.specialization_id) as "bankActive",
        (a.role='examination_provider' or (a.role='primary_responsible' and not exists(
          select 1 from opportunity_organizer_assignments examiner where examiner.opportunity_id=o.id
            and examiner.role='examination_provider' and examiner.status='reviewed' and examiner.valid_until is null))) preferred,
        o.updated_at::text as "opportunityUpdatedAt",s.updated_at::text as "snapshotUpdatedAt",d.reviewed_at::text as "sourceReviewedAt",a.updated_at::text as "assignmentUpdatedAt",b.updated_at::text as "bankUpdatedAt"
      from contest_opportunities o join opportunity_source_documents d on d.opportunity_id=o.id and d.id=${contract.sourceDocumentId}
      join opportunity_document_snapshots s on s.source_document_id=d.id and s.id=${contract.sourceSnapshotId}
      join opportunity_organizer_assignments a on a.opportunity_id=o.id and a.id=${contract.organizerAssignmentId}
      join quiz_banks b on b.id=a.quiz_bank_id join exam_editions e on e.id=o.exam_edition_id where o.id=${contract.opportunityId}
    `);
    if(!source || source.institution==='TCE-MA' || source.role!==contract.roleName || source.specializationId!==contract.specializationId ||
      source.editionId!==contract.examEditionId || source.cycleYear!==contract.cycleYear || source.notice!==contract.noticeNumber ||
      source.opportunityStatus!=='reviewed' || source.sourceStatus!=='approved' || source.snapshotStatus!=='approved' ||
      source.sourceUrl!==contract.sourceDocumentUrl || source.sourceDocumentChecksum!==contract.sourceDocumentChecksum || source.documentUrl!==contract.sourceUrl || source.snapshotChecksum!==contract.sourceSnapshotChecksum ||
      source.bytesChecksum!==contract.sourceSnapshotChecksum || source.bankId!==contract.bankId || source.assignmentStatus!=='reviewed' ||
      source.validUntil!==null || !source.bankActive || !source.preferred || !source.pageText || !source.identityText ||
      !normalize(source.pageText).includes(normalize(contract.sourceQuote)) || !normalize(source.identityText).includes(normalize(contract.identityQuote))) {
      throw new Error("Identidade, cargo único, etapa, fonte, bytes ou trechos oficiais não confirmados; contrato não admitido. TCE-MA exige trilhas próprias.");
    }
    if(observation) {
      const [identity]=await tx.execute<{name:string;username:string}>(sql`select current_database() as name,current_user as username`);
      if(identity?.name!=='leiprova' || identity.username!=='leiprova_owner') throw new Error("Evidência MPRJ exige leiprova_owner no banco leiprova.");
      const document=await readMprjFormatDocument(tx,request.mode==='apply');
      evidencePlan=planMprjFormatEvidence(contract,document,observation,verificationDate);
      contract=officialQuestionContractSchema.parse({...contract,formatEvidence:evidencePlan.evidence});
    }
    let contractId=questionContractFingerprint(contract);
    const evidenceId=evidencePlan?.evidence.evidenceId;
    const activeEvidence=evidencePlan ? await tx.execute<{id:string;status:string;expired:boolean;state:unknown}>(sql`
      select id,status,expires_at<=now() as expired,to_jsonb(official_question_format_evidence) as state from official_question_format_evidence where opportunity_id=20
      order by id ${request.mode==='apply'?sql`for update`:sql``}`) : [];
    let other:Array<{id:string;payload:OfficialQuestionContract}>=await tx.execute<{id:string;payload:OfficialQuestionContract}>(sql`select id,payload from opportunity_question_contracts where opportunity_id=${contract.opportunityId}
      and stage_key='objective' and status='approved' and id<>${contractId}`);
    if(evidencePlan && request.refreshMprjEvidence && other.length===1) {
      const previous=officialQuestionContractSchema.safeParse(other[0].payload);
      if(previous.success && other[0].id===questionContractFingerprint(previous.data) && sameMprjContractFacts(previous.data,contract) && activeEvidence.some(row=>
        row.id===previous.data.formatEvidence?.evidenceId && ['approved','superseded'].includes(row.status))) {
        // Keep existing questions/certificates attached to their original immutable contract.
        // The SQL gate independently requires a fresh, equivalent approved observation.
        contract=previous.data;
        contractId=other[0].id;
        other=[];
      }
    }
    if(other.length && !(evidencePlan && request.refreshMprjEvidence && other.every(row=>
      row.payload.formatEvidence && row.payload.examEditionId===41 &&
      activeEvidence.some(e=>e.id===row.payload.formatEvidence?.evidenceId && e.status==='approved')))) throw new Error("Já existe outro contrato ativo; não substituir evidência ou aprovação implicitamente.");
    if(evidencePlan) {
      const same=activeEvidence.find(row=>row.id===evidenceId);
      if(same && (same.status!=='approved' || same.expired)) throw new Error("Evidência encerrada não pode ser reaberta.");
      if(activeEvidence.some(row=>row.status==='approved' && row.id!==evidenceId) && !request.refreshMprjEvidence)
        throw new Error("Renovação exige refresh explícito após novo preview.");
    }
    const [existing]=await tx.execute<{status:string}>(sql`select status from opportunity_question_contracts where id=${contractId}`);
    if(existing && existing.status!=='approved') throw new Error("Contrato suspenso/superado não é reaberto por este operador.");
    if(request.mode==='apply' && existing) await lockQuestionContracts(tx,[contractId]);
    const values={id:contractId,...contract,optionKeys:contract.optionKeys,payload:contract,status:'approved',
      approvalReference:request.approvalReference,approvalBasis:'owner_standing_authorization',humanReview:false,
      reviewedByUserId:actor.id,reviewedAt:'2000-01-01T00:00:00Z',createdAt:'2000-01-01T00:00:00Z',updatedAt:'2000-01-01T00:00:00Z'};
    const databaseValues={id:values.id,opportunity_id:contract.opportunityId,exam_edition_id:contract.examEditionId,
      bank_id:contract.bankId,organizer_assignment_id:contract.organizerAssignmentId,role_name:contract.roleName,
      specialization_id:contract.specializationId,cycle_year:contract.cycleYear,notice_number:contract.noticeNumber,
      stage_key:contract.stageKey,scope:contract.scope,source_document_id:contract.sourceDocumentId,source_snapshot_id:contract.sourceSnapshotId,
      source_snapshot_checksum:contract.sourceSnapshotChecksum,source_url:contract.sourceUrl,format:contract.format,option_keys:contract.optionKeys,
      payload:contract,status:values.status,approval_reference:request.approvalReference,approval_basis:values.approvalBasis,human_review:false,
      reviewed_by_user_id:actor.id,reviewed_at:values.reviewedAt,created_at:values.createdAt,updated_at:values.updatedAt};
    if(input.productSlug) {
      const [product]=await tx.execute<{opportunityId:number|null}>(sql`select opportunity_id::int as "opportunityId" from contest_store_products where slug=${input.productSlug}`);
      if(!product || product.opportunityId!==contract.opportunityId) throw new Error("Produto não corresponde ao cargo/edição do contrato.");
    }
    const legacyFormats=input.productSlug ? await tx.execute(sql`select q.quiz_mode,q.type,
      (select jsonb_agg(option_key order by sort_order) from question_options where question_id=q.id) as option_keys,count(distinct q.id)::int questions
      from contest_product_question_bindings binding join questions q on q.id=binding.question_id
      where binding.product_slug=${input.productSlug} and binding.status='approved'
      group by q.quiz_mode,q.type,option_keys order by q.quiz_mode,q.type,option_keys`) : [];
    const certificates=input.productSlug ? await tx.execute<{id:string;questionId:number;contentHash:string}>(sql`
      with opportunity_question_contracts as (
        select * from public.opportunity_question_contracts where id<>${contractId}
        union all select (jsonb_populate_record(null::public.opportunity_question_contracts,${JSON.stringify(databaseValues)}::jsonb)).*
      ), question_contract_certifications as (
        select * from public.question_contract_certifications
        union all select binding.id,c.id,${questionContractContentHash(sql`q.id`)},'approved',${request.approvalReference},false,${actor.id}::bigint,'2000-01-01T00:00:00Z'::timestamptz
        from public.contest_product_question_bindings binding join questions q on q.id=binding.question_id
        join opportunity_question_contracts c on c.id=${contractId} and c.opportunity_id=binding.opportunity_id
        where binding.product_slug=${input.productSlug}
          and not exists(select 1 from public.question_contract_certifications old where old.binding_id=binding.id)
          and ${currentQuestionContractExists(sql`c.id`,sql`binding.opportunity_id`)}
          and ${questionOptionsMatchContract(sql`q.id`,sql`q.type`,sql`c.id`)}
      )
      select binding.id,binding.question_id::int as "questionId",${questionContractContentHash(sql`binding.question_id`)} as "contentHash"
      from public.contest_product_question_bindings binding
      where binding.product_slug=${input.productSlug} and ${approvedProductQuestionExists(sql`binding.product_slug`,sql`binding.question_id`,sql`binding.opportunity_id`,sql`binding.id`)}
      order by binding.id
    `) : [];
    if(certificates.length>250) throw new Error("Certificação excede 250 vínculos; dividir o escopo em operador próprio antes de aplicar.");
    if(request.mode==='apply' && certificates.length) {
      await tx.execute(sql`select id from contest_product_question_bindings where id in(
        ${sql.join(certificates.map(row=>sql`${row.id}`),sql`,`)}) order by id for share`);
      await lockApprovalScope(tx,{questionIds:[...new Set(certificates.map(row=>row.questionId))],legalArticleIds:[],styleBankIds:[]});
      for(const row of certificates) {
        const [live]=await tx.execute<{hash:string}>(sql`select ${questionContractContentHash(sql`${row.questionId}`)} as hash`);
        if(live?.hash!==row.contentHash) throw new Error("Conteúdo mudou durante a reserva da certificação; confira outra prévia.");
      }
    }
    const operationFingerprint=fingerprint({contractId,source,actorPublicId,actorId:actor.id,approvalReference:request.approvalReference,
      evidencePlan,activeEvidence,other,existing:existing??null,refreshMprjEvidence:request.refreshMprjEvidence??false,
      productSlug:input.productSlug??null,certificates});
    if(request.mode==='apply') {
      if(request.expectedFingerprint!==operationFingerprint) throw new Error("Fonte, contrato ou vínculos mudaram após o preview.");
      if(evidencePlan) {
        if(Date.now()-observedAt>60_000 || new Date().toISOString().slice(0,10)!==verificationDate) throw new Error("Observação transitória expirou; repetir preview e apply.");
        const previous=activeEvidence.filter(row=>row.status==='approved' && row.id!==evidenceId);
        if(previous.length && !request.refreshMprjEvidence) throw new Error("Renovação exige refresh explícito após novo preview.");
        const same=activeEvidence.find(row=>row.id===evidenceId);
        if(same && (same.status!=='approved' || same.expired)) throw new Error("Evidência encerrada não pode ser reaberta.");
        if(other.length) {
          await lockQuestionContracts(tx,other.map(row=>row.id));
          await tx.execute(sql`update opportunity_question_contracts set status='superseded',updated_at=now()
            where opportunity_id=20 and exam_edition_id=41 and status='approved' and id<>${contractId}`);
        }
        if(previous.length) await tx.execute(sql`update official_question_format_evidence set status='superseded',updated_at=now()
          where opportunity_id=20 and status='approved' and id<>${evidencePlan.evidence.evidenceId}`);
        if(!same) {
          const {document:d,evidence:f}=evidencePlan;
          await tx.insert(schema.officialQuestionFormatEvidence).values({
            id:f.evidenceId,opportunityId:20,examEditionId:41,bankId:contract.bankId,roleName:contract.roleName,
            institutionAcronym:'MPRJ',jurisdictionCode:'RJ',examEditionDocumentId:d.id,documentType:'question_booklet',
            documentPublicId:d.publicId,sourceUrl:f.sourceUrl,documentUpdatedAt:sql`${d.documentUpdatedAt}::text::timestamptz`,
            editionUpdatedAt:sql`${d.editionUpdatedAt}::text::timestamptz`,opportunityUpdatedAt:sql`${d.opportunityUpdatedAt}::text::timestamptz`,
            verificationDate,expiresAt:new Date(Date.parse(verificationDate+'T00:00:00Z')+2*86_400_000),
            sourceSha256:f.sourceSha256,robotsSha256:f.robotsSha256,pageNumber:1,pageTextSha256:f.pageTextSha256,
            parserVersion:f.parserVersion,format:f.format,optionCount:f.optionCount,singleCorrect:true,questionCount:100,
            approvalReference:request.approvalReference,reviewedByUserId:actor.id,reviewedAt:new Date(observedAt),
          });
          await tx.insert(schema.auditLogs).values({actorUserId:actor.id,action:'editorial.mprj_format_evidence.approved',
            entityType:'official_question_format_evidence',entityId:f.evidenceId,metadata:{before:{evidence:previous,contracts:other.map(row=>row.id)},
              after:f,operationFingerprint,approvalReference:request.approvalReference,approvalBasis:'owner_standing_authorization',humanReview:false,
              sourceTextStored:false,publicationAllowed:false}});
        }
      }
      if(!existing) {
        await tx.insert(schema.opportunityQuestionContracts).values({...contract,id:contractId,payload:contract,
          approvalReference:request.approvalReference,reviewedByUserId:actor.id,reviewedAt:new Date()});
        await lockQuestionContracts(tx,[contractId]);
        const [current]=await tx.execute(sql`select id from opportunity_question_contracts c
          where c.id=${contractId} and ${currentQuestionContractExists(sql`c.id`,sql`c.opportunity_id`)}`);
        if(!current) throw new Error("Edição, fonte ou examinador mudou durante a admissão do contrato.");
        await tx.insert(schema.auditLogs).values({actorUserId:actor.id,action:'editorial.question_contract.approved',entityType:'opportunity_question_contract',entityId:contractId,
          metadata:{approvalReference:request.approvalReference,approvalBasis:'owner_standing_authorization',humanReview:false,
            sourceSnapshotChecksum:contract.sourceSnapshotChecksum,roleName:contract.roleName,stageKey:contract.stageKey,
            operationFingerprint,publicationAllowed:false}});
      }
      if(certificates.length) await certifyProductBindingContracts(tx,certificates.map(row=>row.id),actor.id,request.approvalReference);
    }
    return {mode:request.mode,fingerprint:operationFingerprint,contractId,contract,evidencePlan,refreshRequired:other.length>0,legacyFormats,
      certificates,validQuestionCount:new Set(certificates.map(row=>row.questionId)).size,
      approvalBasis:'owner_standing_authorization',humanReview:false,publicationAllowed:false};
  },request.mode==='preview'?{isolationLevel:'repeatable read',accessMode:'read only'}:{isolationLevel:'serializable'});
}
