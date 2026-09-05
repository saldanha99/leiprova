import { sql } from "drizzle-orm";
import type { getDb } from "@/lib/db/client";
import { questions } from "@/lib/db/schema";

type Db = ReturnType<typeof getDb>;
export type ApprovalExecutor = Parameters<Parameters<Db["transaction"]>[0]>[0];
export type ApprovalLockScope = {
  readonly questionIds: readonly number[];
  readonly legalArticleIds: readonly number[];
  readonly styleBankIds: readonly number[];
};

/**
 * Reserva questões e seu contexto atual numa ordem estável.
 * FOR SHARE exige UPDATE no PostgreSQL mesmo sem escrever. A função restrita
 * faz somente os locks, sem dar à aplicação permissão para editar atos/bancas.
 * As referências são relidas depois de travar as questões, nunca confiadas ao
 * escopo consultado antes da transação. A revisão e a gravação continuam aqui
 * sob as permissões normais da aplicação.
 */
export async function lockApprovalScope(transaction: ApprovalExecutor, scope: ApprovalLockScope) {
  const ids = [...new Set(scope.questionIds)].sort((a, b) => a - b);
  if (!ids.length) return;
  if (ids.length > 250 || ids.some((id) => !Number.isSafeInteger(id) || id < 1)) {
    throw new Error("Escopo editorial inválido.");
  }
  await transaction.execute(sql`select public.lock_editorial_approval_context(
    array[${sql.join(ids.map((id) => sql`${id}`), sql`,`)}]::bigint[]
  )`);
}

/** Última conferência da vigência dentro do UPDATE de aprovação. */
export function currentLegalSourceExists() {
  return sql`exists (
    select 1 from legal_articles current_article
    join legal_versions current_version on current_version.id = current_article.legal_version_id
    join legal_acts current_act on current_act.id = current_version.legal_act_id
    where current_article.id = ${questions.legalArticleId}
      and current_article.editorial_status = 'reviewed'
      and current_article.source_rights = 'official_text'
      and current_version.status = 'current' and current_act.is_active = true
  )`;
}
