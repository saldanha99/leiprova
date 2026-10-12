import { sql,type SQLWrapper } from "drizzle-orm";
import { currentQuestionContractExists,questionOptionsMatchContract } from "../editorial/question-contract-query";
import { approvedProductQuestionExists } from "../commerce/product-binding-query";

/** O treino genérico não pode ressuscitar uma inédita de cargo com contrato suspenso.
 * Legado só entra por certificação exata já auditada, nunca pelo nome da banca. */
export function originalQuestionContractExists(questionId:SQLWrapper,questionType:SQLWrapper,bankId:SQLWrapper,
  contractId:SQLWrapper,examEditionId?:number|SQLWrapper) {
  return sql`exists(select 1 from opportunity_question_contracts study_contract
    where study_contract.bank_id=${bankId}
      ${examEditionId ? sql`and study_contract.exam_edition_id=${examEditionId}`:sql``}
      and ${currentQuestionContractExists(sql`study_contract.id`)}
      and ${questionOptionsMatchContract(questionId,questionType,sql`study_contract.id`)}
      and (study_contract.id=${contractId} or (${contractId} is null and exists(
        select 1 from contest_product_question_bindings study_binding
        join question_contract_certifications study_cert on study_cert.binding_id=study_binding.id
        where study_binding.question_id=${questionId} and study_cert.contract_id=study_contract.id
          and ${approvedProductQuestionExists(sql`study_binding.product_slug`,questionId,sql`study_binding.opportunity_id`,sql`study_binding.id`)}
      )))
  )`;
}
