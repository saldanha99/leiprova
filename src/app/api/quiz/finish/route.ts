import { and, asc, eq, or, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { approvedReleasedProductPreviousExamQuestionExists } from "@/lib/commerce/previous-exam-content";
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
import { enqueueNewQuizMistakes } from "@/lib/study/quiz-review";

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
  const previousExamCoverageEndsAt =
    entitlement.hasFullAccess && entitlement.accessEndsAt
      ? sql`${entitlement.accessEndsAt.toISOString()}::timestamptz`
      : sql`current_timestamp`;
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

    const previousExamEditions = await tx
      .selectDistinct({ id: questions.examEditionId })
      .from(quizSessionQuestions)
      .innerJoin(questions, eq(quizSessionQuestions.questionId, questions.id))
      .where(
        and(
          eq(quizSessionQuestions.sessionId, session.id),
          eq(questions.quizMode, "previous_exam"),
          sql`${questions.examEditionId} is not null`,
        ),
      )
      .orderBy(questions.examEditionId);
    for (const { id } of previousExamEditions) {
      if (id !== null) {
        await tx.execute(
          sql`select public.lock_exam_document_review_edition(${id})`,
        );
      }
    }

    const sessionQuestionRows = await tx
      .select({
        publicId: questions.publicId,
        quizMode: questions.quizMode,
        previousExamGoverned: sql<boolean>`case
          when ${questions.quizMode} <> 'previous_exam' then true
          else ${approvedReleasedProductPreviousExamQuestionExists(
            questions.id,
            previousExamCoverageEndsAt,
          )}
        end`,
      })
      .from(quizSessionQuestions)
      .innerJoin(questions, eq(quizSessionQuestions.questionId, questions.id))
      .where(eq(quizSessionQuestions.sessionId, session.id));

    if (
      sessionQuestionRows.some(
        (question) =>
          question.quizMode === "previous_exam" &&
          !question.previousExamGoverned,
      )
    ) {
      return { kind: "content_unavailable" as const };
    }
    if (
      !entitlement.hasFullAccess &&
      sessionQuestionRows.some(
        (question) => !canStudyQuestion(entitlement, question.publicId),
      )
    ) {
      return { kind: "access_denied" as const };
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
        const newlyRecorded = await tx
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
          }).returning({ questionId: userAttempts.questionId, isCorrect: userAttempts.isCorrect });

        await enqueueNewQuizMistakes(tx, user.id, newlyRecorded, now);

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

    const answerRows = await tx
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
      .leftJoin(
        questionOptions,
        eq(quizSessionAnswers.selectedOptionId, questionOptions.id),
      )
      .leftJoin(legalArticles, eq(questions.legalArticleId, legalArticles.id))
      .leftJoin(
        legalVersions,
        eq(legalArticles.legalVersionId, legalVersions.id),
      )
      .leftJoin(legalActs, eq(legalVersions.legalActId, legalActs.id))
      .leftJoin(quizBanks, eq(questions.styleBankId, quizBanks.id))
      .where(
        and(
          eq(quizSessionQuestions.sessionId, parsed.data.sessionId),
          or(
            sql`${questions.quizMode} <> 'previous_exam'`,
            approvedReleasedProductPreviousExamQuestionExists(
              questions.id,
              previousExamCoverageEndsAt,
            ),
          ),
        ),
      )
      .orderBy(asc(quizSessionQuestions.position));
    if (answerRows.length !== session.questionCount) {
      return { kind: "content_unavailable" as const };
    }

    return { kind: "completed" as const, session, answerRows };
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
  if (finishState.kind === "content_unavailable") {
    return NextResponse.json(
      { error: "question_content_unavailable" },
      { status: 409 },
    );
  }

  const { answerRows } = finishState;

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
