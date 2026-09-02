import "server-only";

import { and, desc, eq, isNull } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { getDb } from "@/lib/db/client";
import {
  contestCategories,
  contestOpportunities,
  legalActs,
  legalArticles,
  legalVersions,
  opportunityOrganizerAssignments,
  opportunityRequirements,
  opportunitySourceDocuments,
  questionOpportunities,
  questions,
  questionStyleProfiles,
  quizBanks,
  quizCareerTracks,
  quizSubjects,
  quizTopics,
  users,
} from "@/lib/db/schema";

export async function getNoticeEngineSnapshot() {
  const db = getDb();
  const sourceInitiator = alias(users, "notice_source_initiator");
  const sourceReviewer = alias(users, "notice_source_reviewer");
  const requirementCreator = alias(users, "notice_requirement_creator");
  const requirementReviewer = alias(users, "notice_requirement_reviewer");

  const [
    opportunities,
    sourceDocuments,
    requirements,
    assignments,
    articles,
    subjects,
    topics,
    linkedQuestions,
  ] = await Promise.all([
    db
      .select({
        id: contestOpportunities.id,
        publicId: contestOpportunities.publicId,
        title: contestOpportunities.title,
        institutionAcronym: contestOpportunities.institutionAcronym,
        roleName: contestOpportunities.roleName,
        lifecycleStatus: contestOpportunities.lifecycleStatus,
        editorialStatus: contestOpportunities.editorialStatus,
        categoryName: contestCategories.name,
        careerName: quizCareerTracks.name,
      })
      .from(contestOpportunities)
      .innerJoin(contestCategories, eq(contestOpportunities.categoryId, contestCategories.id))
      .innerJoin(quizCareerTracks, eq(contestOpportunities.careerTrackId, quizCareerTracks.id))
      .orderBy(desc(contestOpportunities.statusAsOf), contestOpportunities.title),
    db
      .select({
        id: opportunitySourceDocuments.id,
        publicId: opportunitySourceDocuments.publicId,
        opportunityId: opportunitySourceDocuments.opportunityId,
        opportunityTitle: contestOpportunities.title,
        documentType: opportunitySourceDocuments.documentType,
        title: opportunitySourceDocuments.title,
        sourceUrl: opportunitySourceDocuments.sourceUrl,
        sourceHost: opportunitySourceDocuments.sourceHost,
        httpStatus: opportunitySourceDocuments.httpStatus,
        contentType: opportunitySourceDocuments.contentType,
        sourcePolicy: opportunitySourceDocuments.sourcePolicy,
        sourceContentStored: opportunitySourceDocuments.sourceContentStored,
        status: opportunitySourceDocuments.status,
        observedAt: opportunitySourceDocuments.observedAt,
        initiatedByUserId: opportunitySourceDocuments.initiatedByUserId,
        initiatorName: sourceInitiator.name,
        reviewerName: sourceReviewer.name,
        reviewNotes: opportunitySourceDocuments.reviewNotes,
      })
      .from(opportunitySourceDocuments)
      .innerJoin(
        contestOpportunities,
        eq(opportunitySourceDocuments.opportunityId, contestOpportunities.id),
      )
      .leftJoin(
        sourceInitiator,
        eq(opportunitySourceDocuments.initiatedByUserId, sourceInitiator.id),
      )
      .leftJoin(
        sourceReviewer,
        eq(opportunitySourceDocuments.reviewedByUserId, sourceReviewer.id),
      )
      .orderBy(desc(opportunitySourceDocuments.observedAt))
      .limit(150),
    db
      .select({
        id: opportunityRequirements.id,
        opportunityId: opportunityRequirements.opportunityId,
        opportunityTitle: contestOpportunities.title,
        sourceDocumentPublicId: opportunitySourceDocuments.publicId,
        sourceDocumentTitle: opportunitySourceDocuments.title,
        sourceDocumentStatus: opportunitySourceDocuments.status,
        requirementText: opportunityRequirements.requirementText,
        sourceLocator: opportunityRequirements.sourceLocator,
        editorialStatus: opportunityRequirements.editorialStatus,
        createdByUserId: opportunityRequirements.createdByUserId,
        creatorName: requirementCreator.name,
        reviewerName: requirementReviewer.name,
        reviewNotes: opportunityRequirements.reviewNotes,
        subjectName: quizSubjects.name,
        topicName: quizTopics.name,
        actTitle: legalActs.shortTitle,
        articleRef: legalArticles.articleRef,
        legalArticleId: opportunityRequirements.legalArticleId,
      })
      .from(opportunityRequirements)
      .innerJoin(
        contestOpportunities,
        eq(opportunityRequirements.opportunityId, contestOpportunities.id),
      )
      .innerJoin(
        opportunitySourceDocuments,
        eq(opportunityRequirements.sourceDocumentId, opportunitySourceDocuments.id),
      )
      .leftJoin(quizSubjects, eq(opportunityRequirements.subjectId, quizSubjects.id))
      .leftJoin(quizTopics, eq(opportunityRequirements.topicId, quizTopics.id))
      .leftJoin(legalActs, eq(opportunityRequirements.legalActId, legalActs.id))
      .leftJoin(legalArticles, eq(opportunityRequirements.legalArticleId, legalArticles.id))
      .leftJoin(
        requirementCreator,
        eq(opportunityRequirements.createdByUserId, requirementCreator.id),
      )
      .leftJoin(
        requirementReviewer,
        eq(opportunityRequirements.reviewedByUserId, requirementReviewer.id),
      )
      .orderBy(desc(opportunityRequirements.createdAt))
      .limit(250),
    db
      .select({
        opportunityId: opportunityOrganizerAssignments.opportunityId,
        role: opportunityOrganizerAssignments.role,
        bankId: quizBanks.id,
        bankName: quizBanks.name,
        bankSlug: quizBanks.slug,
        format: questionStyleProfiles.format,
      })
      .from(opportunityOrganizerAssignments)
      .innerJoin(quizBanks, eq(opportunityOrganizerAssignments.quizBankId, quizBanks.id))
      .innerJoin(
        questionStyleProfiles,
        eq(opportunityOrganizerAssignments.quizBankId, questionStyleProfiles.quizBankId),
      )
      .where(
        and(
          eq(opportunityOrganizerAssignments.status, "reviewed"),
          isNull(opportunityOrganizerAssignments.validUntil),
          eq(quizBanks.isActive, true),
          eq(questionStyleProfiles.isActive, true),
        ),
      ),
    db
      .select({
        id: legalArticles.id,
        actTitle: legalActs.shortTitle,
        articleRef: legalArticles.articleRef,
        heading: legalArticles.heading,
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
      .limit(1_000),
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
        opportunityId: questionOpportunities.opportunityId,
        questionId: questionOpportunities.questionId,
        status: questions.editorialStatus,
      })
      .from(questionOpportunities)
      .innerJoin(questions, eq(questionOpportunities.questionId, questions.id))
      .where(eq(questionOpportunities.relationship, "direct_requirement")),
  ]);

  const assignmentByOpportunity = new Map<number, (typeof assignments)[number]>();
  for (const assignment of assignments) {
    const current = assignmentByOpportunity.get(assignment.opportunityId);
    if (!current || assignment.role === "examination_provider") {
      assignmentByOpportunity.set(assignment.opportunityId, assignment);
    }
  }

  const questionCounts = new Map<number, number>();
  for (const item of linkedQuestions) {
    questionCounts.set(item.opportunityId, (questionCounts.get(item.opportunityId) ?? 0) + 1);
  }

  return {
    opportunities: opportunities.map((item) => ({
      ...item,
      assignment: assignmentByOpportunity.get(item.id) ?? null,
      generatedQuestionCount: questionCounts.get(item.id) ?? 0,
    })),
    sourceDocuments,
    requirements: requirements.map((item) => ({
      ...item,
      assignment: assignmentByOpportunity.get(item.opportunityId) ?? null,
    })),
    articles,
    subjects,
    topics,
    metrics: {
      opportunities: opportunities.length,
      approvedSources: sourceDocuments.filter((item) => item.status === "approved").length,
      pendingSources: sourceDocuments.filter((item) => item.status === "pending_review").length,
      reviewedRequirements: requirements.filter((item) => item.editorialStatus === "reviewed").length,
      pendingRequirements: requirements.filter(
        (item) => item.editorialStatus === "pending_review",
      ).length,
      generatedQuestions: linkedQuestions.length,
    },
  };
}

export type NoticeEngineSnapshot = Awaited<ReturnType<typeof getNoticeEngineSnapshot>>;
