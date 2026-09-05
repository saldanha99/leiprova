import { and, eq, inArray } from "drizzle-orm";

import { questions } from "@/lib/db/schema";

/** O treino de lei seca não herda licenças de reprodução de provas anteriores.
 * Aplicado ao enfileiramento e à leitura/resposta, inclusive a filas antigas. */
export function authorialStudyRightsConditions() {
  return and(
    inArray(questions.quizMode, ["dry_law", "original_style"]),
    eq(questions.sourceRights, "original_authorial"),
  );
}
