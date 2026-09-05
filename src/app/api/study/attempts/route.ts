import { and, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db/client";
import {
  legalActs,
  legalArticles,
  legalVersions,
  questionOptions,
  questions,
  reviewQueue,
  studyDays,
  userAttempts,
} from "@/lib/db/schema";
import { canStudyQuestion } from "@/lib/study/access-policy";
import { getStudyEntitlement } from "@/lib/study/entitlement";
import { authorialStudyRightsConditions } from "@/lib/study/question-rights";
import { confidenceValue, scheduleReview } from "@/lib/study/review";
import { consumeRateLimits, getRequestIp, rateLimitJsonResponse } from "@/lib/rate-limit";

const attemptSchema = z.object({
  questionId: z.string().min(1).max(160),
  optionId: z.string().min(1).max(16),
  confidence: z.enum(["guess", "almost", "sure"]),
  durationMs: z.number().int().min(0).max(10 * 60 * 1000),
});

function saoPauloDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const limited = await consumeRateLimits([
    { policy: "studyAttemptUserMinute", subject: { kind: "user", value: String(user.id) } },
    { policy: "studyAttemptUserDay", subject: { kind: "user", value: String(user.id) } },
    { policy: "studyAttemptIpMinute", subject: { kind: "ip", value: getRequestIp(request.headers) } },
  ]);
  if (limited) {
    return rateLimitJsonResponse(limited, "Você respondeu rápido demais. Aguarde um instante antes de continuar.");
  }

  const parsed = attemptSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_attempt" }, { status: 400 });

  const now = new Date();
  const entitlement = await getStudyEntitlement(user.id, now);
  if (!canStudyQuestion(entitlement, parsed.data.questionId)) {
    return NextResponse.json({ error: "question_not_found" }, { status: 404 });
  }

  const db = getDb();
  const [selected] = await db
    .select({
      questionDbId: questions.id,
      optionDbId: questionOptions.id,
      isCorrect: questionOptions.isCorrect,
      explanation: questions.explanation,
      literalText: legalArticles.literalText,
      articleRef: legalArticles.articleRef,
      officialUrl: legalActs.officialUrl,
    })
    .from(questions)
    .innerJoin(questionOptions, eq(questionOptions.questionId, questions.id))
    .innerJoin(legalArticles, eq(questions.legalArticleId, legalArticles.id))
    .innerJoin(legalVersions, eq(legalArticles.legalVersionId, legalVersions.id))
    .innerJoin(legalActs, eq(legalVersions.legalActId, legalActs.id))
    .where(
      and(
        eq(questions.publicId, parsed.data.questionId),
        eq(questionOptions.optionKey, parsed.data.optionId),
        eq(questions.editorialStatus, "reviewed"),
        authorialStudyRightsConditions(),
        eq(legalArticles.editorialStatus, "reviewed"),
        eq(legalVersions.status, "current"),
        eq(legalActs.isActive, true),
      ),
    )
    .limit(1);

  if (!selected) return NextResponse.json({ error: "question_not_found" }, { status: 404 });

  const [correctOption] = await db
    .select({ optionId: questionOptions.optionKey })
    .from(questionOptions)
    .where(and(eq(questionOptions.questionId, selected.questionDbId), eq(questionOptions.isCorrect, true)))
    .limit(1);

  const confidenceScore = confidenceValue(parsed.data.confidence);
  const xp = selected.isCorrect ? (confidenceScore === 3 ? 10 : 8) : 2;
  const minutesStudied = Math.max(0, Math.round(parsed.data.durationMs / 60_000));

  const nextReviewAt = await db.transaction(async (tx) => {
    const [currentReview] = await tx
      .select({ stage: reviewQueue.stage, repetitions: reviewQueue.repetitions, lapses: reviewQueue.lapses })
      .from(reviewQueue)
      .where(and(eq(reviewQueue.userId, user.id), eq(reviewQueue.questionId, selected.questionDbId)))
      .limit(1);

    const { nextStage, nextReviewAt: nextReview } = scheduleReview({
      currentStage: currentReview?.stage ?? 0,
      isCorrect: selected.isCorrect,
      confidence: parsed.data.confidence,
      now,
    });

    await tx.insert(userAttempts).values({
      userId: user.id,
      questionId: selected.questionDbId,
      selectedOptionId: selected.optionDbId,
      isCorrect: selected.isCorrect,
      confidence: confidenceScore,
      durationMs: parsed.data.durationMs,
      answeredAt: now,
    });

    await tx
      .insert(reviewQueue)
      .values({
        userId: user.id,
        questionId: selected.questionDbId,
        stage: nextStage,
        repetitions: 1,
        lapses: selected.isCorrect ? 0 : 1,
        nextReviewAt: nextReview,
        lastReviewedAt: now,
        lastResult: selected.isCorrect ? `correct_${parsed.data.confidence}` : `wrong_${parsed.data.confidence}`,
      })
      .onConflictDoUpdate({
        target: [reviewQueue.userId, reviewQueue.questionId],
        set: {
          stage: nextStage,
          repetitions: (currentReview?.repetitions ?? 0) + 1,
          lapses: (currentReview?.lapses ?? 0) + (selected.isCorrect ? 0 : 1),
          nextReviewAt: nextReview,
          lastReviewedAt: now,
          lastResult: selected.isCorrect ? `correct_${parsed.data.confidence}` : `wrong_${parsed.data.confidence}`,
          updatedAt: now,
        },
      });

    await tx
      .insert(studyDays)
      .values({
        userId: user.id,
        studyDate: saoPauloDate(),
        answeredCount: 1,
        correctCount: selected.isCorrect ? 1 : 0,
        minutesStudied,
        xpEarned: xp,
      })
      .onConflictDoUpdate({
        target: [studyDays.userId, studyDays.studyDate],
        set: {
          answeredCount: sql`${studyDays.answeredCount} + 1`,
          correctCount: sql`${studyDays.correctCount} + ${selected.isCorrect ? 1 : 0}`,
          minutesStudied: sql`${studyDays.minutesStudied} + ${minutesStudied}`,
          xpEarned: sql`${studyDays.xpEarned} + ${xp}`,
          updatedAt: now,
        },
      });

    return nextReview;
  });

  return NextResponse.json({
    isCorrect: selected.isCorrect,
    correctOptionId: correctOption?.optionId,
    literalText: selected.literalText,
    explanation: selected.explanation,
    articleRef: selected.articleRef,
    officialUrl: selected.officialUrl,
    xp,
    nextReviewAt: nextReviewAt.toISOString(),
  });
}
