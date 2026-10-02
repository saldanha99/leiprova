import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it, vi } from "vitest";

import { prepareAgentWork } from "@/lib/editorial/agent-work-preparation";
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
    expect(order).toContain("product.status = 'released'\n      ) then 2");
    // Prova a menos de 14 dias ou 68 questões já ligadas cedem a vez aos demais.
    expect(order).toContain("::date + 14");
    expect(order).toContain("question.editorial_status <> 'suspended'\n        ) >= 68 then 1");
    expect(order).toContain("else 0 end");
    // Prova passada ou sem data não passa à frente de uma prova marcada.
    expect(order).toContain("when opportunity.exam_date >= (now() at time zone 'America/Sao_Paulo')::date");
    expect(order).toContain(") nulls last,\n          created_at,job_key for update skip locked limit 1");
    // Payload sem edital numérico não quebra a reserva com erro de conversão.
    expect(order).toContain("work.payload->>'opportunityId' ~ '^[0-9]{1,18}$'");
    expect(claim.params.filter((param) => param instanceof Date)).toEqual([]);
    // O teto é compartilhado: produto liberado espera enquanto a faixa 0 tem tarefa.
    const filter = claim.sql.slice(claim.sql.indexOf("select job_key from editorial_agent_work work"), claim.sql.indexOf("order by"));
    expect(filter).toContain("not (\n    coalesce(");
    expect(filter).toContain(", 0) = 2\n    and exists (\n      select 1 from editorial_agent_work other");
    expect(filter).toContain("other.payload->>'opportunityId'");
  });

  it("encerra, antes de cada ciclo, tarefas de requisito retirado ou suspenso", async () => {
    const queries: SQL[] = [];
    const db = { execute: vi.fn(async (query: SQL) => { queries.push(query); return []; }) };
    await prepareAgentWork(db as unknown as Parameters<typeof prepareAgentWork>[0], new Date(), { followupsOnly: true });
    // A confirmação leve da ponte não faz a varredura.
    expect(queries).toHaveLength(1);

    queries.length = 0;
    await prepareAgentWork(db as unknown as Parameters<typeof prepareAgentWork>[0], new Date()).catch(() => undefined);
    const withdrawn = new PgDialect().sqlToQuery(queries[0]);
    expect(withdrawn.sql).toContain("set status='superseded',last_error_code='requirement_withdrawn'");
    expect(withdrawn.sql).toContain("work.status='pending' and work.kind in ('legal_mapping','authoring')");
    expect(withdrawn.sql).toContain("requirement.editorial_status in ('draft','pending_review','reviewed')");
  });
});
