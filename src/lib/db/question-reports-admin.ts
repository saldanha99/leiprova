import "server-only";

import { createHash } from "node:crypto";

import { and, asc, desc, eq, inArray, sql, type SQL } from "drizzle-orm";

import { getDb } from "@/lib/db/client";
import {
  legalActs,
  legalArticles,
  legalVersions,
  questionOptions,
  questionReports,
  questions,
  users,
} from "@/lib/db/schema";
import {
  ACTIVE_QUESTION_REPORT_STATUSES,
  QUESTION_REPORT_PROMPT_PREVIEW_CHARS,
  QUESTION_REPORT_STATUSES,
  QUESTION_REPORTS_PAGE_SIZE,
  type QuestionReportFilters,
  type QuestionReportStatus,
  truncatePreview,
} from "@/lib/study/question-report-admin";

export type AdminQuestionReportOption = {
  key: string;
  text: string;
  isCorrect: boolean;
};

export type AdminQuestionReport = {
  id: number;
  reason: string;
  notes: string | null;
  status: QuestionReportStatus;
  createdAt: Date;
  resolvedAt: Date | null;
  reporterId: string;
  activeReportsForQuestion: number;
  question: {
    publicId: string;
    quizMode: string;
    editorialStatus: string;
    promptPreview: string;
    prompt: string;
    explanation: string;
    articleRef: string | null;
    lawShortTitle: string | null;
    options: AdminQuestionReportOption[];
  };
};

export type AdminQuestionReportsPage = {
  reports: AdminQuestionReport[];
  hasNextPage: boolean;
  statusCounts: Record<QuestionReportStatus, number>;
};

/**
 * Identificador curto e estável do aluno, sem e-mail nem id interno. O `public_id` é um UUID
 * aleatório, então o hash não pode ser revertido por enumeração.
 */
export function anonymizedReporterId(userPublicId: string) {
  const digest = createHash("sha256")
    .update("leiprova-question-report-reporter-v1\0")
    .update(userPublicId)
    .digest("hex");
  return `aluno-${digest.slice(0, 8)}`;
}

function isQuestionReportStatus(value: string): value is QuestionReportStatus {
  return (QUESTION_REPORT_STATUSES as readonly string[]).includes(value);
}

/**
 * Lista paginada, mais recentes primeiro. Com o filtro padrão (abertos) a ordenação usa o índice
 * parcial `question_reports_open_idx`; a contagem por questão usa `question_reports_question_id_idx`.
 * Pede uma linha a mais para saber se há próxima página sem `count(*)` da lista inteira.
 */
export async function listAdminQuestionReports(filters: QuestionReportFilters): Promise<AdminQuestionReportsPage> {
  const db = getDb();
  const conditions: SQL[] = [];
  if (filters.status !== "all") conditions.push(eq(questionReports.status, filters.status));
  if (filters.reason) conditions.push(eq(questionReports.reason, filters.reason));

  const activeStatuses = sql.join(
    ACTIVE_QUESTION_REPORT_STATUSES.map((status) => sql`${status}`),
    sql`, `,
  );

  const [rows, countRows] = await Promise.all([
    db
      .select({
        id: questionReports.id,
        questionId: questionReports.questionId,
        reason: questionReports.reason,
        notes: questionReports.notes,
        status: questionReports.status,
        createdAt: questionReports.createdAt,
        resolvedAt: questionReports.resolvedAt,
        userPublicId: users.publicId,
        activeReportsForQuestion: sql<number>`(
          select count(*)::int from question_reports other
          where other.question_id = ${questionReports.questionId}
            and other.status in (${activeStatuses})
        )`,
        questionPublicId: questions.publicId,
        quizMode: questions.quizMode,
        editorialStatus: questions.editorialStatus,
        prompt: questions.prompt,
        explanation: questions.explanation,
        articleRef: legalArticles.articleRef,
        lawShortTitle: legalActs.shortTitle,
      })
      .from(questionReports)
      .innerJoin(questions, eq(questions.id, questionReports.questionId))
      .innerJoin(users, eq(users.id, questionReports.userId))
      .leftJoin(legalArticles, eq(legalArticles.id, questions.legalArticleId))
      .leftJoin(legalVersions, eq(legalVersions.id, legalArticles.legalVersionId))
      .leftJoin(legalActs, eq(legalActs.id, legalVersions.legalActId))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(questionReports.createdAt), desc(questionReports.id))
      .limit(QUESTION_REPORTS_PAGE_SIZE + 1)
      .offset((filters.page - 1) * QUESTION_REPORTS_PAGE_SIZE),
    db
      .select({ status: questionReports.status, total: sql<number>`count(*)::int` })
      .from(questionReports)
      .where(filters.reason ? eq(questionReports.reason, filters.reason) : undefined)
      .groupBy(questionReports.status),
  ]);

  const pageRows = rows.slice(0, QUESTION_REPORTS_PAGE_SIZE);
  const questionIds = [...new Set(pageRows.map((row) => row.questionId))];
  const optionRows = questionIds.length
    ? await db
        .select({
          questionId: questionOptions.questionId,
          key: questionOptions.optionKey,
          text: questionOptions.text,
          isCorrect: questionOptions.isCorrect,
        })
        .from(questionOptions)
        .where(inArray(questionOptions.questionId, questionIds))
        .orderBy(asc(questionOptions.questionId), asc(questionOptions.sortOrder))
    : [];
  const optionsByQuestion = new Map<number, AdminQuestionReportOption[]>();
  for (const option of optionRows) {
    const list = optionsByQuestion.get(option.questionId) ?? [];
    list.push({ key: option.key, text: option.text, isCorrect: option.isCorrect });
    optionsByQuestion.set(option.questionId, list);
  }

  const statusCounts: Record<QuestionReportStatus, number> = { open: 0, reviewing: 0, resolved: 0, dismissed: 0 };
  for (const row of countRows) {
    if (isQuestionReportStatus(row.status)) statusCounts[row.status] = Number(row.total);
  }

  return {
    hasNextPage: rows.length > QUESTION_REPORTS_PAGE_SIZE,
    statusCounts,
    reports: pageRows.flatMap((row) => {
      // O check do banco garante o status; linha fora dele seria dado corrompido e fica de fora.
      if (!isQuestionReportStatus(row.status)) return [];
      return [
        {
          id: row.id,
          reason: row.reason,
          notes: row.notes,
          status: row.status,
          createdAt: row.createdAt,
          resolvedAt: row.resolvedAt,
          reporterId: anonymizedReporterId(row.userPublicId),
          activeReportsForQuestion: Number(row.activeReportsForQuestion),
          question: {
            publicId: row.questionPublicId,
            quizMode: row.quizMode,
            editorialStatus: row.editorialStatus,
            promptPreview: truncatePreview(row.prompt, QUESTION_REPORT_PROMPT_PREVIEW_CHARS),
            prompt: row.prompt,
            explanation: row.explanation,
            articleRef: row.articleRef,
            lawShortTitle: row.lawShortTitle,
            options: optionsByQuestion.get(row.questionId) ?? [],
          },
        },
      ];
    }),
  };
}
