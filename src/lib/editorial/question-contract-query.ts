import { sql, type SQLWrapper } from "drizzle-orm";

/** Fonte de formato pode ser diferente da página que contém o programa. */
export function currentQuestionContractExists(contractId: SQLWrapper, opportunityId?: SQLWrapper) {
  return sql`exists (
    select 1 from opportunity_question_contracts current_scoped_contract
    join contest_opportunities contract_current_opportunity on contract_current_opportunity.id=current_scoped_contract.opportunity_id
    join exam_editions contract_current_edition on contract_current_edition.id=current_scoped_contract.exam_edition_id
    join opportunity_source_documents contract_current_source on contract_current_source.id=current_scoped_contract.source_document_id
    join opportunity_document_snapshots contract_current_snapshot on contract_current_snapshot.id=current_scoped_contract.source_snapshot_id
    join opportunity_organizer_assignments contract_current_assignment on contract_current_assignment.id=current_scoped_contract.organizer_assignment_id
    join quiz_banks contract_current_bank on contract_current_bank.id=current_scoped_contract.bank_id
    where current_scoped_contract.id=${contractId} ${opportunityId ? sql`and current_scoped_contract.opportunity_id=${opportunityId}` : sql``}
      and (case when current_scoped_contract.opportunity_id=20 then
        public.mprj_question_format_evidence_current(current_scoped_contract.payload,current_scoped_contract.opportunity_id,current_scoped_contract.exam_edition_id,current_scoped_contract.bank_id)
        else not (current_scoped_contract.payload ? 'formatEvidence') end)
      and current_scoped_contract.status='approved' and current_scoped_contract.stage_key='objective' and current_scoped_contract.scope='single_role'
      and current_scoped_contract.role_name=contract_current_opportunity.role_name and current_scoped_contract.exam_edition_id=contract_current_opportunity.exam_edition_id
      and current_scoped_contract.specialization_id is not distinct from contract_current_opportunity.specialization_id
      and current_scoped_contract.cycle_year=contract_current_opportunity.cycle_year and current_scoped_contract.notice_number=contract_current_opportunity.official_notice_number
      and contract_current_opportunity.editorial_status='reviewed'
      and contract_current_edition.status not in ('draft','canceled','archived') and contract_current_edition.bank_id=current_scoped_contract.bank_id
      and contract_current_edition.career_track_id=contract_current_opportunity.career_track_id and contract_current_edition.specialization_id is not distinct from contract_current_opportunity.specialization_id
      and contract_current_source.opportunity_id=contract_current_opportunity.id and contract_current_source.status='approved' and contract_current_source.source_url=current_scoped_contract.payload->>'sourceDocumentUrl'
      and contract_current_source.checksum_sha256 is not distinct from current_scoped_contract.payload->>'sourceDocumentChecksum'
      and contract_current_snapshot.source_document_id=contract_current_source.id and contract_current_snapshot.status='approved'
      and contract_current_snapshot.document_url=current_scoped_contract.source_url and contract_current_snapshot.checksum_sha256=current_scoped_contract.source_snapshot_checksum
      and contract_current_assignment.opportunity_id=contract_current_opportunity.id and contract_current_assignment.quiz_bank_id=current_scoped_contract.bank_id and contract_current_assignment.status='reviewed'
      and contract_current_assignment.valid_from<=(now() at time zone 'America/Sao_Paulo')::date and contract_current_assignment.valid_until is null and contract_current_bank.is_active
      and (contract_current_assignment.role='examination_provider' or (contract_current_assignment.role='primary_responsible' and not exists (
        select 1 from opportunity_organizer_assignments contract_current_examiner
        where contract_current_examiner.opportunity_id=contract_current_opportunity.id and contract_current_examiner.role='examination_provider'
          and contract_current_examiner.status='reviewed' and contract_current_examiner.valid_until is null)))
  )`;
}

export function questionOptionsMatchContract(questionId: SQLWrapper, questionType: SQLWrapper, contractId: SQLWrapper) {
  return sql`exists (select 1 from opportunity_question_contracts format_contract
    where format_contract.id=${contractId} and format_contract.format=${questionType}
      and (select count(*) from question_options qo where qo.question_id=${questionId})=jsonb_array_length(format_contract.option_keys)
      and (select count(*) from question_options qo where qo.question_id=${questionId} and qo.is_correct)=1
      and (select count(distinct lower(regexp_replace(btrim(qo.text),'[[:space:]]+',' ','g')))
        from question_options qo where qo.question_id=${questionId})=jsonb_array_length(format_contract.option_keys)
      and (select jsonb_agg(qo.option_key order by qo.sort_order) from question_options qo where qo.question_id=${questionId})=format_contract.option_keys
      and (format_contract.format<>'true_false' or (select jsonb_agg(lower(btrim(qo.text)) order by qo.sort_order)
        from question_options qo where qo.question_id=${questionId})='["certo","errado"]'::jsonb)
  )`;
}

/** Mesma fotografia JSONB já usada pelo vínculo; hash calculado no PostgreSQL. */
export function questionContractContentHash(questionId: SQLWrapper) {
  return sql`(select encode(sha256(convert_to(jsonb_build_object(
    'prompt',cq.prompt,'explanation',cq.explanation,'type',cq.type,'learningObjective',cq.learning_objective,
    'options',coalesce((select jsonb_agg(jsonb_build_object('optionKey',co.option_key,'text',co.text,
      'isCorrect',co.is_correct,'rationale',co.rationale,'sortOrder',co.sort_order) order by co.sort_order)
      from question_options co where co.question_id=cq.id),'[]'::jsonb))::text,'UTF8')),'hex')
    from questions cq where cq.id=${questionId})`;
}

export function approvedBindingQuestionContractExists(bindingId: SQLWrapper, questionId: SQLWrapper, opportunityId: SQLWrapper) {
  return sql`exists (select 1 from question_contract_certifications verified_binding_contract_certificate
    join questions certified_contract_question on certified_contract_question.id=${questionId}
    where verified_binding_contract_certificate.binding_id=${bindingId} and verified_binding_contract_certificate.status='approved'
      and ${currentQuestionContractExists(sql`verified_binding_contract_certificate.contract_id`, opportunityId)}
      and ${questionOptionsMatchContract(sql`certified_contract_question.id`, sql`certified_contract_question.type`, sql`verified_binding_contract_certificate.contract_id`)}
      and verified_binding_contract_certificate.question_content_hash=${questionContractContentHash(sql`certified_contract_question.id`)}
      and (certified_contract_question.question_contract_id is null or certified_contract_question.question_contract_id=verified_binding_contract_certificate.contract_id)
      and (certified_contract_question.quiz_mode='dry_law' or exists (select 1 from opportunity_question_contracts certified_question_author_contract
        where certified_question_author_contract.id=verified_binding_contract_certificate.contract_id and certified_question_author_contract.bank_id=certified_contract_question.style_bank_id))
  )`;
}
