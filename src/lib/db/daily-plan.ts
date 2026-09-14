import "server-only";

import { and, asc, eq, gte, inArray, lte, sql } from "drizzle-orm";

import { getDb } from "@/lib/db/client";
import { legalActs, legalArticles, legalVersions, questions, userAttempts, userDailyStudyProgress } from "@/lib/db/schema";
import { saoPauloDateIso } from "@/lib/quiz/exam-edition-catalog";
import { accessibleQuestionIds, type StudyEntitlement } from "@/lib/study/access-policy";
import { dailyPlanLinks, selectDailyStudyTarget, type DailyStudyActCandidate } from "@/lib/study/daily-plan";

export async function getDailyStudyPlan(
  userId: number,
  entitlement: StudyEntitlement,
  referenceDate = new Date(),
) {
  const dateIso = saoPauloDateIso(referenceDate);
  const access = entitlement.hasFullAccess
    ? undefined
    : inArray(questions.publicId, accessibleQuestionIds(entitlement));
  const rows = await getDb()
    .select({
      actId: legalActs.id,
      actSlug: legalActs.slug,
      actTitle: legalActs.shortTitle,
      officialUrl: legalActs.officialUrl,
      articleId: legalArticles.id,
      articleOrder: legalArticles.articleOrder,
      articleRef: legalArticles.articleRef,
      questionCount: sql<number>`count(distinct ${questions.id})::int`,
    })
    .from(questions)
    .innerJoin(legalArticles, eq(questions.legalArticleId, legalArticles.id))
    .innerJoin(legalVersions, eq(legalArticles.legalVersionId, legalVersions.id))
    .innerJoin(legalActs, eq(legalVersions.legalActId, legalActs.id))
    .where(and(
      inArray(questions.quizMode, ["dry_law", "original_style"]),
      eq(questions.editorialStatus, "reviewed"),
      eq(legalArticles.editorialStatus, "reviewed"),
      eq(legalVersions.status, "current"),
      eq(legalActs.isActive, true),
      access,
    ))
    .groupBy(legalActs.id, legalArticles.id)
    .orderBy(asc(legalActs.shortTitle), asc(legalArticles.articleOrder));

  const grouped = new Map<number, DailyStudyActCandidate>();
  for (const row of rows) {
    const current = grouped.get(row.actId);
    const article = { id: row.articleId, articleOrder: row.articleOrder, articleRef: row.articleRef, questionCount: row.questionCount };
    if (current) {
      grouped.set(row.actId, { ...current, articles: [...current.articles, article] });
    } else {
      grouped.set(row.actId, { id: row.actId, slug: row.actSlug, title: row.actTitle, officialUrl: row.officialUrl, articles: [article] });
    }
  }
  const target = selectDailyStudyTarget(userId, dateIso, [...grouped.values()]);
  if (!target) return null;

  const dayStart = new Date(`${dateIso}T00:00:00-03:00`);
  const dayEnd = new Date(`${dateIso}T23:59:59.999-03:00`);
  const [[progress], [practice]] = await Promise.all([
    getDb()
      .select()
      .from(userDailyStudyProgress)
      .where(and(
        eq(userDailyStudyProgress.userId, userId),
        eq(userDailyStudyProgress.studyDate, dateIso),
        eq(userDailyStudyProgress.legalActId, target.id),
        eq(userDailyStudyProgress.articleStartOrder, target.articleStartOrder),
        eq(userDailyStudyProgress.articleEndOrder, target.articleEndOrder),
      ))
      .limit(1),
    getDb()
      .select({
        answered: sql<number>`count(distinct ${questions.id})::int`,
        lastAnsweredAt: sql<Date | null>`max(${userAttempts.answeredAt})`,
      })
      .from(userAttempts)
      .innerJoin(questions, eq(userAttempts.questionId, questions.id))
      .innerJoin(legalArticles, eq(questions.legalArticleId, legalArticles.id))
      .innerJoin(legalVersions, eq(legalArticles.legalVersionId, legalVersions.id))
      .where(and(
        eq(userAttempts.userId, userId),
        eq(legalVersions.legalActId, target.id),
        gte(legalArticles.articleOrder, target.articleStartOrder),
        lte(legalArticles.articleOrder, target.articleEndOrder),
        gte(userAttempts.answeredAt, dayStart),
        lte(userAttempts.answeredAt, dayEnd),
      )),
  ]);
  const links = dailyPlanLinks(target);
  const practiceCompletedAt = (practice?.answered ?? 0) >= target.questionCount
    ? practice?.lastAnsweredAt ?? null
    : null;
  const steps = {
    reading: { completedAt: progress?.readingCompletedAt ?? null, href: links.reading },
    practice: { completedAt: practiceCompletedAt, answered: practice?.answered ?? 0, href: links.practice },
    review: { completedAt: progress?.reviewCompletedAt ?? null, href: links.review },
  };

  return {
    dateIso,
    target,
    steps,
    completedCount: Object.values(steps).filter((step) => step.completedAt).length,
  };
}

export type DailyStudyPlan = NonNullable<Awaited<ReturnType<typeof getDailyStudyPlan>>>;
