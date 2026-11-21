import { readFileSync } from "node:fs";
import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AGENT_WORK_VERSION, agentInputHash, validateAgentWorkResult, workPayloadSchema,
  type AgentWorkPayload, type WorkArticle } from "@/lib/editorial/agent-work-contract";
import { questionContractFingerprint } from "@/lib/editorial/official-question-contract";
import { claimAgentWork } from "@/lib/editorial/agent-work-queue";
import { buildThinArticlePayload, enqueueThinArticleAuthoring, parseWave0List, planThinArticleJobs,
  thinArticleCandidatesQuery, thinArticlePublicPath, type ThinArticleRow } from "@/lib/editorial/thin-article-authoring";
import { THIN_ARTICLE_JOB_KEY_SQL_PATTERN, THIN_ARTICLE_MAX_RUNNING_ENV, parseThinArticleJobKey,
  thinArticleJobKey, thinArticleMaxRunning } from "@/lib/editorial/thin-article-job";
import { parseEnqueueArgs } from "../scripts/enqueue-thin-article-authoring";
import { syntheticQuestionContract } from "./fixtures/question-contract";

const dialect = new PgDialect();
const scoped = syntheticQuestionContract();
const article = (id: number, text = "No exercício fictício, a equipe deve organizar os cartões antes da atividade."): WorkArticle => ({
  id, act: "Regra sintética", articleRef: `Art. ${id}`, versionId: 1, checksum: "b".repeat(64), text, url: "https://www.planalto.gov.br/exemplo",
});
const authorPayload: AgentWorkPayload = {
  version: AGENT_WORK_VERSION, title: "Concurso sintético", instructions: "Crie até cinco questões originais.",
  context: { requirement: "Regra sintética", sourceContextHash: "a".repeat(64), profile: scoped.profile, humanReviewRequired: true,
    mappingProposals: [{ articleId: 7, quote: "trecho do artigo 7", rationale: "x" }, { articleId: 8, quote: "trecho do artigo 8", rationale: "y" }] },
  requirementId: 42, opportunityId: 1, bank: "fgv", role: "Cargo sintético",
  sourceUrls: ["https://conhecimento.fgv.br/concursos/exemplo"],
  questionContract: scoped, questionContractId: questionContractFingerprint(scoped),
  parentKey: "mapping:42", parentHash: "c".repeat(64),
  articles: [article(7), article(8, "Em outra regra fictícia, o grupo precisa guardar os cartões depois da atividade.")],
};
const row = (overrides: Partial<ThinArticleRow> = {}): ThinArticleRow => ({
  articleId: 8, reviewed: 1, articlePath: "art-8", actSlug: "lei-sintetica", actType: "lei", actNumber: "8.112", actYear: 1990,
  linked: true, live: true, requirements: 1, forSaleRequirements: 1, requirementId: 42, authorKey: "author:42",
  candidateForSale: true, candidateCovered: true, existingKey: null, existingStatus: null, ...overrides,
});

describe("chave da autoria de artigo fino", () => {
  it("monta e lê author-thin:<requisito>:<artigo> no formato aceito pela fila", () => {
    const key = thinArticleJobKey(42, 8);
    expect(key).toBe("author-thin:42:8");
    expect(key).toMatch(/^[a-z0-9:._-]{1,220}$/u);
    expect(parseThinArticleJobKey(key)).toEqual({ requirementId: 42, articleId: 8 });
    expect(new RegExp(THIN_ARTICLE_JOB_KEY_SQL_PATTERN, "u").test(key)).toBe(true);
    for (const other of ["author:42", "mapping:42", "author-thin:42", "author-thin:42:8:1", "author-thin:x:8"]) {
      expect(parseThinArticleJobKey(other)).toBeNull();
      expect(new RegExp(THIN_ARTICLE_JOB_KEY_SQL_PATTERN, "u").test(other)).toBe(false);
    }
    expect(() => thinArticleJobKey(0, 8)).toThrow();
    expect(() => thinArticleJobKey(42, 1.5)).toThrow();
  });

  it("a vinculação ao produto lê o requisito das duas chaves de autoria", () => {
    const script = readFileSync("scripts/propose-product-bindings.ts", "utf8");
    expect(script).toContain("audit.entity_id ~ '^author:[0-9]{1,18}$' or audit.entity_id ~ ${THIN_ARTICLE_JOB_KEY_SQL_PATTERN}");
    expect(script).toContain("split_part(audit.entity_id, ':', 2)::bigint as requirement_id");
  });
});

describe("teto das tarefas de artigo fino", () => {
  afterEach(() => { delete process.env[THIN_ARTICLE_MAX_RUNNING_ENV]; });

  it("padrão 1; 0 pausa; valor inválido também pausa", () => {
    expect(thinArticleMaxRunning(undefined)).toBe(1);
    expect(thinArticleMaxRunning("")).toBe(1);
    expect(thinArticleMaxRunning("0")).toBe(0);
    expect(thinArticleMaxRunning(" 3 ")).toBe(3);
    for (const bad of ["-1", "abc", "1.5", "9", "100"]) expect(thinArticleMaxRunning(bad)).toBe(0);
  });

  function fakeDatabase() {
    const queries: SQL[] = [];
    const transaction = { execute: vi.fn(async (query: SQL) => { queries.push(query); return []; }) };
    const db = { transaction: vi.fn(async (run: (tx: typeof transaction) => Promise<unknown>) => run(transaction)) };
    return { db: db as unknown as Parameters<typeof claimAgentWork>[0], queries };
  }

  it("na reserva do Autor, artigo fino fica depois de toda a autoria normal e respeita o teto", async () => {
    const { db, queries } = fakeDatabase();
    await claimAgentWork(db, new Date(), "Autor", ["authoring"], undefined, { thinArticleMaxRunning: 2 });
    const claim = dialect.sqlToQuery(queries[2]);
    // Requisito sai das duas chaves, sem ler o payload.
    expect(claim.sql).toContain(`work.job_key ~ '^(mapping|author):[0-9]{1,18}$' or work.job_key ~ '${THIN_ARTICLE_JOB_KEY_SQL_PATTERN}'`);
    expect(claim.sql).toContain("then split_part(work.job_key, ':', 2)::bigint end");
    const selection = claim.sql.slice(claim.sql.indexOf("where work.status='pending'"), claim.sql.indexOf("order by case work.kind"));
    expect(selection).toMatch(/and \(not work\.job_key like 'author-thin:%' or \(select count\(\*\)\s+from editorial_agent_work thin_running where thin_running\.status='running'\s+and thin_running\.job_key like \$\d+\) < \$\d+\)/u);
    expect(claim.params).toContain("author-thin:%");
    expect(claim.params).toContain(2);
    const order = claim.sql.slice(claim.sql.indexOf("order by case work.kind"));
    // Ordem: tipo; artigo fino por último (entre si, na ordem do enfileiramento); depois a ordem de sempre.
    expect(order).toMatch(/else 3 end,\s+case when work\.job_key like 'author-thin:%' then 1 else 0 end,\s+case when work\.job_key like 'author-thin:%' then work\.created_at end nulls first,\s+case when work\.kind='authoring' and exists \(select 1[\s\S]+?then 0 else 1 end,\s+tier\.tier nulls first/u);
  });

  it("lê o teto do ambiente; 0 deixa a tarefa de artigo fino fora da reserva", async () => {
    process.env[THIN_ARTICLE_MAX_RUNNING_ENV] = "0";
    const { db, queries } = fakeDatabase();
    await claimAgentWork(db, new Date(), "Autor", ["authoring"]);
    const claim = dialect.sqlToQuery(queries[2]);
    const limitIndex = claim.sql.match(/thin_running\.job_key like \$\d+\) < \$(\d+)\)/u)![1];
    expect(claim.params[Number(limitIndex) - 1]).toBe(0);

    delete process.env[THIN_ARTICLE_MAX_RUNNING_ENV];
    const fallback = fakeDatabase();
    await claimAgentWork(fallback.db, new Date(), "Autor", ["authoring"]);
    const fallbackClaim = dialect.sqlToQuery(fallback.queries[2]);
    const fallbackIndex = fallbackClaim.sql.match(/thin_running\.job_key like \$\d+\) < \$(\d+)\)/u)![1];
    expect(fallbackClaim.params[Number(fallbackIndex) - 1]).toBe(1);
  });

  it("o Guardião não calcula o teto nem a ordem de artigo fino", async () => {
    const { db, queries } = fakeDatabase();
    await claimAgentWork(db, new Date(), "Guardião", ["legal_mapping"]);
    const claim = dialect.sqlToQuery(queries[2]);
    expect(claim.sql).not.toContain("thin_running");
    expect(claim.sql).not.toContain("like 'author-thin:%'");
    await expect(claimAgentWork(fakeDatabase().db, new Date(), "Autor", ["authoring"], undefined, { thinArticleMaxRunning: -1 })).rejects.toThrow();
  });
});

describe("plano das tarefas de artigo fino", () => {
  const wave = ["/lei/codigo-penal/art-121", "/lei/lei-8112-1990/art-5"];

  it("casa a URL pública da onda 0 com o artigo", () => {
    expect(thinArticlePublicPath({ slug: "codigo-penal-1940", actType: "decreto-lei", actNumber: "2.848", actYear: 1940 }, "art-121"))
      .toBe("/lei/codigo-penal/art-121");
    expect(thinArticlePublicPath({ slug: "regime-juridico", actType: "lei", actNumber: "8.112", actYear: 1990 }, "art-5")).toBe("/lei/lei-8112-1990/art-5");
    expect(thinArticlePublicPath({ slug: "sem-numero", actType: "lei", actNumber: null, actYear: null }, "art-1")).toBe("/lei/sem-numero/art-1");
    expect(parseWave0List("# cabeçalho\n\n/lei/a/art-1\r\n /lei/b/art-2 \n")).toEqual(["/lei/a/art-1", "/lei/b/art-2"]);
  });

  it("ordena onda 0, depois mais requisitos à venda, depois os demais; separa o inalcançável", () => {
    const rows = [
      row({ articleId: 1, forSaleRequirements: 0, requirements: 1, requirementId: 11, authorKey: "author:11", articlePath: "art-1", actNumber: "1.000" }),
      row({ articleId: 2, forSaleRequirements: 1, requirementId: 12, authorKey: "author:12", articlePath: "art-2", actNumber: "1.000" }),
      row({ articleId: 3, forSaleRequirements: 3, requirements: 3, requirementId: 13, authorKey: "author:13", articlePath: "art-3", actNumber: "1.000" }),
      row({ articleId: 4, forSaleRequirements: 0, requirementId: 14, authorKey: "author:14", articlePath: "art-5" }), // onda 0
      row({ articleId: 5, linked: false, requirementId: null, authorKey: null, forSaleRequirements: 0 }),
      row({ articleId: 6, requirementId: null, authorKey: null }),
      row({ articleId: 7, live: false }),
      row({ articleId: 9, reviewed: 3 }),
    ];
    const plan = planThinArticleJobs(rows, wave);
    expect(plan.jobs.map((job) => job.jobKey)).toEqual(["author-thin:14:4", "author-thin:13:3", "author-thin:12:2", "author-thin:11:1"]);
    expect(plan.jobs.map((job) => job.group)).toEqual(["wave0", "forSale", "forSale", "others"]);
    expect(plan.jobs.map((job) => job.rank)).toEqual([1, 2, 3, 4]);
    expect(plan.groups).toEqual({ wave0: 1, forSale: 2, others: 1 });
    expect(plan.unreachable).toEqual({ total: 3, notLinked: 1, noCurrentContract: 1, articleNotLive: 1 });
    expect(plan.thinArticles).toBe(7);

    const unnumbered = planThinArticleJobs([row({ actSlug: "lei-sem-numero", actNumber: null, actYear: null, articlePath: "art-1" })], []);
    expect(unnumbered.jobs[0].publicPath).toBe("/lei/lei-sem-numero/art-1");
  });

  it("artigo com 3+ revisadas ou com tarefa já criada não volta à fila", () => {
    const plan = planThinArticleJobs([
      row({ articleId: 1, reviewed: 3 }),
      row({ articleId: 2, existingKey: "author-thin:42:2", existingStatus: "prepared" }),
      row({ articleId: 3, existingKey: "author-thin:41:3", existingStatus: "pending" }),
    ], []);
    expect(plan.jobs).toEqual([]);
    expect(plan.skipped).toEqual({ alreadyQueued: 2, alreadyQueuedByStatus: { prepared: 1, pending: 1 } });
  });

  it("a consulta de candidatos só considera 1–2 revisadas, contrato vigente, mapa-pai preparado e tarefa não substituída", () => {
    const query = dialect.sqlToQuery(thinArticleCandidatesQuery());
    expect(query.sql).toMatch(/having count\(\*\) between 1 and \$\d+/u);
    expect(query.params).toContain(2);
    expect(query.sql).toContain("coalesce(length(thin_question.explanation), 0) > 0");
    expect(query.sql).toContain("sale.status = 'released'");
    expect(query.sql).toContain("from opportunity_requirement_articles coverage");
    expect(query.sql).toContain("jsonb_array_elements(author_link.payload->'articles')");
    expect(query.sql).toContain("current_scoped_contract.id=author.payload->>'questionContractId'");
    expect(query.sql).toContain("parent.input_hash = author.payload->>'parentHash' and parent.status = 'prepared'");
    expect(query.sql).toContain("author.payload->'context'->>'sourceContextHash' = encode(sha256(");
    expect(query.sql).toContain("previous.status <> 'superseded'");
    expect(query.params).toContain(THIN_ARTICLE_JOB_KEY_SQL_PATTERN);
  });
});

describe("pacote da tarefa de artigo fino", () => {
  it("é o pacote da autoria do requisito, só com o artigo fino e instruções de 2–3 inéditas", () => {
    const payload = buildThinArticlePayload(authorPayload, article(8, authorPayload.articles[1].text),
      { reviewed: 2, rank: 5, group: "forSale", existingPrompts: ["Enunciado existente A", "x".repeat(900)] });
    expect(workPayloadSchema.parse(payload)).toEqual(payload);
    expect(payload.articles.map((item) => item.id)).toEqual([8]);
    for (const field of ["version", "requirementId", "opportunityId", "bank", "role", "sourceUrls", "questionContract", "questionContractId", "parentKey", "parentHash"] as const) {
      expect(payload[field]).toEqual(authorPayload[field]);
    }
    expect(payload.context.sourceContextHash).toBe(authorPayload.context.sourceContextHash);
    expect(payload.context.profile).toEqual(authorPayload.context.profile);
    expect(payload.context.mappingProposals).toEqual([{ articleId: 8, quote: "trecho do artigo 8", rationale: "y" }]);
    expect(payload.context.thinArticle).toMatchObject({ articleId: 8, reviewedQuestions: 2, requestedQuestions: "2-3", rank: 5, group: "forSale" });
    const prompts = (payload.context.thinArticle as { existingPrompts: string[] }).existingPrompts;
    expect(prompts[0]).toBe("Enunciado existente A");
    expect(prompts[1]).toHaveLength(600);
    expect(payload.instructions).toContain("DUAS ou TRÊS");
    expect(payload.instructions).toContain("context.thinArticle.existingPrompts");
    expect(payload.instructions).toContain("questionContract.format");
    expect(agentInputHash(payload)).not.toBe(agentInputHash(authorPayload));
  });

  it("o contrato de sempre recusa questão de outro artigo do requisito", () => {
    const payload = buildThinArticlePayload(authorPayload, article(8, authorPayload.articles[1].text),
      { reviewed: 1, rank: 1, group: "forSale", existingPrompts: [] });
    const options = ["Guardar os cartões", "Rasgar os cartões", "Ignorar os cartões", "Esconder os cartões", "Vender os cartões"]
      .map((text, index) => ({ key: "ABCDE"[index], text, correct: index === 0, rationale: "Justificativa sintética do contrato." }));
    const question = (articleId: number, quote: string) => ({ prompt: "Na regra inteiramente fictícia, o que o grupo deve fazer após a atividade?",
      articleId, quote, explanation: "A regra sintética determina guardar os cartões depois da atividade.", difficulty: "easy", options });
    const base = { schemaVersion: 1, publicationAllowed: false, outcome: "prepared", summary: "Proposta.", limitations: [], evidence: [], generatorModel: "test" };
    expect(validateAgentWorkResult("authoring", payload, { ...base, questions: [question(8, authorPayload.articles[1].text)] }).questions).toHaveLength(1);
    expect(() => validateAgentWorkResult("authoring", payload, { ...base, questions: [question(7, authorPayload.articles[0].text)] })).toThrow();
  });

  it("recusa autoria sem contrato ou sem mapa-pai", () => {
    const meta = { reviewed: 1, rank: 1, group: "others" as const, existingPrompts: [] };
    expect(() => buildThinArticlePayload({ ...authorPayload, questionContractId: undefined }, article(8), meta)).toThrow();
    expect(() => buildThinArticlePayload({ ...authorPayload, parentHash: undefined }, article(8), meta)).toThrow();
  });
});

describe("enfileiramento idempotente", () => {
  function fakeDatabase(rows: ThinArticleRow[]) {
    const reads: string[] = [];
    const inserted: { key: string; hash: string }[] = [];
    const store = new Map<string, string>();
    const execute = vi.fn(async (query: SQL) => {
      const { sql: text, params } = dialect.sqlToQuery(query);
      reads.push(text);
      if (text.includes("insert into editorial_agent_work")) {
        const [key, , hash] = params as string[];
        if (store.get(key) === hash) return [];
        store.set(key, hash); inserted.push({ key, hash });
        return [{ job_key: key }];
      }
      if (text.startsWith("select payload from editorial_agent_work")) return [{ payload: authorPayload }];
      if (text.includes("from legal_articles a join legal_versions v")) return [article(params[0] as number, authorPayload.articles[1].text)];
      if (text.startsWith("select prompt from questions")) return [{ prompt: "Enunciado existente" }];
      return [];
    });
    const tx = { execute: vi.fn(async (query: SQL) => {
      const text = dialect.sqlToQuery(query).sql;
      reads.push(text);
      return text.startsWith("with thin as materialized") ? rows : [];
    }) };
    const db = { execute, transaction: vi.fn(async (run: (t: typeof tx) => Promise<unknown>) => run(tx)) };
    return { db: db as unknown as Parameters<typeof enqueueThinArticleAuthoring>[0], reads, inserted, store };
  }

  it("--dry-run só lê, em transação somente leitura, e informa contagens e as primeiras chaves", async () => {
    const fake = fakeDatabase([row({ articleId: 8 }), row({ articleId: 9, linked: false, requirementId: null, authorKey: null })]);
    const result = await enqueueThinArticleAuthoring(fake.db, { dryRun: true, wave0Paths: [] });
    expect(result).toMatchObject({ mode: "dry-run", expectedJobs: 1, enqueued: 0, groups: { wave0: 0, forSale: 1, others: 0 },
      unreachable: { total: 1, notLinked: 1 } });
    expect(result.firstJobKeys).toEqual(["author-thin:42:8 (forSale /lei/lei-8112-1990/art-8)"]);
    expect(fake.reads).toContain("set transaction read only");
    expect(fake.inserted).toEqual([]);
    expect(fake.db.execute).not.toHaveBeenCalled();
  });

  it("--apply enfileira uma tarefa por artigo; repetir não duplica nem reabre", async () => {
    const fake = fakeDatabase([row({ articleId: 8 }), row({ articleId: 10, requirementId: 43, authorKey: "author:43" })]);
    const first = await enqueueThinArticleAuthoring(fake.db, { dryRun: false, wave0Paths: [] });
    expect(first).toMatchObject({ mode: "apply", enqueued: 2, unchanged: 0, failed: [] });
    expect(fake.inserted.map((item) => item.key)).toEqual(["author-thin:42:8", "author-thin:43:10"]);
    expect(fake.reads).not.toContain("set transaction read only");

    // Mesmo payload: o upsert da fila não altera nada.
    const again = await enqueueThinArticleAuthoring(fake.db, { dryRun: false, wave0Paths: [] });
    expect(again).toMatchObject({ enqueued: 0, unchanged: 2 });

    // Na prática a consulta já devolve a tarefa existente e o artigo é pulado antes do upsert.
    const queued = fakeDatabase([row({ articleId: 8, existingKey: "author-thin:42:8", existingStatus: "prepared" })]);
    const skipped = await enqueueThinArticleAuthoring(queued.db, { dryRun: false, wave0Paths: [] });
    expect(skipped).toMatchObject({ expectedJobs: 0, enqueued: 0, skipped: { alreadyQueued: 1 } });
    expect(queued.inserted).toEqual([]);
  });

  it("--limit restringe o lote aplicado sem mudar as contagens", async () => {
    const fake = fakeDatabase([row({ articleId: 8 }), row({ articleId: 10, requirementId: 43, authorKey: "author:43" })]);
    const result = await enqueueThinArticleAuthoring(fake.db, { dryRun: false, wave0Paths: [], limit: 1 });
    expect(result).toMatchObject({ expectedJobs: 2, enqueued: 1 });
  });
});

describe("argumentos do script", () => {
  it("exige modo explícito e recusa argumentos desconhecidos", () => {
    expect(parseEnqueueArgs(["--dry-run"])).toEqual({ dryRun: true, limit: undefined, wave0File: undefined });
    expect(parseEnqueueArgs(["--", "--apply", "--limit=20", "--wave0=docs/seo/onda-0-300.txt"]))
      .toEqual({ dryRun: false, limit: 20, wave0File: "docs/seo/onda-0-300.txt" });
    expect(() => parseEnqueueArgs([])).toThrow();
    expect(() => parseEnqueueArgs(["--dry-run", "--apply"])).toThrow();
    expect(() => parseEnqueueArgs(["--apply", "--limit=0"])).toThrow();
    expect(() => parseEnqueueArgs(["--apply", "--wave0=../segredo"])).toThrow();
    expect(() => parseEnqueueArgs(["--force"])).toThrow();
  });
});
