export const FREE_STUDY_QUESTION_IDS = [
  "cf-art-5-iv-manifestacao-pensamento",
  "cf-art-37-caput-principios-administracao",
  "cf-art-41-caput-estabilidade",
  "cf-art-84-ii-direcao-administracao-federal",
  "cf-art-144-caput-seguranca-publica",
] as const;

const freeQuestionIds = new Set<string>(FREE_STUDY_QUESTION_IDS);

export type StudyEntitlement = {
  hasFullAccess: boolean;
};

export function canStudyQuestion(entitlement: StudyEntitlement, questionPublicId: string) {
  return entitlement.hasFullAccess || freeQuestionIds.has(questionPublicId);
}
