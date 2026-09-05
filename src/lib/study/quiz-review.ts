import { and, eq, inArray, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

import * as schema from "@/lib/db/schema";
import { authorialStudyRightsConditions } from "@/lib/study/question-rights";

type Executor = Pick<PostgresJsDatabase<typeof schema>, "select" | "insert">;

/** Recebe somente tentativas recém-inseridas no registro idempotente da sessão. */
export async function enqueueNewQuizMistakes(db: Executor, userId: number,
  newlyRecorded: readonly { questionId: number; isCorrect: boolean }[], now: Date) {
  const wrongIds = newlyRecorded.filter((answer) => !answer.isCorrect).map((answer) => answer.questionId);
  if (!wrongIds.length) return 0;
  const { questions, legalArticles, legalVersions, legalActs, reviewQueue } = schema;
  const eligible = await db.select({ id: questions.id }).from(questions)
    .innerJoin(legalArticles, eq(questions.legalArticleId, legalArticles.id))
    .innerJoin(legalVersions, eq(legalArticles.legalVersionId, legalVersions.id))
    .innerJoin(legalActs, eq(legalVersions.legalActId, legalActs.id))
    .where(and(inArray(questions.id, wrongIds), eq(questions.editorialStatus, "reviewed"),
      authorialStudyRightsConditions(),
      eq(legalArticles.editorialStatus, "reviewed"), eq(legalVersions.status, "current"),
      eq(legalActs.isActive, true)));
  if (!eligible.length) return 0;
  const next = new Date(now.getTime() + 86_400_000);
  await db.insert(reviewQueue).values(eligible.map(({ id }) => ({
    userId, questionId: id, stage: 0, repetitions: 1, lapses: 1,
    nextReviewAt: next, lastReviewedAt: now, lastResult: "wrong_quiz", updatedAt: now,
  }))).onConflictDoUpdate({ target: [reviewQueue.userId, reviewQueue.questionId], set: {
    stage: 0, repetitions: sql`${reviewQueue.repetitions} + 1`, lapses: sql`${reviewQueue.lapses} + 1`,
    // Um erro novo não adia uma revisão que já estava vencida.
    nextReviewAt: sql`least(${reviewQueue.nextReviewAt}, ${next.toISOString()}::timestamptz)`,
    lastReviewedAt: now, lastResult: "wrong_quiz", updatedAt: now,
  } });
  return eligible.length;
}
