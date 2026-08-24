import { and, asc, eq, gte, inArray, lte, max, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db/client";
import {
  legalActs,
  legalArticles,
  legalVersions,
  questionNotebookItems,
  questionNotebooks,
  questionOptions,
  questions,
  reviewQueue,
  userAttempts,
} from "@/lib/db/schema";
import { FREE_STUDY_QUESTION_IDS } from "@/lib/study/access-policy";
import { getStudyEntitlement } from "@/lib/study/entitlement";
import {
  normalizeArticleRange,
  normalizeLegalActSlug,
  normalizeNotebookPublicId,
  normalizeStudyTopic,
} from "@/lib/study/scope";

export const dynamic = "force-dynamic";

type StudyMode = "normal" | "revisao";

type QuestionRow = {
  id: number;
  publicId: string;
  prompt: string;
  topic: string;
  difficulty: number;
  articleRef: string;
  actTitle: string;
  verifiedAt: Date;
};

const questionSelection = {
  id: questions.id,
  publicId: questions.publicId,
  prompt: questions.prompt,
  topic: questions.topic,
  difficulty: questions.difficulty,
  articleRef: legalArticles.articleRef,
  actTitle: legalActs.shortTitle,
  verifiedAt: questions.verifiedAt,
};

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const mode: StudyMode = request.nextUrl.searchParams.get("modo") === "revisao" ? "revisao" : "normal";
  const topic = normalizeStudyTopic(request.nextUrl.searchParams.get("tema")) ?? null;
  const legalActSlug = normalizeLegalActSlug(request.nextUrl.searchParams.get("lei")) ?? null;
  const articleRange = normalizeArticleRange(
    request.nextUrl.searchParams.get("de"),
    request.nextUrl.searchParams.get("ate"),
  );
  const articleStartOrder = articleRange.start ?? null;
  const articleEndOrder = articleRange.end ?? null;
  const sequential = request.nextUrl.searchParams.get("ordem") === "sequencial";
  const notebookPublicId = normalizeNotebookPublicId(request.nextUrl.searchParams.get("caderno")) ?? null;
  const now = new Date();
  const db = getDb();
  const entitlement = await getStudyEntitlement(user.id, now);
  const accessCondition = entitlement.hasFullAccess
    ? undefined
    : inArray(questions.publicId, [...FREE_STUDY_QUESTION_IDS]);

  let questionRows: QuestionRow[];

  if (mode === "revisao") {
    questionRows = await db
      .select(questionSelection)
      .from(reviewQueue)
      .innerJoin(questions, eq(reviewQueue.questionId, questions.id))
      .innerJoin(legalArticles, eq(questions.legalArticleId, legalArticles.id))
      .innerJoin(legalVersions, eq(legalArticles.legalVersionId, legalVersions.id))
      .innerJoin(legalActs, eq(legalVersions.legalActId, legalActs.id))
      .where(
        and(
          eq(reviewQueue.userId, user.id),
          lte(reviewQueue.nextReviewAt, now),
          eq(questions.editorialStatus, "reviewed"),
          eq(legalArticles.editorialStatus, "reviewed"),
          eq(legalVersions.status, "current"),
          eq(legalActs.isActive, true),
          topic ? eq(questions.topic, topic) : undefined,
          legalActSlug ? eq(legalActs.slug, legalActSlug) : undefined,
          articleStartOrder !== null ? gte(legalArticles.articleOrder, articleStartOrder) : undefined,
          articleEndOrder !== null ? lte(legalArticles.articleOrder, articleEndOrder) : undefined,
          notebookCondition(notebookPublicId, user.id),
          accessCondition,
        ),
      )
      .orderBy(asc(reviewQueue.nextReviewAt), asc(questions.id))
      .limit(10);
  } else {
    const lastAttempts = db
      .select({
        questionId: userAttempts.questionId,
        answeredAt: max(userAttempts.answeredAt).as("last_answered_at"),
      })
      .from(userAttempts)
      .where(eq(userAttempts.userId, user.id))
      .groupBy(userAttempts.questionId)
      .as("last_attempts");

    questionRows = await db
      .select(questionSelection)
      .from(questions)
      .innerJoin(legalArticles, eq(questions.legalArticleId, legalArticles.id))
      .innerJoin(legalVersions, eq(legalArticles.legalVersionId, legalVersions.id))
      .innerJoin(legalActs, eq(legalVersions.legalActId, legalActs.id))
      .leftJoin(lastAttempts, eq(lastAttempts.questionId, questions.id))
      .where(
        and(
          eq(questions.editorialStatus, "reviewed"),
          eq(legalArticles.editorialStatus, "reviewed"),
          eq(legalVersions.status, "current"),
          eq(legalActs.isActive, true),
          topic ? eq(questions.topic, topic) : undefined,
          legalActSlug ? eq(legalActs.slug, legalActSlug) : undefined,
          articleStartOrder !== null ? gte(legalArticles.articleOrder, articleStartOrder) : undefined,
          articleEndOrder !== null ? lte(legalArticles.articleOrder, articleEndOrder) : undefined,
          notebookCondition(notebookPublicId, user.id),
          accessCondition,
        ),
      )
      .orderBy(
        sql`${lastAttempts.answeredAt} asc nulls first`,
        sequential ? asc(legalArticles.articleOrder) : sql`random()`,
        sequential ? asc(questions.id) : sql`random()`,
      )
      .limit(10);
  }

  if (!questionRows.length) return NextResponse.json({ questions: [], mode, topic, legalActSlug, notebookPublicId });

  const options = await db
    .select({
      questionId: questionOptions.questionId,
      id: questionOptions.optionKey,
      text: questionOptions.text,
    })
    .from(questionOptions)
    .where(inArray(questionOptions.questionId, questionRows.map((question) => question.id)))
    .orderBy(asc(questionOptions.questionId), asc(questionOptions.sortOrder));

  return NextResponse.json({
    mode,
    topic,
    legalActSlug,
    articleStartOrder,
    articleEndOrder,
    sequential,
    notebookPublicId,
    questions: questionRows.map(({ id, ...question }) => ({
      ...question,
      verifiedAt: question.verifiedAt.toISOString().slice(0, 10),
      options: options
        .filter((option) => option.questionId === id)
        .map((option) => ({ id: option.id, text: option.text })),
    })),
  });
}

function notebookCondition(publicId: string | null, userId: number) {
  if (!publicId) return undefined;
  return sql`exists (
    select 1
    from ${questionNotebookItems}
    inner join ${questionNotebooks}
      on ${questionNotebooks.id} = ${questionNotebookItems.notebookId}
    where ${questionNotebookItems.questionId} = ${questions.id}
      and ${questionNotebooks.publicId} = ${publicId}
      and ${questionNotebooks.userId} = ${userId}
  )`;
}
