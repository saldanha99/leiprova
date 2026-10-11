import "server-only";

import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { getDb } from "@/lib/db/client";
import {
  legalActs,
  legalArticles,
  legalVersions,
  questionOptions,
  questions,
  questionStyleProfiles,
  quizBanks,
  quizSubjects,
  quizTopics,
  users,
} from "@/lib/db/schema";
import { EDITORIAL_BATCH_LIMIT } from "@/lib/editorial/clean-room";
import {
  buildDossierFingerprint,
  type DossierOption,
  type QuestionDossier,
} from "@/lib/editorial/dossier-fingerprint";

/**
 * Mapeador único de linha para dossiê.
 *
 * A tela de conferência e a transação de aprovação precisam produzir exatamente
 * a mesma impressão digital. Se cada lado montasse o objeto por conta própria,
 * um campo esquecido de um lado faria a comparação passar sem cobrir aquele
 * conteúdo. Por isso as duas pontas passam por aqui.
 */
export type ApprovalDossierRow = {
  publicId: string;
  type: string;
  prompt: string;
  explanation: string;
  learningObjective: string | null;
  difficulty: number;
  articleRef: string | null;
  literalText: string | null;
  sourceUrl: string | null;
  sourceVerifiedAt: Date | string | null;
};

export function toQuestionDossier(
  row: ApprovalDossierRow,
  options: readonly DossierOption[],
): QuestionDossier {
  return {
    publicId: row.publicId,
    type: row.type,
    prompt: row.prompt,
    explanation: row.explanation,
    learningObjective: row.learningObjective,
    difficulty: row.difficulty,
    articleRef: row.articleRef,
    literalText: row.literalText,
    sourceUrl: row.sourceUrl,
    sourceVerifiedAt: row.sourceVerifiedAt,
    options,
  };
}

/** Questões ligadas ao edital (question_opportunities), para revisar por concurso. */
function questionsOfContest(opportunitySlug: string) {
  return sql`${questions.id} in (
    select link.question_id from question_opportunities link
    join contest_opportunities opportunity on opportunity.id = link.opportunity_id
    where opportunity.slug = ${opportunitySlug}
  )`;
}

/** Concursos com inéditas da fábrica, com o que falta revisar em cada um. */
export async function listEditorialContests() {
  return getDb().execute<{
    slug: string;
    title: string;
    examDate: string | null;
    drafts: number;
    pending: number;
    reviewed: number;
  }>(sql`
    select opportunity.slug, opportunity.title, opportunity.exam_date::text as "examDate",
      count(*) filter (where question.editorial_status = 'draft')::int as drafts,
      count(*) filter (where question.editorial_status = 'pending_review')::int as pending,
      count(*) filter (where question.editorial_status = 'reviewed')::int as reviewed
    from question_opportunities link
    join contest_opportunities opportunity on opportunity.id = link.opportunity_id
    join questions question on question.id = link.question_id
    where question.quiz_mode = 'original_style'
    group by opportunity.slug, opportunity.title, opportunity.exam_date
    order by opportunity.exam_date nulls last, opportunity.slug
  `);
}

export async function getEditorialFactorySnapshot(filter: { opportunitySlug?: string } = {}) {
  const db = getDb();
  const creator = alias(users, "question_creator");
  const reviewer = alias(users, "question_reviewer");
  // Com concurso escolhido, a fila mostra só o que falta revisar dele, na ordem
  // em que o Autor escreveu; sem filtro, segue a fila geral mais recente.
  const contest = filter.opportunitySlug;
  const queueWhere = contest
    ? and(
        eq(questions.quizMode, "original_style"),
        inArray(questions.editorialStatus, ["draft", "pending_review"]),
        questionsOfContest(contest),
      )
    : eq(questions.quizMode, "original_style");

  const [profiles, articles, subjects, topics, queueRows, optionRows, metricRows] = await Promise.all([
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
        type: questions.type,
        prompt: questions.prompt,
        explanation: questions.explanation,
        learningObjective: questions.learningObjective,
        difficulty: questions.difficulty,
        editorialStatus: questions.editorialStatus,
        authorshipMethod: questions.authorshipMethod,
        generatorModel: questions.generatorModel,
        promptVersion: questions.promptVersion,
        bankName: quizBanks.name,
        articleRef: legalArticles.articleRef,
        literalText: legalArticles.literalText,
        sourceTitle: questions.sourceTitle,
        sourceUrl: legalVersions.sourceUrl,
        sourceVerifiedAt: legalVersions.verifiedAt,
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
      .innerJoin(legalVersions, eq(legalArticles.legalVersionId, legalVersions.id))
      .innerJoin(quizSubjects, eq(questions.subjectId, quizSubjects.id))
      .leftJoin(quizTopics, eq(questions.topicId, quizTopics.id))
      .leftJoin(creator, eq(questions.createdByUserId, creator.id))
      .leftJoin(reviewer, eq(questions.reviewedByUserId, reviewer.id))
      .where(queueWhere)
      .orderBy(contest ? asc(questions.createdAt) : desc(questions.createdAt))
      .limit(EDITORIAL_BATCH_LIMIT),
    db
      .select({
        questionPublicId: questions.publicId,
        optionKey: questionOptions.optionKey,
        text: questionOptions.text,
        isCorrect: questionOptions.isCorrect,
        rationale: questionOptions.rationale,
        sortOrder: questionOptions.sortOrder,
      })
      .from(questionOptions)
      .innerJoin(questions, eq(questionOptions.questionId, questions.id))
      .where(queueWhere)
      .orderBy(contest ? asc(questions.createdAt) : desc(questions.createdAt), questionOptions.sortOrder)
      .limit(EDITORIAL_BATCH_LIMIT * 5),
    db
      .select({
        total: sql<number>`count(*)::int`,
        drafts: sql<number>`count(*) filter (where ${questions.editorialStatus} = 'draft')::int`,
        pending: sql<number>`count(*) filter (where ${questions.editorialStatus} = 'pending_review')::int`,
        reviewed: sql<number>`count(*) filter (where ${questions.editorialStatus} = 'reviewed')::int`,
        suspended: sql<number>`count(*) filter (where ${questions.editorialStatus} = 'suspended')::int`,
        claimable: sql<number>`count(*) filter (
          where ${questions.editorialStatus} = 'draft' and ${questions.createdByUserId} is null
        )::int`,
        reviewable: sql<number>`count(*) filter (
          where ${questions.editorialStatus} = 'pending_review'
            and ${questions.createdByUserId} is not null
        )::int`,
      })
      .from(questions)
      .where(eq(questions.quizMode, "original_style")),
  ]);

  const optionsByQuestion = new Map<string, typeof optionRows>();
  for (const option of optionRows) {
    const current = optionsByQuestion.get(option.questionPublicId) ?? [];
    current.push(option);
    optionsByQuestion.set(option.questionPublicId, current);
  }

  const queue = queueRows.map((item) => {
    const options = optionsByQuestion.get(item.publicId) ?? [];
    return {
      ...item,
      options,
      // Calculada no servidor, no mesmo instante em que o dossiê é montado para
      // a tela. É esta impressão que a aprovação vai reconferir sob transação.
      dossierFingerprint: buildDossierFingerprint(toQuestionDossier(item, options)),
    };
  });

  return {
    profiles,
    articles,
    subjects,
    topics,
    queue,
    metrics: metricRows[0] ?? {
      total: 0,
      drafts: 0,
      pending: 0,
      reviewed: 0,
      suspended: 0,
      claimable: 0,
      reviewable: 0,
    },
  };
}

export type EditorialFactorySnapshot = Awaited<ReturnType<typeof getEditorialFactorySnapshot>>;
