import { randomUUID } from "node:crypto";

import { and, eq, inArray, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { sourceBundle as sourceTemplate, cebraspeBatch as batchTemplate } from "./fixtures/local-authoring";
import * as schema from "@/lib/db/schema";
import { importFingerprint, localQuestionUuid, parseLocalImport } from "@/lib/editorial/local-import-plan";
import { reviewImportedPackage } from "@/lib/editorial/package-review-service";
import { importLocalDrafts } from "@/lib/editorial/local-import-service";
import { requireLocalImportTarget } from "@/lib/editorial/local-import-target";
import { lockApprovalScope } from "@/lib/editorial/approval-lock";
import { originalStyleConditions } from "@/lib/quiz/original-style-query";

// Somente fixtures fictícias em loopback. Não usa DATABASE_URL nem importa as 160 questões jurídicas reais.
const testUrl = process.env.LEIPROVA_TEST_DATABASE_URL;
if (testUrl) requireLocalImportTarget(testUrl);
const runtimeUrl = process.env.LEIPROVA_TEST_IMPORT_RUNTIME_URL;
if (runtimeUrl) requireLocalImportTarget(runtimeUrl);
const client = testUrl ? postgres(testUrl, { max: 4, prepare: false }) : null;
const db = client ? drizzle(client, { schema }) : null;
const database = () => { if (!db) throw new Error("Banco de QA não configurado."); return db; };
const now = new Date("2026-09-05T12:00:00Z");

async function fixture() {
  const tag = randomUUID();
  const [operator] = await database().insert(schema.users).values({
    publicId: randomUUID(), name: "Operador fictício do importador", email: `import-${tag}@example.invalid`,
    passwordHash: "not-a-password", role: "editor",
  }).returning();
  const [subject] = await database().insert(schema.quizSubjects).values({
    slug: `teste-import-${tag}`, name: "Matéria fictícia exclusiva da fixture", shortName: "QA",
  }).returning();
  const [topic] = await database().insert(schema.quizTopics).values({
    subjectId: subject.id, slug: "topico-ficticio", name: "Tópico fictício exclusivo da fixture",
  }).returning();
  const [bank] = await database().select().from(schema.quizBanks).where(eq(schema.quizBanks.slug, "cebraspe"));
  if (!topic || !bank) throw new Error("O banco fictício precisa do catálogo seed.");
  const sources = {
    ...structuredClone(sourceTemplate), id: `teste-import-${tag}`, title: "Fonte inteiramente fictícia de QA — sem validade jurídica",
    articleContext: "Contexto sintético para exercitar o importador de rascunhos, sem qualquer validade jurídica.",
    scope: "Somente teste de software com dados inventados. A URL permitida serve para testar o contrato, não comprova fonte real.",
    sources: [
      { id: "teste-i", articleRef: "Dispositivo fictício I", text: "I - No cenário inventado de treinamento, o cartão azul será guardado na gaveta." },
      { id: "teste-ii", articleRef: "Dispositivo fictício II", text: "II - No cenário inventado de treinamento, o círculo amarelo ficará sobre a mesa." },
    ],
  };
  const batch = {
    ...structuredClone(batchTemplate), batchId: `${sources.id}-cebraspe`,
    questions: batchTemplate.questions.slice(0, 2).map((template, index) => ({
      ...structuredClone(template), id: `${sources.sources[index].id}-cebraspe-v1`, sourceId: sources.sources[index].id,
      prompt: `Exercício sintético ${Array.from({ length: 8 }, () => randomUUID()).join(" ")}: ${index ? "o círculo amarelo ficará sobre a mesa" : "o cartão azul ficará no chão"}.`,
      supportingQuote: sources.sources[index].text,
      explanation: index ? "No cenário fictício, a regra coloca o círculo amarelo sobre a mesa. O enunciado corresponde à regra." : "No cenário fictício, a regra coloca o cartão azul na gaveta, e não no chão. O enunciado contraria a regra.",
      learningObjective: "Exercitar o contrato com um exemplo fictício, sem conteúdo jurídico.",
      options: template.options.map((option) => ({ ...option, rationale: "Justificativa inteiramente fictícia para teste do armazenamento e da integridade do lote." })),
    })),
  };
  const [act] = await database().insert(schema.legalActs).values({
    slug: `teste-import-${tag}`, title: sources.title, shortTitle: "Fixture sem validade", actType: "lei",
    officialUrl: sources.officialUrl,
  }).returning();
  const checksum = importFingerprint([tag, sources.sources]);
  const [version] = await database().insert(schema.legalVersions).values({
    legalActId: act.id, sourceUrl: sources.officialUrl, checksumSha256: checksum, verifiedAt: now, status: "current",
  }).returning();
  const articles = await database().insert(schema.legalArticles).values(sources.sources.map((source, index) => ({
    legalVersionId: version.id, articleRef: source.articleRef, articleOrder: index + 1,
    path: `teste/${index + 1}`, literalText: source.text, editorialStatus: "reviewed", sourceRights: "official_text",
  }))).returning();
  const mapping = { schemaVersion: 1, sourceBundleId: sources.id, bindings: sources.sources.map((source, index) => ({
    sourceId: source.id, legalArticleId: articles[index].id, legalVersionId: version.id, versionChecksum: checksum,
    subjectId: topic.subjectId, topicId: topic.id,
  })) };
  const request = { sources, batches: [batch], mapping, actorPublicId: operator.publicId };
  const publicIds = batch.questions.map((question) => localQuestionUuid(sources.id, question.id));
  return { request, publicIds, operator, topic, bank, version, articles };
}

const rowsFor = (ids: string[]) => database().select().from(schema.questions).where(inArray(schema.questions.publicId, ids));

async function reviewFixture() {
  const f = await fixture();
  const plan = parseLocalImport(f.request.sources, f.request.batches, f.request.mapping);
  const authorization = { schemaVersion: 1, sourceBundleId: plan.sources.id, actorPublicId: f.operator.publicId,
    sourcesSha256: plan.validation.sourcesSha256, mappingSha256: importFingerprint(plan.mapping), banks: plan.validation.banks.map(({ bank, sha256 }) => ({ bank, sha256 })),
    humanReviewConfirmed: true, cleanRoomAttested: true, reference: `qa-ficticio-${f.operator.publicId}`,
    notes: "Declaração fictícia exclusiva de QA, sem aprovação de conteúdo jurídico real." };
  const preview = await importLocalDrafts(database(), { ...f.request, mode: "preview" });
  await importLocalDrafts(database(), { ...f.request, mode: "apply", expectedFingerprint: preview.fingerprint });
  return { ...f, reviewRequest: { ...f.request, authorization } };
}

describe.skipIf(!testUrl)("importação local — PostgreSQL real com dados sintéticos", () => {
  beforeAll(async () => {
    const [row] = await database().execute<{ name: string }>(sql`select current_database() as name`);
    expect(row.name).toBe("leiprova_automation_test");
  });
  afterAll(async () => { await client?.end(); });

  it("aprovação específica simula sem alterar e libera somente os rascunhos confirmados, com reexecução segura", async () => {
    const f = await reviewFixture();
    const other = await reviewFixture();
    const before = await rowsFor(f.publicIds);
    const preview = await reviewImportedPackage(database(), { ...f.reviewRequest, mode: "preview" });
    expect(preview).toMatchObject({ approved: 0, wouldApprove: 2, publicationAllowed: false });
    expect(await rowsFor(f.publicIds)).toEqual(before);
    const result = await reviewImportedPackage(database(), { ...f.reviewRequest, mode: "apply", expectedFingerprint: preview.fingerprint });
    expect(result).toMatchObject({ approved: 2, reused: 0 });
    const after = await rowsFor(f.publicIds);
    expect(after.every((q) => q.editorialStatus === "reviewed" && q.createdByUserId === f.operator.id && q.reviewedByUserId === f.operator.id && q.cleanRoomAttestedAt && q.submittedAt)).toBe(true);
    expect((await rowsFor(other.publicIds)).every((q) => q.editorialStatus === "draft")).toBe(true);
    const repeated = await reviewImportedPackage(database(), { ...f.reviewRequest, mode: "apply", expectedFingerprint: preview.fingerprint });
    expect(repeated).toMatchObject({ approved: 0, reused: 2 });
    expect(await rowsFor(f.publicIds)).toEqual(after);
    const audit = await database().select().from(schema.auditLogs).where(inArray(schema.auditLogs.entityId, f.publicIds));
    expect(audit).toHaveLength(6);
  });

  it("exige ambas as declarações e hashes de todos os itens/fontes, sem aprovar por autorização genérica", async () => {
    const f = await reviewFixture();
    for (const change of [{ humanReviewConfirmed: false }, { cleanRoomAttested: false }, { sourcesSha256: "a".repeat(64) }, { mappingSha256: "c".repeat(64) }, { banks: [] }, { banks: [{ bank: "cebraspe", sha256: "b".repeat(64) }] }]) {
      await expect(reviewImportedPackage(database(), { ...f.reviewRequest, authorization: { ...f.reviewRequest.authorization, ...change }, mode: "preview" })).rejects.toThrow();
    }
    expect((await rowsFor(f.publicIds)).every((q) => q.editorialStatus === "draft")).toBe(true);
    await expect(reviewImportedPackage(database(), { ...f.reviewRequest, mode: "apply" })).rejects.toThrow("simulação");
  });

  it("recusa alteração do dossiê ou da fonte após a conferência, preservando todo o lote", async () => {
    const f = await reviewFixture();
    const p = await reviewImportedPackage(database(), { ...f.reviewRequest, mode: "preview" });
    await database().update(schema.questions).set({ explanation: "Alteração posterior de teste que invalida a conferência anterior." }).where(eq(schema.questions.publicId, f.publicIds[1]));
    await expect(reviewImportedPackage(database(), { ...f.reviewRequest, mode: "apply", expectedFingerprint: p.fingerprint })).rejects.toThrow("Conflito");
    expect((await rowsFor(f.publicIds)).every((q) => q.editorialStatus === "draft")).toBe(true);
    const g = await reviewFixture();
    const gp = await reviewImportedPackage(database(), { ...g.reviewRequest, mode: "preview" });
    await database().update(schema.legalVersions).set({ status: "superseded" }).where(eq(schema.legalVersions.id, g.version.id));
    await expect(reviewImportedPackage(database(), { ...g.reviewRequest, mode: "apply", expectedFingerprint: gp.fingerprint })).rejects.toThrow("vigente");
  });

  it("não assume pendência de outro fluxo e bloqueia papel revogado", async () => {
    const f = await reviewFixture();
    const p = await reviewImportedPackage(database(), { ...f.reviewRequest, mode: "preview" });
    await database().update(schema.questions).set({ editorialStatus: "pending_review", createdByUserId: f.operator.id, cleanRoomAttestedAt: now, submittedAt: now }).where(eq(schema.questions.publicId, f.publicIds[1]));
    await expect(reviewImportedPackage(database(), { ...f.reviewRequest, mode: "apply", expectedFingerprint: p.fingerprint })).rejects.toThrow("outro fluxo");
    expect((await rowsFor([f.publicIds[0]]))[0].editorialStatus).toBe("draft");
    await database().update(schema.users).set({ role: "student" }).where(eq(schema.users.id, f.operator.id));
    await expect(reviewImportedPackage(database(), { ...f.reviewRequest, mode: "preview" })).rejects.toThrow("sem papel");
  });

  it("duas liberações concorrentes não duplicam decisões", async () => {
    const f = await reviewFixture(); const p = await reviewImportedPackage(database(), { ...f.reviewRequest, mode: "preview" });
    const results = await Promise.all([1, 2].map(() => reviewImportedPackage(database(), { ...f.reviewRequest, mode: "apply", expectedFingerprint: p.fingerprint })));
    expect(results.map((result) => result.approved).sort()).toEqual([0, 2]);
  });

  it.skipIf(!runtimeUrl)("importa e aprova fixtures com papel restrito da aplicação, sem privilégio de administrador de banco", async () => {
    const f = await reviewFixture();
    const connection = postgres(runtimeUrl!, { max: 1, prepare: false });
    try {
      const runtimeDb = drizzle(connection, { schema });
      const p = await reviewImportedPackage(runtimeDb, { ...f.reviewRequest, mode: "preview" });
      const result = await reviewImportedPackage(runtimeDb, { ...f.reviewRequest, mode: "apply", expectedFingerprint: p.fingerprint });
      expect(result.approved).toBe(2);
    } finally { await connection.end(); }
  });

  it("simula sem escrita e importa questões/opções/proveniência como rascunhos invisíveis ao aluno", async () => {
    const f = await fixture();
    const preview = await importLocalDrafts(database(), { ...f.request, mode: "preview" });
    expect(preview).toMatchObject({ created: 0, wouldCreate: 2, reused: 0, publicationAllowed: false });
    expect(await rowsFor(f.publicIds)).toHaveLength(0);
    expect(await database().select().from(schema.auditLogs).where(inArray(schema.auditLogs.entityId, f.publicIds))).toHaveLength(0);
    const applied = await importLocalDrafts(database(), { ...f.request, mode: "apply", expectedFingerprint: preview.fingerprint });
    expect(applied.created).toBe(2);
    const questions = await rowsFor(f.publicIds);
    expect(questions).toHaveLength(2);
    for (const question of questions) {
      expect(question.editorialStatus).toBe("draft");
      expect(question.createdByUserId).toBeNull();
      expect(question.reviewedByUserId).toBeNull();
      expect(question.cleanRoomAttestedAt).toBeNull();
      expect(question.submittedAt).toBeNull();
      const options = await database().select().from(schema.questionOptions).where(eq(schema.questionOptions.questionId, question.id));
      expect(options).toHaveLength(2);
      expect(options.filter((option) => option.isCorrect)).toHaveLength(1);
    }
    const audit = await database().select().from(schema.auditLogs).where(inArray(schema.auditLogs.entityId, f.publicIds));
    expect(audit).toHaveLength(2);
    expect(audit[0].actorUserId).toBe(f.operator.id);
    expect(audit[0].metadata.supportingQuote).toBeTruthy();
    expect(await database().select().from(schema.questions)
      .innerJoin(schema.legalArticles, eq(schema.questions.legalArticleId, schema.legalArticles.id))
      .innerJoin(schema.legalVersions, eq(schema.legalArticles.legalVersionId, schema.legalVersions.id))
      .innerJoin(schema.legalActs, eq(schema.legalVersions.legalActId, schema.legalActs.id))
      .where(and(inArray(schema.questions.publicId, f.publicIds), originalStyleConditions({ bankId: f.bank.id }, null)))).toHaveLength(0);
  });

  it("reexecuta o pacote sem duplicar questões, opções ou auditoria", async () => {
    const f = await fixture();
    const p = await importLocalDrafts(database(), { ...f.request, mode: "preview" });
    await importLocalDrafts(database(), { ...f.request, mode: "apply", expectedFingerprint: p.fingerprint });
    const repeated = await importLocalDrafts(database(), { ...f.request, mode: "apply", expectedFingerprint: p.fingerprint });
    expect(repeated).toMatchObject({ created: 0, reused: 2 });
    expect(await rowsFor(f.publicIds)).toHaveLength(2);
    expect(await database().select().from(schema.auditLogs).where(inArray(schema.auditLogs.entityId, f.publicIds))).toHaveLength(2);
  });

  it("serializa duas importações concorrentes do mesmo pacote", async () => {
    const f = await fixture();
    const p = await importLocalDrafts(database(), { ...f.request, mode: "preview" });
    const results = await Promise.all([1, 2].map(() => importLocalDrafts(database(), { ...f.request, mode: "apply", expectedFingerprint: p.fingerprint })));
    expect(results.map((result) => result.created).sort()).toEqual([0, 2]);
    expect(await rowsFor(f.publicIds)).toHaveLength(2);
  });

  it("bloqueia alteração posterior à simulação e fonte revogada sem gravar", async () => {
    const f = await fixture();
    const p = await importLocalDrafts(database(), { ...f.request, mode: "preview" });
    f.request.batches[0].questions[0].explanation += " Mudança posterior.";
    await expect(importLocalDrafts(database(), { ...f.request, mode: "apply", expectedFingerprint: p.fingerprint })).rejects.toThrow("mudou depois");
    expect(await rowsFor(f.publicIds)).toHaveLength(0);
    await database().update(schema.legalVersions).set({ status: "revoked" }).where(eq(schema.legalVersions.id, f.version.id));
    await expect(importLocalDrafts(database(), { ...f.request, mode: "preview" })).rejects.toThrow("vigente e revisado");
  });

  it("não sobrescreve item editado nem promove uma versão alterada", async () => {
    const f = await fixture();
    const p = await importLocalDrafts(database(), { ...f.request, mode: "preview" });
    await importLocalDrafts(database(), { ...f.request, mode: "apply", expectedFingerprint: p.fingerprint });
    await database().update(schema.questions).set({ explanation: "Alteração editorial local que deve ser preservada pelo importador." }).where(eq(schema.questions.publicId, f.publicIds[0]));
    await expect(importLocalDrafts(database(), { ...f.request, mode: "apply", expectedFingerprint: p.fingerprint })).rejects.toThrow("Conflito de identidade");
    expect((await rowsFor([f.publicIds[0]]))[0].explanation).toContain("deve ser preservada");
  });

  it("desfaz a primeira inserção se o segundo item colidir, preservando o registro existente", async () => {
    const f = await fixture();
    const p = await importLocalDrafts(database(), { ...f.request, mode: "preview" });
    await database().insert(schema.questions).values({
      publicId: f.publicIds[1], legalArticleId: f.articles[1].id, quizMode: "dry_law", type: "true_false",
      prompt: `Registro fictício anterior e independente ${randomUUID()}`, explanation: "Registro fictício anterior que não deve ser sobrescrito.",
      topic: "QA", verifiedAt: now, editorialStatus: "draft",
    });
    await expect(importLocalDrafts(database(), { ...f.request, mode: "apply", expectedFingerprint: p.fingerprint })).rejects.toThrow("Conflito de identidade");
    expect(await rowsFor([f.publicIds[0]])).toHaveLength(0);
    expect((await rowsFor([f.publicIds[1]]))[0].quizMode).toBe("dry_law");
    expect(await database().select().from(schema.auditLogs).where(inArray(schema.auditLogs.entityId, f.publicIds))).toHaveLength(0);
  });

  it("detecta cópia em outra identidade e impede importação por aluno", async () => {
    const f = await fixture();
    await database().insert(schema.questions).values({
      publicId: randomUUID(), legalArticleId: f.articles[0].id, quizMode: "dry_law", type: "true_false",
      prompt: f.request.batches[0].questions[0].prompt, explanation: "Outro registro sintético com o mesmo enunciado para testar duplicidade.",
      topic: "QA", verifiedAt: now, editorialStatus: "draft",
    });
    await expect(importLocalDrafts(database(), { ...f.request, mode: "preview" })).rejects.toThrow("muito semelhante");
    await database().update(schema.users).set({ role: "student" }).where(eq(schema.users.id, f.operator.id));
    await expect(importLocalDrafts(database(), { ...f.request, mode: "preview" })).rejects.toThrow("sem papel autorizado");
  });

  it("exige a impressão da simulação antes de permitir aplicação", async () => {
    const f = await fixture();
    await expect(importLocalDrafts(database(), { ...f.request, mode: "apply" })).rejects.toThrow("simulação");
    expect(await rowsFor(f.publicIds)).toHaveLength(0);
  });

  it("inclui questões licenciadas na checagem e desfaz uma tentativa após nova cópia no acervo", async () => {
    const f = await fixture();
    const p = await importLocalDrafts(database(), { ...f.request, mode: "preview" });
    const [career] = await database().select().from(schema.quizCareerTracks).limit(1);
    const [edition] = await database().insert(schema.examEditions).values({
      publicId: randomUUID(), careerTrackId: career.id, bankId: f.bank.id,
      title: "Prova licenciada inteiramente fictícia de QA", examDate: "2026-01-01",
    }).returning();
    await database().insert(schema.questions).values({
      publicId: randomUUID(), subjectId: f.topic.subjectId, examEditionId: edition.id, quizMode: "previous_exam",
      type: "true_false", prompt: f.request.batches[0].questions[1].prompt, explanation: "Item licenciado inventado exclusivamente para teste de software.",
      topic: "QA", verifiedAt: now, sourceRights: "licensed", sourceTitle: "Fixture de licença, sem material real",
      sourceUrl: "https://example.invalid/qa", sourceRightsHolder: "Titular fictício", licenseBasis: "Licença fictícia de teste",
      licenseReference: "QA-local", licensedAt: now, originalQuestionNumber: "1", originalQuestionOrder: 1,
    });
    await expect(importLocalDrafts(database(), { ...f.request, mode: "preview" })).rejects.toThrow("muito semelhante");
    await expect(importLocalDrafts(database(), { ...f.request, mode: "apply", expectedFingerprint: p.fingerprint })).rejects.toThrow("muito semelhante");
    expect(await rowsFor(f.publicIds)).toHaveLength(0);
    expect(await database().select().from(schema.auditLogs).where(inArray(schema.auditLogs.entityId, f.publicIds))).toHaveLength(0);
  });

  it("protege matéria e tópico contra desativação enquanto o contexto está reservado", async () => {
    const f = await fixture();
    const p = await importLocalDrafts(database(), { ...f.request, mode: "preview" });
    await importLocalDrafts(database(), { ...f.request, mode: "apply", expectedFingerprint: p.fingerprint });
    const questions = await rowsFor(f.publicIds);
    await database().transaction(async (transaction) => {
      await lockApprovalScope(transaction, { questionIds: questions.map((question) => question.id), legalArticleIds: [], styleBankIds: [] });
      for (const kind of ["topic", "subject"] as const) {
        await expect(database().transaction(async (writer) => {
          await writer.execute(sql`set local lock_timeout = '100ms'`);
          if (kind === "topic") await writer.update(schema.quizTopics).set({ isActive: false }).where(eq(schema.quizTopics.id, f.topic.id));
          else await writer.update(schema.quizSubjects).set({ isActive: false }).where(eq(schema.quizSubjects.id, f.topic.subjectId));
        })).rejects.toMatchObject({ cause: { code: "55P03" } });
      }
    });
    expect((await database().select().from(schema.quizTopics).where(eq(schema.quizTopics.id, f.topic.id)))[0].isActive).toBe(true);
    expect((await database().select().from(schema.quizSubjects).where(eq(schema.quizSubjects.id, f.topic.subjectId)))[0].isActive).toBe(true);
  });

  it("reexecução não altera um estado editorial posterior simulado", async () => {
    const f = await fixture();
    const p = await importLocalDrafts(database(), { ...f.request, mode: "preview" });
    await importLocalDrafts(database(), { ...f.request, mode: "apply", expectedFingerprint: p.fingerprint });
    // Apenas fixture: simula a passagem pelo fluxo humano para testar que o importador não a sobrescreve.
    await database().update(schema.questions).set({ editorialStatus: "pending_review", createdByUserId: f.operator.id,
      cleanRoomAttestedAt: now, submittedAt: now }).where(eq(schema.questions.publicId, f.publicIds[0]));
    const before = (await rowsFor([f.publicIds[0]]))[0];
    const result = await importLocalDrafts(database(), { ...f.request, mode: "apply", expectedFingerprint: p.fingerprint });
    expect(result).toMatchObject({ created: 0, reused: 2 });
    expect((await rowsFor([f.publicIds[0]]))[0]).toEqual(before);
  });

  it.skipIf(!runtimeUrl)("funciona com papel restrito sem conceder UPDATE no catálogo", async () => {
    const f = await fixture();
    const runtimeClient = postgres(runtimeUrl!, { max: 1, prepare: false });
    const runtimeDb = drizzle(runtimeClient, { schema });
    try {
      const [identity] = await runtimeDb.execute<{ name: string; superuser: boolean }>(sql`
        select current_database() as name, (select rolsuper from pg_roles where rolname = current_user) as superuser
      `);
      expect(identity).toEqual({ name: "leiprova_automation_test", superuser: false });
      await expect(runtimeDb.execute(sql`select id from quiz_topics where id = ${f.topic.id} for share`))
        .rejects.toMatchObject({ cause: { code: "42501" } });
      const p = await importLocalDrafts(runtimeDb, { ...f.request, mode: "preview" });
      const result = await importLocalDrafts(runtimeDb, { ...f.request, mode: "apply", expectedFingerprint: p.fingerprint });
      expect(result).toMatchObject({ created: 2, publicationAllowed: false });
      expect((await rowsFor(f.publicIds)).every((question) => question.editorialStatus === "draft")).toBe(true);
    } finally { await runtimeClient.end(); }
  });
});
