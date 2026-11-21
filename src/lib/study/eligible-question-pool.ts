import "server-only";

import { and, eq, inArray, sql, type SQL } from "drizzle-orm";

import { staleWhileRevalidate } from "@/lib/commerce/stale-while-revalidate";
import { getDb } from "@/lib/db/client";
import { legalActs, legalArticles, legalVersions, questions } from "@/lib/db/schema";
import { authorialStudyRightsConditions } from "@/lib/study/question-rights";

/**
 * Questões que podem entrar no treino (iguais para todos os alunos): revisadas, com
 * direitos autorais conferidos, artigo revisado de versão vigente e lei ativa.
 * Em 21/11/2026 o filtro de direitos sobre o acervo inteiro levava 23,6 s (EXPLAIN
 * ANALYZE em produção) e /api/study/session chegava a 26 s, rente ao limite de 30 s.
 * O conjunto fica 5 min em memória (servido enquanto recalcula, aquecido na partida);
 * a rota reconfere o filtro completo nas candidatas antes de entregar, então uma
 * questão que deixou de valer nesse intervalo nunca chega ao aluno.
 */
export const STUDY_POOL_CACHE_TTL_MS = 5 * 60_000;
/** Acima disso a lista de ids vira parâmetros demais para uma consulta: volta ao filtro direto. */
export const STUDY_POOL_MAX_IDS = 50_000;

export function studyBaseConditions(): SQL[] {
  return [
    eq(questions.editorialStatus, "reviewed"),
    eq(legalArticles.editorialStatus, "reviewed"),
    eq(legalVersions.status, "current"),
    eq(legalActs.isActive, true),
  ];
}

async function loadEligibleStudyQuestionIds(): Promise<number[]> {
  return getDb().transaction(async (tx) => {
    await tx.execute(sql`set local statement_timeout = '120s'`);
    const rows = await tx
      .select({ id: questions.id })
      .from(questions)
      .innerJoin(legalArticles, eq(questions.legalArticleId, legalArticles.id))
      .innerJoin(legalVersions, eq(legalArticles.legalVersionId, legalVersions.id))
      .innerJoin(legalActs, eq(legalVersions.legalActId, legalActs.id))
      .where(and(...studyBaseConditions(), authorialStudyRightsConditions()));
    return rows.map((row) => row.id);
  });
}

type PoolStore = { ids?: ReturnType<typeof staleWhileRevalidate<number[]>> };
// No processo inteiro: src/instrumentation.ts é empacotado separado das rotas.
const store: PoolStore = ((globalThis as { __leiprovaStudyPool?: PoolStore }).__leiprovaStudyPool ??= {});

export async function eligibleStudyQuestionIds(): Promise<number[]> {
  store.ids ??= staleWhileRevalidate(loadEligibleStudyQuestionIds, STUDY_POOL_CACHE_TTL_MS);
  return store.ids();
}

/** Condição de elegibilidade para a escolha das candidatas (barata, pela lista em cache). */
export async function eligibleStudyCondition(): Promise<SQL | undefined> {
  const ids = await eligibleStudyQuestionIds();
  if (ids.length > STUDY_POOL_MAX_IDS) return authorialStudyRightsConditions();
  return ids.length ? inArray(questions.id, ids) : sql`false`;
}

/** Reconfere o filtro completo nas candidatas, preservando a ordem; devolve as primeiras `limit`. */
export async function keepCurrentlyEligible<T extends { id: number }>(candidates: T[], limit: number): Promise<T[]> {
  if (!candidates.length) return [];
  const rows = await getDb()
    .select({ id: questions.id })
    .from(questions)
    .innerJoin(legalArticles, eq(questions.legalArticleId, legalArticles.id))
    .innerJoin(legalVersions, eq(legalArticles.legalVersionId, legalVersions.id))
    .innerJoin(legalActs, eq(legalVersions.legalActId, legalActs.id))
    .where(and(inArray(questions.id, candidates.map((c) => c.id)), ...studyBaseConditions(), authorialStudyRightsConditions()));
  const ok = new Set(rows.map((row) => row.id));
  return candidates.filter((c) => ok.has(c.id)).slice(0, limit);
}

export async function warmStudyPool() {
  await eligibleStudyQuestionIds().catch(() => undefined);
}
