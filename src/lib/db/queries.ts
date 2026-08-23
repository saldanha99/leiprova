import "server-only";

import { and, asc, desc, eq, gte, lte, sql } from "drizzle-orm";

import { getDb } from "@/lib/db/client";
import {
  legalActs,
  legalArticles,
  legalVersions,
  plans,
  questions,
  reviewQueue,
  studyDays,
  subscriptions,
  userAttempts,
  users,
} from "@/lib/db/schema";

export async function getDashboardSnapshot(userId: number) {
  const db = getDb();
  const todayIso = saoPauloDate();
  const since = new Date(`${todayIso}T12:00:00Z`);
  since.setUTCDate(since.getUTCDate() - 6);
  const sinceIso = since.toISOString().slice(0, 10);

  const [[attemptStats], [dueStats], recentDays, [currentPlan]] = await Promise.all([
    db
      .select({
        answered: sql<number>`count(*)::int`,
        correct: sql<number>`count(*) filter (where ${userAttempts.isCorrect})::int`,
        todayAnswered: sql<number>`count(*) filter (where (${userAttempts.answeredAt} at time zone 'America/Sao_Paulo')::date = (now() at time zone 'America/Sao_Paulo')::date)::int`,
      })
      .from(userAttempts)
      .where(eq(userAttempts.userId, userId)),
    db
      .select({ due: sql<number>`count(*)::int` })
      .from(reviewQueue)
      .where(and(eq(reviewQueue.userId, userId), lte(reviewQueue.nextReviewAt, new Date()))),
    db
      .select({
        date: studyDays.studyDate,
        answered: studyDays.answeredCount,
        correct: studyDays.correctCount,
        minutes: studyDays.minutesStudied,
        xp: studyDays.xpEarned,
      })
      .from(studyDays)
      .where(and(eq(studyDays.userId, userId), gte(studyDays.studyDate, sinceIso)))
      .orderBy(asc(studyDays.studyDate)),
    db
      .select({ name: plans.name, status: subscriptions.status, accessEndsAt: subscriptions.accessEndsAt })
      .from(subscriptions)
      .innerJoin(plans, eq(subscriptions.planId, plans.id))
      .where(
        and(
          eq(subscriptions.userId, userId),
          sql`${subscriptions.status} in ('active', 'trialing', 'past_due')`,
        ),
      )
      .orderBy(desc(subscriptions.updatedAt))
      .limit(1),
  ]);

  const daysByDate = new Map(recentDays.map((day) => [day.date, day]));
  const activity = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(since);
    date.setDate(date.getDate() + index);
    const key = date.toISOString().slice(0, 10);
    return (
      daysByDate.get(key) ?? {
        date: key,
        answered: 0,
        correct: 0,
        minutes: 0,
        xp: 0,
      }
    );
  });

  const streak = calculateStreak(recentDays, todayIso);
  const answered = attemptStats?.answered ?? 0;
  const correct = attemptStats?.correct ?? 0;

  return {
    answered,
    correct,
    accuracy: answered ? Math.round((correct / answered) * 100) : 0,
    todayAnswered: attemptStats?.todayAnswered ?? 0,
    dueReviews: dueStats?.due ?? 0,
    streak,
    activity,
    plan: currentPlan ?? null,
  };
}

function calculateStreak(days: Array<{ date: string; answered: number }>, todayIso: string) {
  const active = new Set(days.filter((day) => day.answered > 0).map((day) => day.date));
  const cursor = new Date(`${todayIso}T12:00:00Z`);
  if (!active.has(todayIso)) cursor.setUTCDate(cursor.getUTCDate() - 1);
  let streak = 0;

  while (active.has(cursor.toISOString().slice(0, 10))) {
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  return streak;
}

function saoPauloDate(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export async function listLegalLibrary() {
  return getDb()
    .select({
      id: legalActs.id,
      slug: legalActs.slug,
      title: legalActs.title,
      shortTitle: legalActs.shortTitle,
      jurisdiction: legalActs.jurisdiction,
      officialUrl: legalActs.officialUrl,
      articleCount: sql<number>`count(distinct ${legalArticles.id})::int`,
      questionCount: sql<number>`count(distinct ${questions.id})::int`,
      verifiedAt: sql<Date | null>`max(${legalVersions.verifiedAt})`,
    })
    .from(legalActs)
    .leftJoin(legalVersions, eq(legalVersions.legalActId, legalActs.id))
    .leftJoin(legalArticles, eq(legalArticles.legalVersionId, legalVersions.id))
    .leftJoin(questions, eq(questions.legalArticleId, legalArticles.id))
    .where(eq(legalActs.isActive, true))
    .groupBy(legalActs.id)
    .orderBy(asc(legalActs.shortTitle));
}

export async function getMonthlyRanking(limit = 20) {
  return getDb()
    .select({
      publicId: users.publicId,
      xp: sql<number>`coalesce(sum(${studyDays.xpEarned}), 0)::int`,
      answered: sql<number>`coalesce(sum(${studyDays.answeredCount}), 0)::int`,
    })
    .from(studyDays)
    .innerJoin(users, eq(studyDays.userId, users.id))
    .where(sql`${studyDays.studyDate} >= date_trunc('month', current_date)::date`)
    .groupBy(users.id)
    .orderBy(desc(sql`sum(${studyDays.xpEarned})`), asc(users.publicId))
    .limit(limit);
}

export async function getDueReviewSummary(userId: number) {
  const [summary] = await getDb()
    .select({
      due: sql<number>`count(*) filter (where ${reviewQueue.nextReviewAt} <= now())::int`,
      upcoming: sql<number>`count(*) filter (where ${reviewQueue.nextReviewAt} > now())::int`,
      lapses: sql<number>`coalesce(sum(${reviewQueue.lapses}), 0)::int`,
    })
    .from(reviewQueue)
    .where(eq(reviewQueue.userId, userId));

  return summary ?? { due: 0, upcoming: 0, lapses: 0 };
}

export async function getInitialStudyFocuses(limit = 3) {
  return getDb()
    .select({
      article: legalArticles.articleRef,
      topic: questions.topic,
      count: sql<number>`count(${questions.id})::int`,
    })
    .from(questions)
    .innerJoin(legalArticles, eq(questions.legalArticleId, legalArticles.id))
    .innerJoin(legalVersions, eq(legalArticles.legalVersionId, legalVersions.id))
    .innerJoin(legalActs, eq(legalVersions.legalActId, legalActs.id))
    .where(
      and(
        eq(questions.editorialStatus, "reviewed"),
        eq(legalArticles.editorialStatus, "reviewed"),
        eq(legalVersions.status, "current"),
        eq(legalActs.isActive, true),
      ),
    )
    .groupBy(legalArticles.id, questions.topic)
    .orderBy(asc(legalArticles.articleOrder), asc(questions.topic))
    .limit(limit);
}
