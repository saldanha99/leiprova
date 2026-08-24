import "server-only";

import { and, desc, eq, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { getDb } from "@/lib/db/client";
import {
  legalActs,
  legalArticles,
  legalVersions,
  questions,
  questionStyleProfiles,
  quizBanks,
  quizSubjects,
  quizTopics,
  users,
} from "@/lib/db/schema";

export async function getEditorialFactorySnapshot() {
  const db = getDb();
  const creator = alias(users, "question_creator");
  const reviewer = alias(users, "question_reviewer");

  const [profiles, articles, subjects, topics, queue, metricRows] = await Promise.all([
    db
      .select({
        id: questionStyleProfiles.id,
        bankId: quizBanks.id,
        bankSlug: quizBanks.slug,
        bankName: quizBanks.name,
        bankFullName: quizBanks.fullName,
        version: questionStyleProfiles.version,
        format: questionStyleProfiles.format,
        commandStyle: questionStyleProfiles.commandStyle,
        reasoningDemand: questionStyleProfiles.reasoningDemand,
        authoringGuidelines: questionStyleProfiles.authoringGuidelines,
        distractorGuidance: questionStyleProfiles.distractorGuidance,
        prohibitedPatterns: questionStyleProfiles.prohibitedPatterns,
        disclaimer: questionStyleProfiles.disclaimer,
      })
      .from(questionStyleProfiles)
      .innerJoin(quizBanks, eq(questionStyleProfiles.quizBankId, quizBanks.id))
      .where(and(eq(questionStyleProfiles.isActive, true), eq(quizBanks.isActive, true)))
      .orderBy(quizBanks.name),
    db
      .select({
        id: legalArticles.id,
        actTitle: legalActs.shortTitle,
        articleRef: legalArticles.articleRef,
        heading: legalArticles.heading,
        literalText: legalArticles.literalText,
        sourceUrl: legalVersions.sourceUrl,
        verifiedAt: legalVersions.verifiedAt,
      })
      .from(legalArticles)
      .innerJoin(legalVersions, eq(legalArticles.legalVersionId, legalVersions.id))
      .innerJoin(legalActs, eq(legalVersions.legalActId, legalActs.id))
      .where(
        and(
          eq(legalArticles.editorialStatus, "reviewed"),
          eq(legalArticles.sourceRights, "official_text"),
          eq(legalVersions.status, "current"),
          eq(legalActs.isActive, true),
        ),
      )
      .orderBy(legalActs.shortTitle, legalArticles.articleOrder)
      .limit(750),
    db
      .select({ id: quizSubjects.id, name: quizSubjects.name })
      .from(quizSubjects)
      .where(eq(quizSubjects.isActive, true))
      .orderBy(quizSubjects.name),
    db
      .select({ id: quizTopics.id, subjectId: quizTopics.subjectId, name: quizTopics.name })
      .from(quizTopics)
      .where(eq(quizTopics.isActive, true))
      .orderBy(quizTopics.name),
    db
      .select({
        publicId: questions.publicId,
        prompt: questions.prompt,
        learningObjective: questions.learningObjective,
        editorialStatus: questions.editorialStatus,
        authorshipMethod: questions.authorshipMethod,
        generatorModel: questions.generatorModel,
        promptVersion: questions.promptVersion,
        bankName: quizBanks.name,
        articleRef: legalArticles.articleRef,
        sourceTitle: questions.sourceTitle,
        subjectName: quizSubjects.name,
        topicName: quizTopics.name,
        creatorUserId: questions.createdByUserId,
        creatorName: creator.name,
        reviewerName: reviewer.name,
        submittedAt: questions.submittedAt,
        reviewNotes: questions.reviewNotes,
        similarityMaxBps: questions.similarityMaxBps,
        similarityReferencePublicId: questions.similarityReferencePublicId,
        originalityCheckedAt: questions.originalityCheckedAt,
        createdAt: questions.createdAt,
      })
      .from(questions)
      .innerJoin(quizBanks, eq(questions.styleBankId, quizBanks.id))
      .innerJoin(legalArticles, eq(questions.legalArticleId, legalArticles.id))
      .innerJoin(quizSubjects, eq(questions.subjectId, quizSubjects.id))
      .leftJoin(quizTopics, eq(questions.topicId, quizTopics.id))
      .leftJoin(creator, eq(questions.createdByUserId, creator.id))
      .leftJoin(reviewer, eq(questions.reviewedByUserId, reviewer.id))
      .where(eq(questions.quizMode, "original_style"))
      .orderBy(desc(questions.createdAt))
      .limit(60),
    db
      .select({
        total: sql<number>`count(*)::int`,
        drafts: sql<number>`count(*) filter (where ${questions.editorialStatus} = 'draft')::int`,
        pending: sql<number>`count(*) filter (where ${questions.editorialStatus} = 'pending_review')::int`,
        reviewed: sql<number>`count(*) filter (where ${questions.editorialStatus} = 'reviewed')::int`,
        suspended: sql<number>`count(*) filter (where ${questions.editorialStatus} = 'suspended')::int`,
      })
      .from(questions)
      .where(eq(questions.quizMode, "original_style")),
  ]);

  return {
    profiles,
    articles,
    subjects,
    topics,
    queue,
    metrics: metricRows[0] ?? { total: 0, drafts: 0, pending: 0, reviewed: 0, suspended: 0 },
  };
}

export type EditorialFactorySnapshot = Awaited<ReturnType<typeof getEditorialFactorySnapshot>>;
