export const REVIEW_INTERVALS = [1, 3, 7, 15, 30, 60, 90] as const;

export type StudyConfidence = "guess" | "almost" | "sure";

export function confidenceValue(confidence: StudyConfidence) {
  return confidence === "guess" ? 1 : confidence === "almost" ? 2 : 3;
}

export function scheduleReview({
  currentStage,
  isCorrect,
  confidence,
  now = new Date(),
}: {
  currentStage: number;
  isCorrect: boolean;
  confidence: StudyConfidence;
  now?: Date;
}) {
  const normalizedStage = Math.max(0, Math.min(REVIEW_INTERVALS.length - 1, currentStage));
  const nextStage = isCorrect
    ? Math.min(REVIEW_INTERVALS.length - 1, normalizedStage + (confidence === "sure" ? 1 : 0))
    : 0;
  const nextReviewAt = new Date(now);
  nextReviewAt.setUTCDate(nextReviewAt.getUTCDate() + REVIEW_INTERVALS[nextStage]);

  return { nextStage, nextReviewAt, intervalDays: REVIEW_INTERVALS[nextStage] };
}
