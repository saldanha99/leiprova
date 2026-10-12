import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it, vi } from "vitest";

import { AGENT_PREPARATION_ALGORITHM_PROFILE_HASH, prepareAgentWork, preparationBatchSize } from "@/lib/editorial/agent-work-preparation";
import { enqueueAgentWork, type AgentDatabase } from "@/lib/editorial/agent-work-queue";
import { AGENT_WORK_VERSION, type AgentWorkPayload } from "@/lib/editorial/agent-work-contract";

function databaseWithBatch(size: number) {
  const dialect = new PgDialect();
  const queued: AgentWorkPayload[] = [];
  const cache: Record<string, unknown>[] = [];
  let corpusReads = 0, retrievals = 0, sourceReads = 0;
  const execute = vi.fn(async (fragment: SQL) => {
    const query = dialect.sqlToQuery(fragment);
    if (query.sql.includes("jsonb_agg(jsonb_build_array(a.id")) { corpusReads++; return [{ hash: "a".repeat(64) }]; }
    if (query.sql.includes("eligible as materialized")) return Array.from({ length: size }, (_, index) => ({
      id: index + 1, opportunityId: 1, text: "Disciplina sintética de propriedade e obrigações.", locator: "Página sintética1", title: "Edital sintético",
      role: "Cargo sintético", year: 2026, jurisdiction: "BR", bank: "fgv", documentUrl: "https://conhecimento.fgv.br/concursos/sintetico",
      checksum: "b".repeat(64), verifiedOn: "2026-10-12", sourceContextHash: "c".repeat(64),
    }));
    if (query.sql.includes("to_tsvector('portuguese'")) { retrievals++; return []; }
    if (query.sql.includes("select encode(sha256") && query.sql.includes("where r.id=")) sourceReads++;
    if (query.sql.includes("insert into editorial_agent_work")) {
      const input = query.params.find((param) => typeof param === "string" && param.startsWith("{\"version\""));
      queued.push(JSON.parse(String(input))); return [{ job_key: query.params[0] }];
    }
    if (query.sql.includes("insert into audit_logs")) {
      const metadata = query.params.find((param) => typeof param === "string" && param.startsWith("{\"sourceContextHash\""));
      cache.push(JSON.parse(String(metadata)));
      expect(query.sql).toContain("work.status<>'running'");
    }
    return [];
  });
  return { db: { execute } as unknown as AgentDatabase, queued, cache, reads: () => ({ corpusReads, retrievals, sourceReads }) };
}

describe("bounded agent preparation", () => {
  it("processes100 only and truthfully exposes the101st candidate as hasMore", async () => {
    const fake = databaseWithBatch(101);
    const result = await prepareAgentWork(fake.db);
    expect(result).toMatchObject({ mappingExamined: 100, mappingHasMore: true, hasMore: true, mappings: 100 });
    expect(fake.queued).toHaveLength(100);
    expect(fake.reads()).toEqual({ corpusReads: 1, retrievals: 100, sourceReads: 0 });
  });
  it("does not retrieve contexts/articles for an unchanged selected cache", async () => {
    const fake = databaseWithBatch(0);
    expect(await prepareAgentWork(fake.db)).toMatchObject({ mappings: 0, mappingExamined: 0, hasMore: false });
    expect(fake.reads()).toEqual({ corpusReads: 1, retrievals: 0, sourceReads: 0 });
  });
  it("records cache independently without changing the mapping contract/hash payload", async () => {
    const fake = databaseWithBatch(1);
    await prepareAgentWork(fake.db);
    expect(fake.cache[0]).toMatchObject({ corpusHash: "a".repeat(64), sourceContextHash: "c".repeat(64), algorithmProfileHash: AGENT_PREPARATION_ALGORITHM_PROFILE_HASH, policy: "retrieval_cache_only", publicationAllowed: false });
    expect(fake.queued[0].context).not.toHaveProperty("corpusHash");
    expect(fake.queued[0].context).not.toHaveProperty("algorithmProfileHash");
  });
  it("protects running jobs at the atomic upsert instead of invalidating their leases", async () => {
    let queryText = "";
    const db = { execute: vi.fn(async (query: SQL) => { queryText = new PgDialect().sqlToQuery(query).sql; return []; }) } as unknown as AgentDatabase;
    const payload: AgentWorkPayload = { version: AGENT_WORK_VERSION, title: "Descoberta sintética", instructions: "Somente teste.", context: {}, articles: [], sourceUrls: ["https://conhecimento.fgv.br/concursos/sintetico"] };
    expect(await enqueueAgentWork(db, "discovery:synthetic", "discovery", payload)).toBe(false);
    expect(queryText).toContain("and editorial_agent_work.status <> 'running'");
  });
  it("keeps the batch upper bound without extending any agent quota", () => {
    expect(preparationBatchSize()).toBe(100);
    expect(() => preparationBatchSize(101)).toThrow();
    expect(() => preparationBatchSize(0)).toThrow();
  });
});
