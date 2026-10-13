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
        // trava, expiração e reserva; a contagem diária não limita o trabalho.
        return [];
      }),
    };
    const db = { transaction: vi.fn(async (run: (tx: typeof transaction) => Promise<unknown>) => run(transaction)) };
    return { db: db as unknown as Parameters<typeof claimAgentWork>[0], queries };
  }

  it("serve primeiro os editais que ainda podem vender a tempo, sem ler o payload", async () => {
    const { db, queries } = fakeDatabase();

    expect(await claimAgentWork(db, new Date("2026-10-01T15:00:00Z"))).toEqual({ state: "idle" });

    const claim = new PgDialect().sqlToQuery(queries[2]);
    // Faixa por edital calculada uma vez: com 1.300 tarefas a versão por tarefa levava 50 s.
    expect(claim.sql).toContain("with product_content as materialized (");
    expect(claim.sql).toContain("opportunity_tier as materialized (");
    expect(claim.sql).toContain("coalesce(content.has_released_product, false)");
    expect(claim.sql).toContain("and not coalesce(content.has_draft_product, false) then 2");
    expect(claim.sql).toContain("::date + 14");
    expect(claim.sql).toMatch(/coalesce\(content.minimum_valid_question_count, 0\) >= \$\d+ then 1/u);
    expect(claim.params).toContain(68);
    expect(claim.sql).toContain("min(valid_question_count)");
    expect(claim.sql).toContain("count(distinct content_binding.question_id)");
    expect(claim.sql).toContain("content_binding.product_slug = priority_product.slug");
    expect(claim.sql).toContain("verified_product_binding.product_slug = priority_product.slug");
    expect(claim.sql).toContain("verified_product_binding.opportunity_id = priority_product.opportunity_id");
    expect(claim.sql).toContain("verified_product_question.editorial_status = 'reviewed'");
    expect(claim.sql).toContain("verified_product_requirement.editorial_status = 'reviewed'");
    expect(claim.sql).toContain("verified_product_source.status = 'approved'");
    expect(claim.sql).toContain("verified_product_version.status = 'current'");
    expect(claim.sql).not.toContain("from question_opportunities link");
    expect(claim.sql).not.toContain("question.editorial_status <> 'suspended'");
    // O requisito sai da chave da tarefa; o payload (artigos candidatos) não é lido.
    expect(claim.sql).toContain("work.job_key ~ '^(mapping|author):[0-9]{1,18}$' then split_part(work.job_key, ':', 2)::bigint");
    expect(claim.sql).not.toContain("payload->>'opportunityId'");
    expect(claim.sql).not.toContain("payload->>'requirementId'");
    // Pendências de outro papel não deixam o agente ocioso.
    expect(claim.sql).not.toContain("unsold_waiting");
    expect(queries).toHaveLength(3);
    const order = claim.sql.slice(claim.sql.indexOf("order by"));
    expect(order).toMatch(/case when work\.kind='legal_mapping'[\s\S]+?then 0 else 1 end,\s+tier\.tier nulls first,\s+tier\.upcoming_exam nulls last/u);
    expect(order).toContain("(requirement.subject_id is null) nulls last");
    expect(order).toContain("work.created_at,work.job_key for update of work skip locked limit 1");
    expect(claim.params.filter((param) => param instanceof Date)).toEqual([]);
  });

  it("materializa o contrato vigente por oportunidade e usa prontidão somente na ordenação de mapeamentos", async () => {
    const { db, queries } = fakeDatabase();
    await claimAgentWork(db, new Date(), "Guardião");
    const claim = new PgDialect().sqlToQuery(queries[2]);
    const readiness = claim.sql.slice(claim.sql.indexOf("mapping_contract_readiness as materialized ("), claim.sql.indexOf("select work.job_key"));
    expect(readiness).toContain("from contest_opportunities mapping_opportunity");
    expect(readiness).toContain("mapping_contract.opportunity_id = mapping_opportunity.id");
    expect(readiness).toContain("current_scoped_contract.id=mapping_contract.id");
    expect(readiness).toContain("current_scoped_contract.opportunity_id=mapping_opportunity.id");
    expect(readiness).toContain("current_scoped_contract.status='approved'");
    expect(readiness).toContain("current_scoped_contract.scope='single_role'");
    expect(readiness).toContain("contract_current_snapshot.checksum_sha256=current_scoped_contract.source_snapshot_checksum");
    expect(readiness).not.toContain("requirement.");
    expect(claim.sql.match(/mapping_contract_readiness as materialized/gu)).toHaveLength(1);

    const selection = claim.sql.slice(claim.sql.indexOf("where work.status='pending'"), claim.sql.indexOf("order by case work.kind"));
    expect(selection).not.toContain("mapping_readiness");
    const order = claim.sql.slice(claim.sql.indexOf("order by case work.kind"));
    expect(order).toContain("when 'legal_change' then 0 when 'authoring' then 1 when 'discovery' then 2 else 3 end");
    expect(order).toMatch(/coalesce\(mapping_readiness.has_current_contract, false\)[\s\S]+requirement\.subject_id is not null then 0 else 1 end,\s+tier\.tier nulls first,[\s\S]+tier\.upcoming_exam nulls last/u);
    expect(order).toContain("for update of work skip locked limit 1");
  });

  it.each(["Autor", "Radar"])("preserva o despacho de %s sem calcular prontidão dos mapeamentos", async (agent) => {
    const { db, queries } = fakeDatabase();
    await claimAgentWork(db, new Date(), agent);
    const claim = new PgDialect().sqlToQuery(queries[2]);
    expect(claim.sql).not.toContain("mapping_contract_readiness");
    expect(claim.sql).toContain("tier.tier nulls first, tier.upcoming_exam nulls last");
    expect(claim.sql).toContain("(requirement.subject_id is null) nulls last");
    expect(claim.params).toContain(agent === "Autor" ? "authoring" : "discovery");
    expect(claim.params).not.toContain("legal_mapping");
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
