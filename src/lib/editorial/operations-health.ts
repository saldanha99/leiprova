import { z } from "zod";

/** Dois ciclos de 6 h mais uma hora de folga: além disso o worker parou de concluir. */
export const EDITORIAL_CYCLE_STALE_HOURS = 13;
/** As reservas dos agentes se renovam em 24 h; fila pendente sem execução nesse
 * prazo indica Maestri fechado ou agentes travados. */
export const AGENT_RUN_STALE_HOURS = 24;

export type EngineFreshness = Readonly<{
  lastAt: Date | null;
  ageHours: number | null;
  stale: boolean;
}>;

/** Idade da última execução registrada; ausência de registro também é atraso. */
export function engineFreshness(
  lastAt: string | null,
  now: Date,
  staleAfterHours: number,
): EngineFreshness {
  const at = lastAt ? new Date(lastAt) : null;
  if (!at || Number.isNaN(at.getTime())) {
    return { lastAt: null, ageHours: null, stale: true };
  }
  const ageHours = (now.getTime() - at.getTime()) / 3_600_000;
  return { lastAt: at, ageHours, stale: ageHours > staleAfterHours };
}

/** Sem fila pendente o Maestri está ocioso, não parado. */
export function agentFreshness(
  lastRunAt: string | null,
  pendingWork: number,
  now: Date,
): EngineFreshness {
  const freshness = engineFreshness(lastRunAt, now, AGENT_RUN_STALE_HOURS);
  return { ...freshness, stale: pendingWork > 0 && freshness.stale };
}

const cycleSummarySchema = z.object({
  failedSteps: z.array(
    z.object({ step: z.string().max(80), code: z.string().max(80) }),
  ),
});

/** Etapas que falharam no último ciclo, lidas do resumo auditado. Resumos
 * anteriores a 27/09/2026 não têm o campo e contam como sem falha registrada. */
export function cycleFailedSteps(summary: unknown) {
  const parsed = cycleSummarySchema.safeParse(summary);
  return parsed.success ? parsed.data.failedSteps : [];
}
