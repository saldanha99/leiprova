import { and, eq, inArray, sql } from "drizzle-orm";
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
} from "@/lib/db/schema";
import {
  consumeRateLimits,
  getRequestIp,
  rateLimitJsonResponse,
} from "@/lib/rate-limit";
import { formatQuizQuestionSource } from "@/lib/quiz/response";
import { quizAnswerRequestSchema } from "@/lib/quiz/session-contract";
import { canStudyQuestion } from "@/lib/study/access-policy";
import { getStudyEntitlement } from "@/lib/study/entitlement";

export const dynamic = "force-dynamic";

type AnswerContext = {
  sessionId: string;
  status: string;
  experience: string;
  deadlineAt: Date | null;
  expiresAt: Date;
  questionDbId: number;
  questionPublicId: string;
  quizMode: string;
  explanation: string;
  verifiedAt: Date;
  sourceTitle: string | null;
  sourceUrl: string | null;
  legalActTitle: string | null;
  officialLegalUrl: string | null;
  styleBankName: string | null;
  selectedOptionDbId: number;
  selectedIsCorrect: boolean;
  correctOptionId: string;
};

function correctionResponse(context: AnswerContext, isCorrect: boolean) {
  return {
    isCorrect,
    correctOptionId: context.correctOptionId,
    explanation: context.explanation,
    source: formatQuizQuestionSource({
      mode: context.quizMode as "dry_law" | "previous_exam" | "original_style",
      sourceTitle: context.sourceTitle,
      sourceUrl: context.sourceUrl,
      verifiedAt: context.verifiedAt,
      legalActTitle: context.legalActTitle,
      officialLegalUrl: context.officialLegalUrl,
      styleBankName: context.styleBankName,
    }),
  };
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
    return rateLimitJsonResponse(limited, "Você respondeu rápido demais. Aguarde um instante.");
  }

  const parsed = quizAnswerRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_answer" }, { status: 400 });
  }

  const db = getDb();
  const [context] = await db
    .select({
      sessionId: quizSessions.id,
      status: quizSessions.status,
      experience: quizSessions.experience,
      deadlineAt: quizSessions.deadlineAt,
      expiresAt: quizSessions.expiresAt,
      questionDbId: questions.id,
      questionPublicId: questions.publicId,
      quizMode: questions.quizMode,
      explanation: questions.explanation,
      verifiedAt: questions.verifiedAt,
      sourceTitle: questions.sourceTitle,
      sourceUrl: questions.sourceUrl,
      legalActTitle: legalActs.shortTitle,
      officialLegalUrl: legalActs.officialUrl,
      styleBankName: quizBanks.name,
      selectedOptionDbId: questionOptions.id,
      selectedIsCorrect: questionOptions.isCorrect,
      correctOptionId: sql<string>`(
        select correct_option.option_key
        from question_options correct_option
        where correct_option.question_id = ${questions.id}
          and correct_option.is_correct = true
        limit 1
      )`,
    })
    .from(quizSessions)
    .innerJoin(quizSessionQuestions, eq(quizSessionQuestions.sessionId, quizSessions.id))
    .innerJoin(questions, eq(quizSessionQuestions.questionId, questions.id))
    .innerJoin(
      questionOptions,
      and(eq(questionOptions.questionId, questions.id), eq(questionOptions.optionKey, parsed.data.optionId)),
    )
    .leftJoin(legalArticles, eq(questions.legalArticleId, legalArticles.id))
    .leftJoin(legalVersions, eq(legalArticles.legalVersionId, legalVersions.id))
    .leftJoin(legalActs, eq(legalVersions.legalActId, legalActs.id))
    .leftJoin(quizBanks, eq(questions.styleBankId, quizBanks.id))
    .where(
      and(
        eq(quizSessions.id, parsed.data.sessionId),
        eq(quizSessions.userId, user.id),
        eq(questions.publicId, parsed.data.questionId),
      ),
    )
    .limit(1);

  if (!context || !context.correctOptionId) {
    return NextResponse.json({ error: "question_not_found" }, { status: 404 });
  }
  if (context.status === "completed") {
    return NextResponse.json({ error: "session_finished" }, { status: 409 });
  }

  const now = new Date();
  if (context.status === "expired" || context.expiresAt <= now) {
    await db
      .update(quizSessions)
      .set({ status: "expired", updatedAt: now })
      .where(and(eq(quizSessions.id, context.sessionId), eq(quizSessions.userId, user.id)));
    return NextResponse.json({ error: "session_expired" }, { status: 410 });
  }
  if (context.deadlineAt && context.deadlineAt <= now) {
    return NextResponse.json({ error: "quiz_deadline_reached" }, { status: 409 });
  }

  const entitlement = await getStudyEntitlement(user.id, now);
  if (!canStudyQuestion(entitlement, context.questionPublicId)) {
    return NextResponse.json({ error: "question_not_found" }, { status: 404 });
  }

  const [existing] = await db
    .select({
      isCorrect: quizSessionAnswers.isCorrect,
      selectedOptionId: questionOptions.optionKey,
    })
    .from(quizSessionAnswers)
    .innerJoin(questionOptions, eq(quizSessionAnswers.selectedOptionId, questionOptions.id))
    .where(
      and(
        eq(quizSessionAnswers.sessionId, context.sessionId),
        eq(quizSessionAnswers.questionId, context.questionDbId),
      ),
    )
    .limit(1);

  if (existing) {
    if (context.experience !== "exam") {
      return NextResponse.json(correctionResponse(context, existing.isCorrect), {
        headers: { "Cache-Control": "no-store" },
      });
    }
  }

  const transactionResult = await db.transaction(async (tx) => {
    const [lockedSession] = await tx
      .select({
        status: quizSessions.status,
        deadlineAt: quizSessions.deadlineAt,
        expiresAt: quizSessions.expiresAt,
      })
      .from(quizSessions)
      .where(and(eq(quizSessions.id, context.sessionId), eq(quizSessions.userId, user.id)))
      .for("update")
      .limit(1);

    const lockedAt = new Date();

    if (
      !lockedSession ||
      lockedSession.status === "completed" ||
      lockedSession.status === "expired" ||
      lockedSession.expiresAt <= lockedAt
    ) {
      return { closed: "session" as const, answer: null };
    }
    if (lockedSession.deadlineAt !== null && lockedSession.deadlineAt <= lockedAt) {
      return { closed: "deadline" as const, answer: null };
    }

    const answerValues = {
      sessionId: context.sessionId,
      questionId: context.questionDbId,
      selectedOptionId: context.selectedOptionDbId,
      isCorrect: context.selectedIsCorrect,
      durationMs: parsed.data.durationMs,
      answeredAt: lockedAt,
    };
    const [answer] =
      context.experience === "exam"
        ? await tx
            .insert(quizSessionAnswers)
            .values(answerValues)
            .onConflictDoUpdate({
              target: [quizSessionAnswers.sessionId, quizSessionAnswers.questionId],
              set: {
                selectedOptionId: context.selectedOptionDbId,
                isCorrect: context.selectedIsCorrect,
                durationMs: parsed.data.durationMs,
                answeredAt: lockedAt,
              },
            })
            .returning({ isCorrect: quizSessionAnswers.isCorrect })
        : await tx
            .insert(quizSessionAnswers)
            .values(answerValues)
            .onConflictDoNothing({
              target: [quizSessionAnswers.sessionId, quizSessionAnswers.questionId],
            })
            .returning({ isCorrect: quizSessionAnswers.isCorrect });

    if (answer) {
      await tx
        .update(quizSessions)
        .set({ status: "in_progress", updatedAt: lockedAt })
        .where(
          and(
            eq(quizSessions.id, context.sessionId),
            eq(quizSessions.userId, user.id),
            inArray(quizSessions.status, ["created", "in_progress"]),
          ),
        );
    }
    return { closed: null, answer: answer ?? null };
  });

  if (transactionResult.closed === "deadline") {
    return NextResponse.json({ error: "quiz_deadline_reached" }, { status: 409 });
  }
  if (transactionResult.closed === "session") {
    return NextResponse.json({ error: "session_finished" }, { status: 409 });
  }

  let acceptedIsCorrect = transactionResult.answer?.isCorrect;
  if (acceptedIsCorrect === undefined) {
    const [winner] = await db
      .select({ isCorrect: quizSessionAnswers.isCorrect })
      .from(quizSessionAnswers)
      .where(
        and(
          eq(quizSessionAnswers.sessionId, context.sessionId),
          eq(quizSessionAnswers.questionId, context.questionDbId),
        ),
      )
      .limit(1);
    if (!winner) return NextResponse.json({ error: "answer_not_saved" }, { status: 409 });
    acceptedIsCorrect = winner.isCorrect;
  }

  if (context.experience === "exam") {
    return NextResponse.json({ accepted: true }, { headers: { "Cache-Control": "no-store" } });
  }

  return NextResponse.json(correctionResponse(context, acceptedIsCorrect), {
    headers: { "Cache-Control": "no-store" },
  });
}
