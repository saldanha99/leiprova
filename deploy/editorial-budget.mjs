// Orçamento mensal da API paga do motor editorial (decisões do proprietário em 19/11/2026
// e 21/11/2026). Funções puras, sem E/S: o worker grava o resultado de forma atômica.
// - Teto US$ 50 com parada em 100% (stopAtUsd = capUsd), contando as reservas em andamento.
// - Renovação no mês-calendário UTC, como o limite de gasto da Anthropic ("API usage pauses
//   until 00:00 UTC on the first day of the next month", platform.claude.com/docs/en/api/rate-limits).
// - O mês encerrado vai para `history`; o mês novo começa em 0 e volta ao modo "api".

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
/** Meses guardados em `history` (os mais recentes). */
export const BUDGET_HISTORY_LIMIT = 24;

const round6 = (value) => Math.round(value * 1e6) / 1e6;

/** Mês-calendário UTC ("2026-11") de um instante ISO. */
export function budgetMonth(now) {
  return new Date(now).toISOString().slice(0, 7);
}

const objectOr = (value, fallback) => (value && typeof value === "object" && !Array.isArray(value) ? value : fallback);

/** Modo da próxima execução: API só com chave, sem esgotamento e com espaço para mais uma reserva. */
function modeFor(budget, hasKey, reserveUsd) {
  return hasKey && !budget.exhaustedAt && budget.spentUsd + reserveUsd < budget.stopAtUsd ? "api" : "subscription";
}

/**
 * Fecha o mês salvo em `history` e abre o mês corrente zerado. Volta ao modo "api" se houver chave.
 * Sem mudança de mês, devolve o mesmo objeto e `rolled: false`.
 */
export function rolloverBudget(budget, { hasKey, reserveUsd = 0, now }) {
  const month = budgetMonth(now);
  if (budget.month >= month) return { budget, rolled: false };
  const closed = { month: budget.month, spentUsd: budget.spentUsd, runs: budget.runs, unmeteredRuns: budget.unmeteredRuns,
    byRole: budget.byRole, exhaustedAt: budget.exhaustedAt, closedAt: now };
  const next = {
    ...budget, month, spentUsd: 0, runs: 0, unmeteredRuns: 0, byRole: {}, exhaustedAt: null,
    renewedAt: now, updatedAt: now,
    history: [...budget.history, closed].slice(-BUDGET_HISTORY_LIMIT),
  };
  next.mode = modeFor(next, hasKey, reserveUsd);
  return { budget: next, rolled: true };
}

/**
 * Estado inicial ou recuperado do orçamento. Arquivo antigo sem `month` é tratado como o mês UTC
 * corrente (migração). Mês salvo anterior ao corrente é renovado aqui mesmo.
 * Esgotado só reabre no mês seguinte ou se a parada configurada subiu (ex.: 48 -> 50), e só até a nova parada.
 */
export function loadBudget(saved, { capUsd, stopAtUsd, reserveUsd = 0, hasKey, now }) {
  const base = objectOr(saved, {});
  const spentUsd = Number.isFinite(base.spentUsd) ? base.spentUsd : 0;
  let exhaustedAt = typeof base.exhaustedAt === "string" ? base.exhaustedAt : null;
  if (exhaustedAt && Number.isFinite(base.stopAtUsd) && base.stopAtUsd < stopAtUsd && spentUsd + reserveUsd < stopAtUsd) exhaustedAt = null;
  const history = Array.isArray(base.history)
    ? base.history.filter((entry) => entry && typeof entry === "object" && MONTH.test(entry.month)).slice(-BUDGET_HISTORY_LIMIT) : [];
  const budget = {
    capUsd, stopAtUsd, month: MONTH.test(base.month) ? base.month : budgetMonth(now), spentUsd,
    runs: Number.isInteger(base.runs) ? base.runs : 0,
    unmeteredRuns: Number.isInteger(base.unmeteredRuns) ? base.unmeteredRuns : 0,
    byRole: objectOr(base.byRole, {}),
    mode: "subscription", exhaustedAt,
    renewedAt: typeof base.renewedAt === "string" ? base.renewedAt : null,
    updatedAt: now, history,
  };
  const current = rolloverBudget(budget, { hasKey, reserveUsd, now }).budget;
  // Esgotamento recalculado na partida: sem espaço para uma reserva, o mês está encerrado para a API.
  if (hasKey && !current.exhaustedAt && current.spentUsd + reserveUsd >= current.stopAtUsd) current.exhaustedAt = now;
  current.mode = modeFor(current, hasKey, reserveUsd);
  return current;
}

/** A chave só vai para a próxima execução se o gasto + reservas em andamento + a nova reserva couberem antes da parada. */
export function budgetAllows(budget, inflightUsd, reserveUsd) {
  return budget.mode === "api" && !budget.exhaustedAt && budget.spentUsd + inflightUsd + reserveUsd < budget.stopAtUsd;
}

/**
 * Soma o custo real (ou a reserva, sem medição). Esgota quando não cabe mais nenhuma reserva antes da
 * parada: com parada = teto, o total nunca passa do teto enquanto cada execução custar até a reserva.
 */
export function chargeBudget(budget, role, costUsd, reserveUsd, now) {
  const metered = typeof costUsd === "number";
  const charged = metered ? costUsd : reserveUsd;
  const roleStats = budget.byRole[role] ?? { runs: 0, spentUsd: 0 };
  const next = {
    ...budget,
    spentUsd: round6(budget.spentUsd + charged), runs: budget.runs + 1,
    unmeteredRuns: budget.unmeteredRuns + (metered ? 0 : 1),
    byRole: { ...budget.byRole, [role]: { runs: roleStats.runs + 1, spentUsd: round6(roleStats.spentUsd + charged) } },
    updatedAt: now,
  };
  if (next.spentUsd + reserveUsd >= next.stopAtUsd && !next.exhaustedAt) Object.assign(next, { exhaustedAt: now, mode: "subscription" });
  return next;
}

/**
 * A instância Codex roda enquanto a principal estiver fora da API no mês corrente (esgotada ou sem chave).
 * Arquivo de um mês anterior = a API volta na renovação: Codex desligado.
 * Arquivo antigo sem `month` vale como mês corrente (mesma migração do loadBudget).
 */
export function codexShouldRun(budget, now) {
  if (!budget || typeof budget !== "object") return false;
  const month = MONTH.test(budget.month) ? budget.month : budgetMonth(now);
  return month === budgetMonth(now) && budget.mode === "subscription";
}
