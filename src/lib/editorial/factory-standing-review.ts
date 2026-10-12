import {sql,type SQLWrapper} from 'drizzle-orm';
import {OFFICIAL_COURSE_STANDING_REFERENCE} from './official-course-dossier';

export const FACTORY_STANDING_REVIEW_REFERENCE='owner-standing-2026-10-11:aprovar-sozinho' as const;
export const FACTORY_BULK_REVIEW_REFERENCE='owner-chat-2026-10-11:viu-tudo-libere-em-massa' as const;

/** A aprovação da fábrica deve estar registrada para a questão e oportunidade exatas. */
export function approvedFactoryQuestionProvenanceExists(questionId:SQLWrapper,opportunityId:SQLWrapper){
 return sql`exists(select 1 from questions factory_review_question
  join contest_opportunities factory_review_opportunity on factory_review_opportunity.id=${opportunityId}
  join audit_logs factory_review_audit on factory_review_audit.entity_type='question'
    and factory_review_audit.entity_id=factory_review_question.public_id
  where factory_review_question.id=${questionId}
    and factory_review_question.quiz_mode='original_style'
    and factory_review_question.source_rights='original_authorial'
    and factory_review_question.editorial_status='reviewed'
    and factory_review_audit.action='editorial.original_question.batch_approved'
    and factory_review_audit.metadata->>'executionSource'='server_cli'
    and factory_review_audit.metadata->>'contestSlug'=factory_review_opportunity.slug
    and ((factory_review_audit.metadata->>'approvalReference'=${FACTORY_STANDING_REVIEW_REFERENCE}
      and factory_review_audit.metadata->>'approvalMode'='owner_standing_authorization'
      and factory_review_audit.metadata->>'humanItemReview'='false')
      or(factory_review_audit.metadata->>'approvalReference'=${FACTORY_BULK_REVIEW_REFERENCE}
      and factory_review_audit.metadata->>'approvalMode'='owner_authorization'
      and factory_review_audit.metadata->>'itemBindingMode'='owner_bulk_authorization')))`;
}

export function requireFactoryStandingReview(reference:unknown,role:string,decision:string){
 if(reference!==FACTORY_STANDING_REVIEW_REFERENCE||role!=='admin'||decision!=='approve')
  throw new Error('Revisão automática exige referência permanente exata, administrador e aprovação delimitada.');
 return {approvalBasis:'owner_standing_authorization' as const,approvalReference:FACTORY_STANDING_REVIEW_REFERENCE,
  sourceProgramReference:OFFICIAL_COURSE_STANDING_REFERENCE,humanReview:false as const,humanReviewRecorded:false as const};
}
