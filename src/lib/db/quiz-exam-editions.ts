import "server-only";

import { and, asc, desc, eq, inArray, isNotNull, isNull, lte, or, sql } from "drizzle-orm";

import { getDb } from "@/lib/db/client";
import { staleWhileRevalidate } from "@/lib/commerce/stale-while-revalidate";
import { originalQuestionContractExists } from "../study/original-question-contract-query";
import { editionHasOriginalTraining } from "@/lib/quiz/original-style-query";
import {
  examEditions,
  legalActs,
  legalArticles,
  legalVersions,
  questions,
  quizBanks,
  quizCareerSpecializations,
  quizCareerTracks,
  quizSubjects,
} from "@/lib/db/schema";
import {
  buildQuizExamEditionCatalog,
  ELIGIBLE_QUIZ_EXAM_STATUSES,
  saoPauloDateIso,
  type QuizExamEditionCatalogItem,
} from "@/lib/quiz/exam-edition-catalog";

/**
 * As duas listas abaixo reconferem, por questão, o contrato vigente e o vínculo
 * verificado do produto. Em 21/11/2026 (EXPLAIN ANALYZE em produção) levavam
 * 38,3 s e 20,2 s, acima do statement_timeout de 30 s do banco: /app/quiz e
 * /app/simulados davam erro. A regra não muda: a mesma consulta roda numa
 * transação com limite próprio e o resultado (igual para todos os alunos) fica
 * 5 min em memória, servido enquanto recalcula. O cache é aquecido na partida
 * (src/instrumentation.ts). A sessão de quiz revalida cada questão ao montar.
 */
export const QUIZ_CATALOG_CACHE_TTL_MS = 5 * 60_000;
const QUIZ_CATALOG_STATEMENT_TIMEOUT = sql.raw(`'120s'`);

async function withCatalogTimeout<T>(run: (db: ReturnType<typeof getDb>) => Promise<T>): Promise<T> {
  return getDb().transaction(async (tx) => {
    await tx.execute(sql`set local statement_timeout = ${QUIZ_CATALOG_STATEMENT_TIMEOUT}`);
    return run(tx as unknown as ReturnType<typeof getDb>);
  });
}

async function loadEligibleQuizExamEditions(
  todayIso: string,
  includeScheduled: boolean,
): Promise<QuizExamEditionCatalogItem[]> {
  const rows = await withCatalogTimeout((db) => db
    .select({
      publicId: examEditions.publicId,
      sourceCheckedAt: examEditions.sourceCheckedAt,
      scheduledProgramReviewed: editionHasOriginalTraining(examEditions.id, examEditions.bankId),
      title: examEditions.title,
      examDate: examEditions.examDate,
      durationMinutes: examEditions.durationMinutes,
      status: examEditions.status,
      organizer: examEditions.organizer,
      jurisdiction: examEditions.jurisdiction,
      officialUrl: examEditions.officialUrl,
      careerId: quizCareerTracks.id,
      careerSlug: quizCareerTracks.slug,
      careerName: quizCareerTracks.name,
      careerShortName: quizCareerTracks.shortName,
      careerIsActive: quizCareerTracks.isActive,
      specializationId: examEditions.specializationId,
      specializationCareerTrackId: quizCareerSpecializations.careerTrackId,
      specializationSlug: quizCareerSpecializations.slug,
      specializationName: quizCareerSpecializations.name,
      specializationIsActive: quizCareerSpecializations.isActive,
      bankSlug: quizBanks.slug,
      bankName: quizBanks.name,
      bankFullName: quizBanks.fullName,
      bankIsActive: quizBanks.isActive,
    })
    .from(examEditions)
    .innerJoin(quizCareerTracks, eq(examEditions.careerTrackId, quizCareerTracks.id))
    .innerJoin(quizBanks, eq(examEditions.bankId, quizBanks.id))
    .leftJoin(
      quizCareerSpecializations,
      and(
        eq(examEditions.specializationId, quizCareerSpecializations.id),
        eq(examEditions.careerTrackId, quizCareerSpecializations.careerTrackId),
      ),
    )
    .where(
      and(
        eq(quizCareerTracks.isActive, true),
        eq(quizBanks.isActive, true),
        or(
          and(inArray(examEditions.status, [...ELIGIBLE_QUIZ_EXAM_STATUSES]), lte(examEditions.examDate, todayIso)),
          includeScheduled ? and(eq(examEditions.status, "scheduled"), isNotNull(examEditions.sourceCheckedAt),
            editionHasOriginalTraining(examEditions.id, examEditions.bankId)) : undefined,
        ),
        isNotNull(examEditions.officialUrl),
        sql<boolean>`char_length(btrim(${examEditions.officialUrl})) > 0`,
        or(
          isNull(examEditions.specializationId),
          eq(quizCareerSpecializations.isActive, true),
        ),
      ),
    )
    .orderBy(desc(examEditions.examDate), asc(examEditions.publicId)));

  return buildQuizExamEditionCatalog(rows, todayIso, includeScheduled);
}

const eligibleEditionsCache = new Map<string, ReturnType<typeof staleWhileRevalidate<QuizExamEditionCatalogItem[]>>>();

export async function listEligibleQuizExamEditions(
  referenceDate = new Date(),
  includeScheduled = false,
): Promise<QuizExamEditionCatalogItem[]> {
  const todayIso = saoPauloDateIso(referenceDate);
  const key = `${todayIso}|${includeScheduled}`;
  let cached = eligibleEditionsCache.get(key);
  if (!cached) {
    // Só o dia corrente fica em memória: a virada do dia descarta as chaves antigas.
    for (const old of eligibleEditionsCache.keys()) if (!old.startsWith(todayIso)) eligibleEditionsCache.delete(old);
    cached = staleWhileRevalidate(() => loadEligibleQuizExamEditions(todayIso, includeScheduled), QUIZ_CATALOG_CACHE_TTL_MS);
    eligibleEditionsCache.set(key, cached);
  }
  return cached();
}

async function loadOriginalStyleSimulationCoverage() {
  return withCatalogTimeout((db) => db
    .select({
      bankSlug: quizBanks.slug,
      bankName: quizBanks.name,
      subjectSlug: quizSubjects.slug,
      subjectName: quizSubjects.name,
      questionCount: sql<number>`count(distinct ${questions.id})::int`,
    })
    .from(questions)
    .innerJoin(quizBanks, eq(questions.styleBankId, quizBanks.id))
    .innerJoin(quizSubjects, eq(questions.subjectId, quizSubjects.id))
    .innerJoin(legalArticles, eq(questions.legalArticleId, legalArticles.id))
    .innerJoin(legalVersions, eq(legalArticles.legalVersionId, legalVersions.id))
    .innerJoin(legalActs, eq(legalVersions.legalActId, legalActs.id))
    .where(and(
      eq(questions.editorialStatus, "reviewed"),
      eq(questions.quizMode, "original_style"),
      eq(questions.sourceRights, "original_authorial"),
      isNotNull(questions.reviewedByUserId),
      eq(quizBanks.isActive, true),
      eq(quizSubjects.isActive, true),
      eq(legalArticles.editorialStatus, "reviewed"),
      eq(legalArticles.sourceRights, "official_text"),
      eq(legalVersions.status, "current"),
      eq(legalActs.isActive, true),
      originalQuestionContractExists(questions.id,questions.type,questions.styleBankId,questions.questionContractId),
    ))
    .groupBy(quizBanks.id, quizSubjects.id)
    .orderBy(desc(sql`count(distinct ${questions.id})`), asc(quizBanks.name), asc(quizSubjects.name)));
}

const simulationCoverageCache = staleWhileRevalidate(loadOriginalStyleSimulationCoverage, QUIZ_CATALOG_CACHE_TTL_MS);

export async function listOriginalStyleSimulationCoverage() {
  return simulationCoverageCache();
}

/** Aquecimento na partida do servidor: o primeiro aluno não espera o cálculo. */
export async function warmQuizCatalogCaches(now = new Date()) {
  await Promise.allSettled([listEligibleQuizExamEditions(now, true), listOriginalStyleSimulationCoverage()]);
}

export type { QuizExamEditionCatalogItem } from "@/lib/quiz/exam-edition-catalog";
