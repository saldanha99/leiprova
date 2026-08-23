import { and, asc, eq, inArray, lte, max, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db/client";
import {
  legalActs,
  legalArticles,
  legalVersions,
  questionOptions,
  questions,
  reviewQueue,
  userAttempts,
} from "@/lib/db/schema";
import { FREE_STUDY_QUESTION_IDS } from "@/lib/study/access-policy";
import { getStudyEntitlement } from "@/lib/study/entitlement";

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
  const requestedTopic = request.nextUrl.searchParams.get("tema")?.trim();
  const topic = requestedTopic && requestedTopic.length <= 120 ? requestedTopic : null;
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
          accessCondition,
        ),
      )
      .orderBy(sql`${lastAttempts.answeredAt} asc nulls first`, sql`random()`)
      .limit(10);
  }

  if (!questionRows.length) return NextResponse.json({ questions: [], mode, topic });

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
    questions: questionRows.map(({ id, ...question }) => ({
      ...question,
      verifiedAt: question.verifiedAt.toISOString().slice(0, 10),
      options: options
        .filter((option) => option.questionId === id)
        .map((option) => ({ id: option.id, text: option.text })),
    })),
  });
}
