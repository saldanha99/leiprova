import { and, eq, inArray,or } from "drizzle-orm";
import { originalQuestionContractExists } from "./original-question-contract-query";

import { questions } from "@/lib/db/schema";

/** O treino de lei seca não herda licenças de reprodução de provas anteriores.
 * Aplicado ao enfileiramento e à leitura/resposta, inclusive a filas antigas. */
export function authorialStudyRightsConditions() {
  return and(
    inArray(questions.quizMode, ["dry_law", "original_style"]),
    eq(questions.sourceRights, "original_authorial"),
    or(eq(questions.quizMode,'dry_law'),originalQuestionContractExists(questions.id,questions.type,questions.styleBankId,questions.questionContractId)),
  );
}
