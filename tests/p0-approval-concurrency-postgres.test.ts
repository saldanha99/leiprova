import { createHash, randomUUID } from "node:crypto";

import { and, eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import * as schema from "@/lib/db/schema";
import { toQuestionDossier } from "@/lib/db/editorial-admin";
import {
  currentLegalSourceExists,
  lockApprovalScope,
} from "@/lib/editorial/approval-lock";
import { buildDossierFingerprint } from "@/lib/editorial/dossier-fingerprint";
import { matchConfirmedDossiers, parseReviewerConfirmation } from "@/lib/editorial/approval-eligibility";

/**
 * Regressão de concorrência real contra PostgreSQL.
 *
 * O ponto destes testes não é o hash: é provar que o escopo travado impede uma
 * transação concorrente de alterar alternativas e norma entre a conferência do
 * revisor e a gravação. Travar `questions` sozinho não fazia isso.
 *
 * Banco exclusivamente temporário e sintético. Nunca lê DATABASE_URL nem .env, e
 * não toca em fixtures de outros pacotes (prefixo `qa-`): tudo criado aqui usa o
 * prefixo `p0b-` e é removido ao final.
 */
const TEST_URL = process.env.LEIPROVA_TEST_DATABASE_URL;
const FIXTURE_PREFIX = "p0b-";
const LOCK_WAIT_MS = 600;

const parsed = new URL(TEST_URL ?? "postgres://127.0.0.1/leiprova_automation_test");
if (!["127.0.0.1", "localhost", "[::1]"].includes(parsed.hostname)) {
  throw new Error("Teste PostgreSQL exige loopback.");
}
if (parsed.pathname !== "/leiprova_automation_test") {
  throw new Error("Teste PostgreSQL exige o banco leiprova_automation_test.");
}

let client: ReturnType<typeof postgres> | null = null;
let db: ReturnType<typeof drizzle<typeof schema>> | null = null;
let available = false;

type Fixture = {
  questionId: number;
  publicId: string;
  optionIds: number[];
  legalArticleId: number;
  legalVersionId: number;
  legalActId: number;
  styleBankId: number;
};

let fixture: Fixture | null = null;

async function createFixture(): Promise<Fixture> {
  const database = db!;
  const tag = randomUUID().slice(0, 8);

  const [act] = await database.insert(schema.legalActs).values({
    slug: `p0b-${tag}`, title: "Regra fictícia de concorrência", shortTitle: "Fixture sem valor jurídico",
    actType: "lei", officialUrl: "https://example.invalid/p0b-fixture",
  }).returning();
  const [version] = await database.insert(schema.legalVersions).values({
    legalActId: act.id, sourceUrl: "https://example.invalid/p0b-fixture", verifiedAt: new Date(),
    checksumSha256: createHash("sha256").update(tag).digest("hex"), status: "current",
  }).returning();
  const [article] = await database.insert(schema.legalArticles).values({
    legalVersionId: version.id, articleRef: "Artigo fictício p0b", path: "p0b/1", articleOrder: 1,
    literalText: "Regra inteiramente fictícia para teste de concorrência, sem valor jurídico.",
    editorialStatus: "reviewed", sourceRights: "official_text",
  }).returning();
  const [bank] = await database
    .select({ id: schema.quizBanks.id })
    .from(schema.questionStyleProfiles)
    .innerJoin(schema.quizBanks, eq(schema.questionStyleProfiles.quizBankId, schema.quizBanks.id))
    .where(
      and(
        eq(schema.questionStyleProfiles.isActive, true),
        eq(schema.questionStyleProfiles.format, "multiple_choice"),
        eq(schema.quizBanks.isActive, true),
      ),
    )
    .limit(1);
  const [topic] = await database
    .select({ id: schema.quizTopics.id, subjectId: schema.quizTopics.subjectId, name: schema.quizTopics.name })
    .from(schema.quizTopics)
    .limit(1);

  if (!article || !bank || !topic) throw new Error("Banco de teste sem dados base para a fixture.");

  const now = new Date("2026-09-05T12:00:00Z");
  const [question] = await database
    .insert(schema.questions)
    .values({
      publicId: `${FIXTURE_PREFIX}${tag}-${randomUUID()}`.slice(0, 60),
      quizMode: "original_style",
      type: "multiple_choice",
      prompt: `${FIXTURE_PREFIX}enunciado sintético para teste de concorrência ${tag}`,
      explanation: `${FIXTURE_PREFIX}explicação sintética de teste, sem valor jurídico.`,
      learningObjective: `${FIXTURE_PREFIX}objetivo sintético de teste automatizado.`,
      topic: topic.name,
      topicId: topic.id,
      subjectId: topic.subjectId,
      legalArticleId: article.id,
      styleBankId: bank.id,
      sourceRights: "original_authorial",
      editorialStatus: "pending_review",
      authorshipMethod: "ai_assisted",
      generatorModel: "teste-automatizado",
      promptVersion: "p0b-concurrency-v1",
      difficulty: 3,
      cleanRoomAttestedAt: now,
      originalityCheckedAt: now,
      similarityMaxBps: 100,
      createdByUserId: (await database.select({ id: schema.users.id }).from(schema.users).limit(1))[0]?.id,
      submittedAt: now,
      verifiedAt: now,
    })
    .returning({ id: schema.questions.id, publicId: schema.questions.publicId });

  const options = await database
    .insert(schema.questionOptions)
    .values(
      ["A", "B", "C", "D", "E"].map((key, index) => ({
        questionId: question.id,
        optionKey: key,
        text: `${FIXTURE_PREFIX}alternativa sintética ${key}`,
        isCorrect: index === 1,
        rationale: `${FIXTURE_PREFIX}justificativa ${key}`,
        sortOrder: index,
      })),
    )
    .returning({ id: schema.questionOptions.id });

  return {
    questionId: question.id,
    publicId: question.publicId,
    optionIds: options.map((option) => option.id),
    legalArticleId: article.id,
    legalVersionId: article.legalVersionId,
    legalActId: act.id,
    styleBankId: bank.id,
  };
}

async function readDossier(questionId: number) {
  const database = db!;
  const [row] = await database
    .select({
      publicId: schema.questions.publicId,
      type: schema.questions.type,
      prompt: schema.questions.prompt,
      explanation: schema.questions.explanation,
      learningObjective: schema.questions.learningObjective,
      difficulty: schema.questions.difficulty,
      articleRef: schema.legalArticles.articleRef,
      literalText: schema.legalArticles.literalText,
      sourceUrl: schema.legalVersions.sourceUrl,
      sourceVerifiedAt: schema.legalVersions.verifiedAt,
    })
    .from(schema.questions)
    .innerJoin(schema.legalArticles, eq(schema.questions.legalArticleId, schema.legalArticles.id))
    .innerJoin(schema.legalVersions, eq(schema.legalArticles.legalVersionId, schema.legalVersions.id))
    .where(eq(schema.questions.id, questionId));

  const options = await database
    .select({
      optionKey: schema.questionOptions.optionKey,
      text: schema.questionOptions.text,
      isCorrect: schema.questionOptions.isCorrect,
      rationale: schema.questionOptions.rationale,
    })
    .from(schema.questionOptions)
    .where(eq(schema.questionOptions.questionId, questionId));

  return buildDossierFingerprint(toQuestionDossier(row, options));
}

beforeAll(async () => {
    if (!TEST_URL) return;
    client = postgres(TEST_URL, { max: 5, prepare: false, connect_timeout: 5 });
    await client`select 1`;
    db = drizzle(client, { schema });
    fixture = await createFixture();
    available = true;
});

afterAll(async () => {
  if (db && fixture) {
    await db.delete(schema.questionOptions).where(inArray(schema.questionOptions.id, fixture.optionIds));
    await db.delete(schema.questions).where(eq(schema.questions.id, fixture.questionId));
    await db.delete(schema.legalArticles).where(eq(schema.legalArticles.id, fixture.legalArticleId));
    await db.delete(schema.legalVersions).where(eq(schema.legalVersions.id, fixture.legalVersionId));
    await db.delete(schema.legalActs).where(eq(schema.legalActs.id, fixture.legalActId));
  }
  await client?.end({ timeout: 5 });
});

describe.skipIf(!TEST_URL)("concorrência real na aprovação editorial", () => {
  it("o escopo travado impede alteração concorrente das alternativas", async () => {
    if (!available || !fixture || !db || !client) return expect(available).toBe(true);

    let updateFinished = false;
    let updatePromise: Promise<unknown> | null = null;

    await db.transaction(async (transaction) => {
      await lockApprovalScope(transaction, {
        questionIds: [fixture!.questionId],
        legalArticleIds: [fixture!.legalArticleId],
        styleBankIds: [fixture!.styleBankId],
      });

      // Outra conexão tenta alterar uma alternativa do item em conferência.
      updatePromise = client!`
        update question_options set text = ${`${FIXTURE_PREFIX}texto adulterado`}
        where id = ${fixture!.optionIds[0]}
      `.then(() => {
        updateFinished = true;
      });

      await new Promise((resolve) => setTimeout(resolve, LOCK_WAIT_MS));
      // Sem o FOR SHARE sobre question_options este UPDATE já teria concluído.
      expect(updateFinished).toBe(false);
    });

    await updatePromise;
    expect(updateFinished).toBe(true);
  });

  it("controle negativo: travar apenas a questão NÃO impede a troca das alternativas", async () => {
    if (!available || !fixture || !db || !client) return expect(available).toBe(true);

    let updateFinished = false;
    let updatePromise: Promise<unknown> | null = null;

    await db.transaction(async (transaction) => {
      // Reproduz o comportamento anterior: FOR UPDATE só em `questions`.
      await transaction
        .select({ id: schema.questions.id })
        .from(schema.questions)
        .where(eq(schema.questions.id, fixture!.questionId))
        .for("update");

      updatePromise = client!`
        update question_options set text = ${`${FIXTURE_PREFIX}adulterado sob lock antigo`}
        where id = ${fixture!.optionIds[1]}
      `.then(() => {
        updateFinished = true;
      });

      await new Promise((resolve) => setTimeout(resolve, LOCK_WAIT_MS));
      // Passa direto: é exatamente o TOCTOU que o escopo ampliado fecha.
      expect(updateFinished).toBe(true);
    });

    await updatePromise;
  });

  it("o escopo travado impede alteração concorrente da versão da norma", async () => {
    if (!available || !fixture || !db || !client) return expect(available).toBe(true);

    let updateFinished = false;
    let updatePromise: Promise<unknown> | null = null;

    await db.transaction(async (transaction) => {
      await lockApprovalScope(transaction, {
        questionIds: [fixture!.questionId],
        legalArticleIds: [fixture!.legalArticleId],
        styleBankIds: [fixture!.styleBankId],
      });

      // UPDATE sem efeito prático: basta exigir o lock de linha para provar o
      // bloqueio, sem alterar dado algum da norma.
      updatePromise = client!`
        update legal_versions set status = status where id = ${fixture!.legalVersionId}
      `.then(() => {
        updateFinished = true;
      });

      await new Promise((resolve) => setTimeout(resolve, LOCK_WAIT_MS));
      // Travar a questão não protegeria a norma; o FOR SHARE sobre a versão sim.
      expect(updateFinished).toBe(false);
    });

    await updatePromise;
    expect(updateFinished).toBe(true);
  });

  it("alteração já efetivada nas alternativas invalida a conferência", async () => {
    if (!available || !fixture || !db) return expect(available).toBe(true);

    const conferido = await readDossier(fixture.questionId);
    await db
      .update(schema.questionOptions)
      .set({ rationale: `${FIXTURE_PREFIX}justificativa trocada depois da leitura` })
      .where(eq(schema.questionOptions.id, fixture.optionIds[2]));

    const atual = await readDossier(fixture.questionId);
    expect(atual).not.toBe(conferido);

    const confirmation = parseReviewerConfirmation(
      [fixture.publicId],
      [`${fixture.publicId}:${conferido}`],
    );
    const veredito = matchConfirmedDossiers(confirmation, new Map([[fixture.publicId, atual]]));
    expect(veredito.allowed).toBe(false);
    expect(veredito.reason).toContain("mudou depois da sua conferência");
  });

  it("a revalidação final em SQL recusa gravar quando a norma deixa de ser vigente", async () => {
    if (!available || !fixture || !db) return expect(available).toBe(true);

    const antes = await db
      .update(schema.questions)
      .set({ reviewNotes: `${FIXTURE_PREFIX}sonda com norma vigente` })
      .where(and(eq(schema.questions.id, fixture.questionId), currentLegalSourceExists()))
      .returning({ id: schema.questions.id });
    expect(antes).toHaveLength(1);

    await db
      .update(schema.legalVersions)
      .set({ status: "superseded" })
      .where(eq(schema.legalVersions.id, fixture.legalVersionId));

    try {
      const depois = await db
        .update(schema.questions)
        .set({ reviewNotes: `${FIXTURE_PREFIX}sonda com norma superada` })
        .where(and(eq(schema.questions.id, fixture.questionId), currentLegalSourceExists()))
        .returning({ id: schema.questions.id });
      expect(depois).toHaveLength(0);
    } finally {
      await db
        .update(schema.legalVersions)
        .set({ status: "current" })
        .where(eq(schema.legalVersions.id, fixture.legalVersionId));
    }
  });
});
