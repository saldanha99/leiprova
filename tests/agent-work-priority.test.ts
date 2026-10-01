import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it, vi } from "vitest";

import { claimAgentWork } from "@/lib/editorial/agent-work-queue";

describe("prioridade da fila dos agentes", () => {
  function fakeDatabase() {
    const queries: SQL[] = [];
    const transaction = {
      execute: vi.fn(async (query: SQL) => {
        queries.push(query);
        // trava, expiração de reservas, orçamento e, por fim, a reserva (fila vazia).
        return queries.length === 3 ? [{ count: 0 }] : [];
      }),
    };
    const db = { transaction: vi.fn(async (run: (tx: typeof transaction) => Promise<unknown>) => run(transaction)) };
    return { db: db as unknown as Parameters<typeof claimAgentWork>[0], queries };
  }

  it("serve primeiro os editais que ainda não vendem, pela prova mais próxima", async () => {
    const { db, queries } = fakeDatabase();

    expect(await claimAgentWork(db, new Date("2026-10-01T15:00:00Z"))).toEqual({ state: "idle" });

    const claim = new PgDialect().sqlToQuery(queries[3]);
    const order = claim.sql.slice(claim.sql.indexOf("order by"));
    // O tipo continua mandando; dentro dele, produto liberado vai para o fim.
    expect(order.indexOf("when 'legal_change' then 0")).toBeLessThan(order.indexOf("product.status = 'released'"));
    expect(order).toContain("then 1 else 0 end");
    // Prova passada ou sem data não passa à frente de uma prova marcada.
    expect(order).toContain("when opportunity.exam_date >= (now() at time zone 'America/Sao_Paulo')::date");
    expect(order).toContain(") nulls last,\n          created_at,job_key for update skip locked limit 1");
    // Payload sem edital numérico não quebra a reserva com erro de conversão.
    expect(order).toContain("work.payload->>'opportunityId' ~ '^[0-9]{1,18}$'");
    expect(claim.params.filter((param) => param instanceof Date)).toEqual([]);
  });
});
