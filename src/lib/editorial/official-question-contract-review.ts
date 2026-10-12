import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { z } from "zod";
import * as schema from "../db/schema";
import { approvedProductQuestionExists } from "../commerce/product-binding-query";
import { officialQuestionContractSchema, questionContractFingerprint,officialFormatEvidenceMatches } from "./official-question-contract";
import { OFFICIAL_COURSE_STANDING_REFERENCE } from "./official-course-dossier";
import { currentQuestionContractExists, questionContractContentHash, questionOptionsMatchContract } from "./question-contract-query";
import { certifyProductBindingContracts, lockQuestionContracts } from "./question-contract-service";
import { parseOfficialOpportunitySourceUrl,parseOfficialOpportunityDocumentUrl } from "../opportunities/source-monitor-policy";
import { lockApprovalScope } from "./approval-lock";

const inputSchema=z.object({contract:officialQuestionContractSchema,productSlug:z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u).optional()}).strict();
const normalize=(text:string)=>text.normalize("NFKC").replace(/\s+/gu," ").trim();
const fingerprint=(value:unknown)=>createHash("sha256").update(JSON.stringify(value)).digest("hex");

/** Operador de manutenção: nunca expor em formulário público nem usar credenciais do pacote. */
export async function reviewOfficialQuestionContract(db:PostgresJsDatabase<typeof schema>,request:{
  input:unknown;actorPublicId:string;approvalReference:string;mode:"preview"|"apply";expectedFingerprint?:string;
}) {
  if(!["preview","apply"].includes(request.mode) || request.approvalReference!==OFFICIAL_COURSE_STANDING_REFERENCE ||
    (request.mode==='apply'&&!/^[a-f0-9]{64}$/u.test(request.expectedFingerprint??''))) throw new Error("Modo, autorização ou impressão da prévia inválidos.");
  const input=inputSchema.parse(request.input),contract=input.contract,contractId=questionContractFingerprint(contract);
  if(!officialFormatEvidenceMatches(contract.format,contract.sourceQuote)) throw new Error("Cláusula oficial não confirma o formato declarado, ou contém formatos ambíguos; revise etapa/caderno.");
  const primary=parseOfficialOpportunitySourceUrl(contract.sourceDocumentUrl);
  parseOfficialOpportunityDocumentUrl(contract.sourceUrl,primary.sourceId);
  const actorPublicId=z.uuid().parse(request.actorPublicId);
  return db.transaction(async tx=>{
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
      validUntil:string|null;bankActive:boolean;preferred:boolean;opportunityUpdatedAt:string;snapshotUpdatedAt:string}>(sql`
      select o.role_name role,o.specialization_id::int as "specializationId",o.exam_edition_id::int as "editionId",o.cycle_year as "cycleYear",
        o.official_notice_number notice,o.institution_acronym institution,o.editorial_status as "opportunityStatus",
        d.status as "sourceStatus",s.status as "snapshotStatus",d.source_url as "sourceUrl",d.checksum_sha256 as "sourceDocumentChecksum",s.document_url as "documentUrl",
        s.checksum_sha256 as "snapshotChecksum",encode(sha256(s.document_bytes),'hex') as "bytesChecksum",
        s.page_texts->>(${contract.sourcePage}-1) as "pageText",s.page_texts->>(${contract.identityPage}-1) as "identityText",
        a.quiz_bank_id::int as "bankId",a.status as "assignmentStatus",a.role as "assignmentRole",a.valid_until::text as "validUntil",
        (b.is_active and a.valid_from<=(now() at time zone 'America/Sao_Paulo')::date
          and e.status not in ('draft','canceled','archived') and e.bank_id=a.quiz_bank_id
          and e.career_track_id=o.career_track_id and e.specialization_id is not distinct from o.specialization_id) as "bankActive",
        (a.role='examination_provider' or (a.role='primary_responsible' and not exists(
          select 1 from opportunity_organizer_assignments examiner where examiner.opportunity_id=o.id
            and examiner.role='examination_provider' and examiner.status='reviewed' and examiner.valid_until is null))) preferred,
        o.updated_at::text as "opportunityUpdatedAt",s.updated_at::text as "snapshotUpdatedAt"
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
    const other=await tx.execute(sql`select id from opportunity_question_contracts where opportunity_id=${contract.opportunityId}
      and stage_key='objective' and status='approved' and id<>${contractId}`);
    if(other.length) throw new Error("Já existe outro contrato ativo; não substituir evidência ou aprovação implicitamente.");
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
    const operationFingerprint=fingerprint({contractId,source,actorPublicId,approvalReference:request.approvalReference,
      productSlug:input.productSlug??null,certificates});
    if(request.mode==='apply') {
      if(request.expectedFingerprint!==operationFingerprint) throw new Error("Fonte, contrato ou vínculos mudaram após o preview.");
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
    return {mode:request.mode,fingerprint:operationFingerprint,contractId,contract,legacyFormats,
      certificates,validQuestionCount:new Set(certificates.map(row=>row.questionId)).size,
      approvalBasis:'owner_standing_authorization',humanReview:false,publicationAllowed:false};
  },request.mode==='preview'?{isolationLevel:'repeatable read',accessMode:'read only'}:{isolationLevel:'serializable'});
}
