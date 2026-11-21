/** Contrato da barra por questão (quiz e "Treinar agora"), sem zod: também vai ao cliente. */

export const QUESTION_REPORT_REASONS = [
  { value: "answer_key", label: "Gabarito errado" },
  { value: "outdated_law", label: "Lei desatualizada ou revogada" },
  { value: "wrong_article", label: "Artigo ou fonte não confere" },
  { value: "ambiguous", label: "Enunciado ambíguo ou com duas respostas" },
  { value: "typo", label: "Erro de digitação ou formatação" },
  { value: "other", label: "Outro problema" },
] as const;

export type QuestionReportReason = (typeof QUESTION_REPORT_REASONS)[number]["value"];

export const QUESTION_REPORT_NOTES_MAX = 600;
/** Abaixo disso o percentual da turma diz pouco e pode identificar quem respondeu. */
export const CLASS_STATS_MIN_ANSWERS = 20;
export const QUESTION_HISTORY_LIMIT = 20;

export type QuestionHistoryEntry = {
  answeredAt: string;
  isCorrect: boolean;
  optionKey: string | null;
  origin: "treino" | "quiz" | "simulado";
};

export type QuestionBarResponse =
  | { action: "history"; entries: QuestionHistoryEntry[] }
  | { action: "stats"; available: true; answers: number; correctPercent: number }
  | { action: "stats"; available: false; answers: number }
  | { action: "review"; status: "queued"; nextReviewAt: string }
  | { action: "review"; status: "not_reviewable" }
  | { action: "report"; status: "created" | "already_open" };

export function summarizeClassStats(answers: number, correct: number): Extract<QuestionBarResponse, { action: "stats" }> {
  const safeAnswers = Math.max(0, Math.trunc(answers));
  if (safeAnswers < CLASS_STATS_MIN_ANSWERS) return { action: "stats", available: false, answers: safeAnswers };
  const safeCorrect = Math.min(safeAnswers, Math.max(0, Math.trunc(correct)));
  return {
    action: "stats",
    available: true,
    answers: safeAnswers,
    correctPercent: Math.round((safeCorrect / safeAnswers) * 100),
  };
}
