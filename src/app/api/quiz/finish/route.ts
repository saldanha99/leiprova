import { and, asc, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db/client";
import {
  legalActs,
  legalArticles,
  legalVersions,
  questionOptions,
  questions,
  quizBanks,
  quizSessionAnswers,
  quizSessionQuestions,
  quizSessions,
  studyDays,
  userAttempts,
} from "@/lib/db/schema";
import { calculateQuizResult, formatQuizQuestionSource } from "@/lib/quiz/response";
import { quizFinishRequestSchema } from "@/lib/quiz/session-contract";
import { canStudyQuestion } from "@/lib/study/access-policy";
import { getStudyEntitlement } from "@/lib/study/entitlement";

export const dynamic = "force-dynamic";

function saoPauloDate(now: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = quizFinishRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_session" }, { status: 400 });

  const db = getDb();
  const now = new Date();
  const entitlement = await getStudyEntitlement(user.id, now);
  const finishState = await db.transaction(async (tx) => {
    const [session] = await tx
      .select({
        id: quizSessions.id,
        status: quizSessions.status,
        expiresAt: quizSessions.expiresAt,
        questionCount: quizSessions.questionCount,
      })
      .from(quizSessions)
      .where(and(eq(quizSessions.id, parsed.data.sessionId), eq(quizSessions.userId, user.id)))
      .for("update")
      .limit(1);

    if (!session) return { kind: "not_found" as const };
    if (session.status === "expired" || (session.status !== "completed" && session.expiresAt <= now)) {
      await tx
        .update(quizSessions)
        .set({ status: "expired", updatedAt: now })
        .where(eq(quizSessions.id, session.id));
      return { kind: "expired" as const };
    }

    if (!entitlement.hasFullAccess) {
      const sessionQuestionRows = await tx
        .select({ publicId: questions.publicId })
        .from(quizSessionQuestions)
        .innerJoin(questions, eq(quizSessionQuestions.questionId, questions.id))
        .where(eq(quizSessionQuestions.sessionId, session.id));

      if (sessionQuestionRows.some((question) => !canStudyQuestion(entitlement, question.publicId))) {
        return { kind: "access_denied" as const };
      }
    }

    if (session.status !== "completed") {
      const metricAnswers = await tx
        .select({
          questionId: quizSessionAnswers.questionId,
          selectedOptionId: quizSessionAnswers.selectedOptionId,
          isCorrect: quizSessionAnswers.isCorrect,
          durationMs: quizSessionAnswers.durationMs,
          answeredAt: quizSessionAnswers.answeredAt,
        })
        .from(quizSessionAnswers)
        .where(eq(quizSessionAnswers.sessionId, session.id));

      await tx
        .update(quizSessions)
        .set({ status: "completed", completedAt: now, updatedAt: now })
        .where(eq(quizSessions.id, session.id));

      if (metricAnswers.length) {
        await tx
          .insert(userAttempts)
          .values(
            metricAnswers.map((answer) => ({
              quizSessionId: session.id,
              userId: user.id,
              questionId: answer.questionId,
              selectedOptionId: answer.selectedOptionId,
              isCorrect: answer.isCorrect,
              durationMs: answer.durationMs,
              answeredAt: answer.answeredAt,
            })),
          )
          .onConflictDoNothing({
            target: [userAttempts.quizSessionId, userAttempts.questionId],
          });

        const correctCount = metricAnswers.filter((answer) => answer.isCorrect).length;
        const durationMs = metricAnswers.reduce((total, answer) => total + (answer.durationMs ?? 0), 0);
        const minutesStudied = Math.max(0, Math.round(durationMs / 60_000));
        const xpEarned = correctCount * 8 + (metricAnswers.length - correctCount) * 2;

        await tx
          .insert(studyDays)
          .values({
            userId: user.id,
            studyDate: saoPauloDate(now),
            answeredCount: metricAnswers.length,
            correctCount,
            minutesStudied,
            xpEarned,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: [studyDays.userId, studyDays.studyDate],
            set: {
              answeredCount: sql`${studyDays.answeredCount} + ${metricAnswers.length}`,
              correctCount: sql`${studyDays.correctCount} + ${correctCount}`,
              minutesStudied: sql`${studyDays.minutesStudied} + ${minutesStudied}`,
              xpEarned: sql`${studyDays.xpEarned} + ${xpEarned}`,
              updatedAt: now,
            },
          });
      }
    }

    return { kind: "completed" as const, session };
  });

  if (finishState.kind === "not_found") {
    return NextResponse.json({ error: "session_not_found" }, { status: 404 });
  }
  if (finishState.kind === "expired") {
    return NextResponse.json({ error: "session_expired" }, { status: 410 });
  }
  if (finishState.kind === "access_denied") {
    return NextResponse.json({ error: "subscription_required" }, { status: 403 });
  }

  const answerRows = await db
    .select({
      position: quizSessionQuestions.position,
      questionId: questions.publicId,
      selectedOptionId: questionOptions.optionKey,
      correctOptionId: sql<string>`(
        select correct_option.option_key
        from question_options correct_option
        where correct_option.question_id = ${questions.id}
          and correct_option.is_correct = true
        limit 1
      )`,
      isCorrect: quizSessionAnswers.isCorrect,
      explanation: questions.explanation,
      quizMode: questions.quizMode,
      verifiedAt: questions.verifiedAt,
      sourceTitle: questions.sourceTitle,
      sourceUrl: questions.sourceUrl,
      legalActTitle: legalActs.shortTitle,
      officialLegalUrl: legalActs.officialUrl,
      styleBankName: quizBanks.name,
    })
    .from(quizSessionQuestions)
    .leftJoin(
      quizSessionAnswers,
      and(
        eq(quizSessionAnswers.sessionId, quizSessionQuestions.sessionId),
        eq(quizSessionAnswers.questionId, quizSessionQuestions.questionId),
      ),
    )
    .innerJoin(questions, eq(quizSessionQuestions.questionId, questions.id))
    .leftJoin(questionOptions, eq(quizSessionAnswers.selectedOptionId, questionOptions.id))
    .leftJoin(legalArticles, eq(questions.legalArticleId, legalArticles.id))
    .leftJoin(legalVersions, eq(legalArticles.legalVersionId, legalVersions.id))
    .leftJoin(legalActs, eq(legalVersions.legalActId, legalActs.id))
    .leftJoin(quizBanks, eq(questions.styleBankId, quizBanks.id))
    .where(eq(quizSessionQuestions.sessionId, parsed.data.sessionId))
    .orderBy(asc(quizSessionQuestions.position));

  const answers = answerRows.map((answer) => ({
    questionId: answer.questionId,
    selectedOptionId: answer.selectedOptionId,
    correctOptionId: answer.correctOptionId,
    isCorrect: answer.isCorrect ?? false,
    explanation: answer.explanation,
    source: formatQuizQuestionSource({
      mode: answer.quizMode as "dry_law" | "previous_exam" | "original_style",
      sourceTitle: answer.sourceTitle,
      sourceUrl: answer.sourceUrl,
      verifiedAt: answer.verifiedAt,
      legalActTitle: answer.legalActTitle,
      officialLegalUrl: answer.officialLegalUrl,
      styleBankName: answer.styleBankName,
    }),
  }));

  return NextResponse.json(
    {
      sessionId: parsed.data.sessionId,
      status: "completed",
      result: calculateQuizResult(
        finishState.session.questionCount,
        answerRows.map((answer) =>
          answer.selectedOptionId === null ? null : (answer.isCorrect ?? false),
        ),
      ),
      answers,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
