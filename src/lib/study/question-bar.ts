import "server-only";

import { and, eq, inArray, or, sql } from "drizzle-orm";

import { approvedReleasedProductPreviousExamQuestionExists } from "@/lib/commerce/previous-exam-content";
import { getDb } from "@/lib/db/client";
import { questionReports, questions, reviewQueue } from "@/lib/db/schema";
import type { StudyEntitlement } from "@/lib/study/access-policy";
import { eligibleStudyQuestionIds } from "@/lib/study/eligible-question-pool";
import {
  QUESTION_HISTORY_LIMIT,
  type QuestionHistoryEntry,
  type QuestionReportReason,
} from "@/lib/study/question-bar-contract";

export type BarQuestion = {
  id: number;
  publicId: string;
  quizMode: string;
};

/**
 * Questão revisada e com direitos de estudo: autoral (lei seca/inédita) ou prova anterior
 * licenciada que pertença a produto liberado, como no quiz (nem o Master vê questão real solta).
 * O `canStudyQuestion` é conferido antes, na rota. A barra não devolve enunciado nem gabarito.
 *
 * O filtro completo de direitos autorais (`authorialStudyRightsConditions`) custa ~0,8 s só de
 * planejamento em produção (EXPLAIN de 21/11/2026) e não é repetido aqui: a barra só expõe dados
 * do aluno e contagens, e a revisão confere a lista elegível em `isReviewable`.
 */
export async function findBarQuestion(publicId: string, entitlement: StudyEntitlement): Promise<BarQuestion | null> {
  const db = getDb();
  const [row] = await db
    .select({ id: questions.id, publicId: questions.publicId, quizMode: questions.quizMode })
    .from(questions)
    .where(
      and(
        eq(questions.publicId, publicId),
        eq(questions.editorialStatus, "reviewed"),
        or(
          and(inArray(questions.quizMode, ["dry_law", "original_style"]), eq(questions.sourceRights, "original_authorial")),
          and(eq(questions.quizMode, "previous_exam"), eq(questions.sourceRights, "licensed")),
        ),
      ),
    )
    .limit(1);
  if (!row) return null;

  if (row.quizMode === "previous_exam") {
    const coverageEndsAt =
      entitlement.hasFullAccess && entitlement.accessEndsAt
        ? sql`${entitlement.accessEndsAt.toISOString()}::timestamptz`
        : sql`current_timestamp`;
    const [released] = await db
      .select({ id: questions.id })
      .from(questions)
      .where(and(eq(questions.id, row.id), approvedReleasedProductPreviousExamQuestionExists(questions.id, coverageEndsAt)))
      .limit(1);
    if (!released) return null;
  }
  return row;
}

/**
 * Só entra na fila o que a sessão de revisão consegue entregar: a lista elegível do treino
 * (lei seca autoral, artigo revisado de versão vigente), em cache de 15 min e aquecida na partida.
 */
export async function isReviewable(question: BarQuestion) {
  if (question.quizMode === "previous_exam") return false;
  return (await eligibleStudyQuestionIds()).includes(question.id);
}

/**
 * "Revisar depois": deixa a questão vencida agora na fila, sem mexer em estágio, repetições
 * ou lapsos (a próxima resposta segue a regra normal de `scheduleReview`). Idempotente.
 */
export async function enqueueQuestionForReview(userId: number, questionId: number, now: Date) {
  const [row] = await getDb()
    .insert(reviewQueue)
    .values({
      userId,
      questionId,
      stage: 0,
      repetitions: 0,
      lapses: 0,
      nextReviewAt: now,
      lastResult: "manual_review",
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [reviewQueue.userId, reviewQueue.questionId],
      set: {
        // Nunca adia uma revisão que já estava vencida.
        nextReviewAt: sql`least(${reviewQueue.nextReviewAt}, ${now.toISOString()}::timestamptz)`,
        updatedAt: now,
      },
    })
    .returning({ nextReviewAt: reviewQueue.nextReviewAt });
  return row?.nextReviewAt ?? now;
}

const OPEN_REPORT_STATUSES = ["open", "reviewing"] as const;

/** Um relato aberto por aluno e questão; o lock evita duplicata em clique duplo. */
export async function createQuestionReport(input: {
  userId: number;
  questionId: number;
  reason: QuestionReportReason;
  notes?: string;
}): Promise<"created" | "already_open"> {
  return getDb().transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`leiprova:question-report:${input.userId}:${input.questionId}`}, 0))`,
    );
    const [existing] = await tx
      .select({ id: questionReports.id })
      .from(questionReports)
      .where(
        and(
          eq(questionReports.userId, input.userId),
          eq(questionReports.questionId, input.questionId),
          inArray(questionReports.status, [...OPEN_REPORT_STATUSES]),
        ),
      )
      .limit(1);
    if (existing) return "already_open";
    await tx.insert(questionReports).values({
      userId: input.userId,
      questionId: input.questionId,
      reason: input.reason,
      notes: input.notes ?? null,
      status: "open",
    });
    return "created";
  });
}

type HistoryRow = {
  answered_at: Date | string;
  is_correct: boolean;
  option_key: string | null;
  origin: QuestionHistoryEntry["origin"];
};

/**
 * Respostas do próprio aluno: tentativas registradas (treino e quizzes concluídos) mais as
 * de quiz de treino ainda aberto. Simulado não concluído fica de fora: revelaria o acerto antes da entrega.
 */
export async function loadQuestionHistory(userId: number, questionId: number): Promise<QuestionHistoryEntry[]> {
  const rows = await getDb().execute<HistoryRow>(sql`
    select ua.answered_at, ua.is_correct, qo.option_key,
      case when ua.quiz_session_id is null then 'treino'
           when qs.experience = 'exam' then 'simulado'
           else 'quiz' end as origin
    from user_attempts ua
    left join question_options qo on qo.id = ua.selected_option_id
    left join quiz_sessions qs on qs.id = ua.quiz_session_id
    where ua.user_id = ${userId} and ua.question_id = ${questionId}
    union all
    select qsa.answered_at, qsa.is_correct, qo.option_key, 'quiz' as origin
    from quiz_session_answers qsa
    join quiz_sessions qs on qs.id = qsa.session_id
    left join question_options qo on qo.id = qsa.selected_option_id
    where qsa.question_id = ${questionId}
      and qs.user_id = ${userId}
      and qs.experience = 'training'
      and qs.status <> 'completed'
    order by 1 desc
    limit ${QUESTION_HISTORY_LIMIT}
  `);
  return rows.map((row) => ({
    answeredAt: new Date(row.answered_at).toISOString(),
    isCorrect: Boolean(row.is_correct),
    optionKey: row.option_key,
    origin: row.origin,
  }));
}

type StatsRow = { answers: number | string; correct: number | string };

/**
 * Acerto da turma numa questão, pelos índices `*_question_id_idx` (sem varrer as tabelas).
 * Contas de QA (`@example.invalid`) e simulados não entregues ficam fora.
 */
export async function loadClassStats(questionId: number) {
  const [row] = await getDb().execute<StatsRow>(sql`
    select count(*)::int as answers, (count(*) filter (where answer.is_correct))::int as correct
    from (
      select ua.is_correct
      from user_attempts ua
      join users u on u.id = ua.user_id
      where ua.question_id = ${questionId}
        and u.email not ilike '%@example.invalid'
      union all
      select qsa.is_correct
      from quiz_session_answers qsa
      join quiz_sessions qs on qs.id = qsa.session_id
      join users u on u.id = qs.user_id
      where qsa.question_id = ${questionId}
        and qs.experience = 'training'
        and qs.status <> 'completed'
        and u.email not ilike '%@example.invalid'
    ) answer
  `);
  return { answers: Number(row?.answers ?? 0), correct: Number(row?.correct ?? 0) };
}

const STATS_TTL_MS = 10 * 60 * 1000;
const STATS_CACHE_MAX = 2_000;
const statsCache = new Map<number, { expiresAt: number; value: { answers: number; correct: number } }>();

/** Cache curto por processo: o número da turma muda devagar e a mesma questão é aberta por muitos. */
export async function cachedClassStats(questionId: number, now = Date.now()) {
  const hit = statsCache.get(questionId);
  if (hit && hit.expiresAt > now) return hit.value;
  const value = await loadClassStats(questionId);
  if (statsCache.size >= STATS_CACHE_MAX) {
    const oldest = statsCache.keys().next().value;
    if (oldest !== undefined) statsCache.delete(oldest);
  }
  statsCache.set(questionId, { expiresAt: now + STATS_TTL_MS, value });
  return value;
}

export function clearClassStatsCache() {
  statsCache.clear();
}
