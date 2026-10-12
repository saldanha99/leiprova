import { isOpportunityFreshForPublicCatalog } from "../opportunities/catalog-policy";

export const PREPARATION_MODES = ["current_notice", "historical_training", "pre_notice"] as const;
export type PreparationMode = (typeof PREPARATION_MODES)[number];
export const preparationModeLabels: Record<PreparationMode, string> = {
  current_notice: "Preparação do edital",
  historical_training: "Treino histórico · legislação atualizada",
  pre_notice: "Pré-edital · legislação atualizada",
};
export const preparationModeDescriptions: Record<PreparationMode, string> = {
  current_notice: "Treino autoral vinculado ao programa oficial desta edição.",
  historical_training: "Questões inéditas com legislação vigente sobre o programa desta edição passada. Não é a reprodução da prova nem um simulado com a legislação histórica.",
  pre_notice: "Programa de referência de uma edição anterior, com legislação vigente. O novo edital e sua banca ainda precisam de confirmação; o programa pode mudar.",
};

export type PreparationEligibility = {
  preparationMode?: string;
  preparationReviewedAt?: Date | string | null;
  preparationReviewedByUserId?: number | string | null;
  preparationApprovalReference?: string | null;
  preparationOpportunityUpdatedAt?: Date | string | null;
  opportunityUpdatedAt?: Date | string | null;
  lifecycleStatus: string | null;
  statusAsOf: string | null;
  registrationEndsAt: string | null;
  examDate: string | null;
  noticePublishedAt?: string | null;
};

export function isPreparationMode(value: string): value is PreparationMode {
  return (PREPARATION_MODES as readonly string[]).includes(value);
}

/** Não infere o modo a partir de data vencida: uma oferta histórica ou pré-edital
 * exige decisão própria, programa oficial e revisão da versão exata da edição. */
export function preparationEligibilityBlocker(state: PreparationEligibility, todayIso: string): string | null {
  const mode = state.preparationMode ?? "current_notice";
  if (!isPreparationMode(mode)) return "modo de preparação inválido";
  if (mode === "current_notice") {
    return isOpportunityFreshForPublicCatalog({
      lifecycleStatus: state.lifecycleStatus ?? "",
      statusAsOf: state.statusAsOf ?? "",
      registrationEndsAt: state.registrationEndsAt,
      examDate: state.examDate,
    }, todayIso) ? null : "edital fora do catálogo público (fase ou data vencida)";
  }
  if (!state.preparationReviewedAt || !state.preparationReviewedByUserId || !state.preparationApprovalReference) {
    return "programa histórico ou pré-edital sem revisão explícita";
  }
  const reviewed = new Date(state.preparationOpportunityUpdatedAt ?? "").getTime();
  const current = new Date(state.opportunityUpdatedAt ?? "").getTime();
  if (!Number.isFinite(reviewed) || reviewed !== current) return "programa de referência alterado após a revisão";
  if (!state.noticePublishedAt || !state.examDate || state.examDate >= todayIso
    || ["canceled", "suspended"].includes(state.lifecycleStatus ?? "")) {
    return "programa de referência exige edital oficial de edição já realizada";
  }
  return null;
}
