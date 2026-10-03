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

  it("serve primeiro os editais que ainda podem vender a tempo, sem ler o payload", async () => {
    const { db, queries } = fakeDatabase();

    expect(await claimAgentWork(db, new Date("2026-10-01T15:00:00Z"))).toEqual({ state: "idle" });

    const claim = new PgDialect().sqlToQuery(queries[3]);
    // Faixa por edital calculada uma vez: com 1.300 tarefas a versão por tarefa levava 50 s.
    expect(claim.sql).toContain("with opportunity_tier as (");
    expect(claim.sql).toContain("product.status = 'released'\n          ) then 2");
    expect(claim.sql).toContain("::date + 14");
    expect(claim.sql).toContain("question.editorial_status <> 'suspended'\n            ) >= 68 then 1");
    // O requisito sai da chave da tarefa; o payload (artigos candidatos) não é lido.
    expect(claim.sql).toContain("work.job_key ~ '^(mapping|author):[0-9]{1,18}$' then split_part(work.job_key, ':', 2)::bigint");
    expect(claim.sql).not.toContain("payload->>'opportunityId'");
    expect(claim.sql).not.toContain("payload->>'requirementId'");
    // O teto é compartilhado: produto liberado espera enquanto a faixa 0 tem tarefa.
    expect(claim.sql).toContain("not (coalesce(tier.tier, 0) = 2 and (select value from unsold_waiting))");
    const order = claim.sql.slice(claim.sql.indexOf("order by"));
    expect(order).toContain("tier.tier nulls first, tier.upcoming_exam nulls last");
    expect(order).toContain("(requirement.subject_id is null) nulls last");
    expect(order).toContain("work.created_at,work.job_key for update of work skip locked limit 1");
    expect(claim.params.filter((param) => param instanceof Date)).toEqual([]);
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
