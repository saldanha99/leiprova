import type { QuizModeSlug } from "./catalog";
import type { QuizQuestionSource } from "./session-contract";

type SourceInput = {
  mode: QuizModeSlug;
  sourceTitle: string | null;
  sourceUrl: string | null;
  verifiedAt: Date;
  legalActTitle: string | null;
  officialLegalUrl: string | null;
  styleBankName: string | null;
};

export function formatQuizQuestionSource(input: SourceInput): QuizQuestionSource {
  const verifiedAt = input.verifiedAt.toISOString().slice(0, 10);

  if (input.mode === "previous_exam") {
    if (!input.sourceTitle || !input.sourceUrl) {
      throw new Error("Questão anterior sem procedência completa.");
    }
    return {
      kind: "licensed_exam",
      label: input.sourceTitle,
      url: input.sourceUrl,
      verifiedAt,
    };
  }

  if (input.mode === "original_style") {
    return {
      kind: "authorial",
      label:
        input.sourceTitle ??
        `Questão autoral revisada${input.styleBankName ? ` • estilo ${input.styleBankName}` : ""}`,
      url: input.sourceUrl,
      verifiedAt,
    };
  }

  return {
    kind: "official_law",
    label: input.legalActTitle ?? "Texto legal oficial verificado",
    url: input.officialLegalUrl,
    verifiedAt,
  };
}

export function emptyQuizReason(mode: QuizModeSlug) {
  if (mode === "previous_exam") {
    return {
      reason: "no_licensed_previous_exam" as const,
      message: "Ainda não há questões anteriores licenciadas para esta seleção.",
    };
  }
  if (mode === "original_style") {
    return {
      reason: "no_reviewed_original_questions" as const,
      message: "Ainda não há questões inéditas revisadas para esta seleção.",
    };
  }
  return {
    reason: "no_reviewed_questions" as const,
    message: "Ainda não há questões revisadas para esta seleção.",
  };
}

export function calculateQuizResult(total: number, answerResults: readonly (boolean | null)[]) {
  const safeTotal = Math.max(0, Math.trunc(total));
  const answered = answerResults.filter((result) => result !== null).length;
  const correct = answerResults.filter((result) => result === true).length;
  return {
    total: safeTotal,
    answered,
    correct,
    scorePercent: safeTotal === 0 ? 0 : Math.round((correct / safeTotal) * 100),
  };
}

export function calculateQuizDeadline(
  now: Date,
  options: { timed: boolean; count: number; editionDurationMinutes?: number | null },
) {
  if (!options.timed) return null;
  const durationMs = options.editionDurationMinutes
    ? options.editionDurationMinutes * 60 * 1_000
    : Math.max(1, Math.trunc(options.count)) * 90 * 1_000;
  return new Date(now.getTime() + Math.min(durationMs, 24 * 60 * 60 * 1_000));
}

export function normalizeQuizDurationMs(startedAt: number, eventAt: number) {
  const elapsed = eventAt - startedAt;
  if (!Number.isFinite(elapsed)) return 0;
  return Math.round(Math.max(0, Math.min(30 * 60 * 1_000, elapsed)));
}
