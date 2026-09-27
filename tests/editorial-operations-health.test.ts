import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it, vi } from "vitest";

import { AGENT_WORK_DAILY_LIMIT } from "@/lib/editorial/agent-work-contract";
import { agentWorkSummary, type AgentDatabase } from "@/lib/editorial/agent-work-queue";
import {
  agentFreshness,
  cycleFailedSteps,
  EDITORIAL_CYCLE_STALE_HOURS,
  engineFreshness,
} from "@/lib/editorial/operations-health";

const now = new Date("2026-09-27T18:00:00.000-03:00");
const hoursAgo = (hours: number) => new Date(now.getTime() - hours * 3_600_000).toISOString();

describe("saúde dos motores no painel", () => {
  it("marca a coleta como atrasada depois de dois ciclos de 6 h", () => {
    expect(engineFreshness(hoursAgo(12.9), now, EDITORIAL_CYCLE_STALE_HOURS).stale).toBe(false);
    expect(engineFreshness(hoursAgo(13.1), now, EDITORIAL_CYCLE_STALE_HOURS).stale).toBe(true);
  });

  it("interpreta o texto de timestamp devolvido pelo Postgres", () => {
    // Última conclusão antes do incidente: 14/09/2026 às 11h44 BRT.
    const worker = engineFreshness("2026-09-14 14:44:31.123456+00", now, EDITORIAL_CYCLE_STALE_HOURS);

    expect(worker.lastAt?.toISOString()).toBe("2026-09-14T14:44:31.123Z");
    expect(worker.stale).toBe(true);
    expect(Math.floor(worker.ageHours ?? 0)).toBe(318);
  });

  it("trata ausência de registro como atraso", () => {
    expect(engineFreshness(null, now, EDITORIAL_CYCLE_STALE_HOURS)).toEqual({
      lastAt: null,
      ageHours: null,
      stale: true,
    });
    expect(engineFreshness("sem data", now, EDITORIAL_CYCLE_STALE_HOURS).stale).toBe(true);
  });

  it("aponta agentes parados somente quando há fila pendente", () => {
    const lastRun = "2026-09-17 10:50:50.833+00";

    expect(agentFreshness(lastRun, 139, now).stale).toBe(true);
    expect(agentFreshness(lastRun, 0, now).stale).toBe(false);
    expect(agentFreshness(hoursAgo(2), 139, now).stale).toBe(false);
    expect(agentFreshness(null, 5, now).stale).toBe(true);
  });

  it("lê as etapas com falha do resumo auditado", () => {
    const failed = [{ step: "licensing.dispatch", code: "ERR_INVALID_ARG_TYPE" }];

    expect(cycleFailedSteps({ failedSteps: failed, documents: null })).toEqual(failed);
    // Resumos gravados antes da mudança não têm o campo.
    expect(cycleFailedSteps({ documents: { failures: 3 } })).toEqual([]);
    expect(cycleFailedSteps({ failedSteps: [{ step: 1 }] })).toEqual([]);
    expect(cycleFailedSteps(undefined)).toEqual([]);
  });

  it("busca a última execução de agente sem passar datas ao driver", async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce([{ kind: "legal_mapping", status: "pending", count: 126 }])
      .mockResolvedValueOnce([{ used: 0, lastRunAt: "2026-09-17 10:50:50.833+00" }]);

    const summary = await agentWorkSummary({ execute } as unknown as AgentDatabase);

    expect(summary.lastRunAt).toBe("2026-09-17 10:50:50.833+00");
    expect(summary.budget).toEqual({ used: 0, limit: AGENT_WORK_DAILY_LIMIT });
    const runs = new PgDialect().sqlToQuery(execute.mock.calls[1][0]);
    expect(runs.sql).toContain("max(started_at)");
    expect(runs.sql).toContain("interval '24 hours'");
    expect(runs.params).toEqual([]);
  });
});
