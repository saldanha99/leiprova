import { createHash, randomUUID } from "node:crypto";

import { and, eq, inArray, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import * as schema from "@/lib/db/schema";
import {
  claimEditorialJob, EDITORIAL_LEASE_MS, editorialRetryAt,
  enqueueReviewedRequirementJobs, failEditorialJob, finishEditorialJob,
} from "@/lib/editorial/automation-jobs";
import { generateNoticeQuestionDraftForRequirement } from "@/lib/editorial/notice-draft-service";
import { editionHasOriginalTraining, originalStyleConditions } from "@/lib/quiz/original-style-query";
import { enqueueNewQuizMistakes } from "@/lib/study/quiz-review";
import { authorialStudyRightsConditions } from "@/lib/study/question-rights";

// Nunca usa DATABASE_URL nem .env. Este banco é exclusivamente temporário e sintético.
const testUrl = process.env.LEIPROVA_TEST_DATABASE_URL;
if (testUrl) {
  const parsed = new URL(testUrl);
  if (!["127.0.0.1", "localhost", "[::1]"].includes(parsed.hostname) ||
      parsed.pathname !== "/leiprova_automation_test") {
    throw new Error("Teste PostgreSQL exige loopback e banco leiprova_automation_test.");
  }
}
const client = testUrl ? postgres(testUrl, { max: 4, prepare: false }) : null;
const db = client ? drizzle(client, { schema }) : null;
const ownedJobKeys: string[] = [];
const now = new Date("2026-09-05T12:00:00Z");
const hash = (value: string) => createHash("sha256").update(value).digest("hex");

function database() {
  if (!db) throw new Error("Banco de teste não configurado.");
  return db;
}

async function fixture() {
  const database = db!;
  const tag = randomUUID();
  const [editor] = await database.insert(schema.users).values({
    publicId: randomUUID(), name: "Revisor fictício — teste automatizado",
    email: `editor-${tag}@example.invalid`, passwordHash: "not-a-login-password", role: "editor",
  }).returning();
  const [category] = await database.select().from(schema.contestCategoryCareers).limit(1);
  const [bank] = await database.select().from(schema.quizBanks).where(eq(schema.quizBanks.slug, "fgv"));
  const [topic] = await database.select().from(schema.quizTopics).limit(1);
  if (!category || !bank || !topic) throw new Error("Execute db:seed somente no banco temporário antes da integração.");

  const [act] = await database.insert(schema.legalActs).values({
    slug: `teste-${tag}`, title: "Regra inteiramente sintética para teste de software",
    shortTitle: "Regra sintética — sem validade jurídica", actType: "lei", actNumber: "999999",
    actYear: 2026, jurisdiction: "BR", officialUrl: "https://example.invalid/test-fixture",
  }).returning();
  const [version] = await database.insert(schema.legalVersions).values({
    legalActId: act.id, sourceUrl: "https://example.invalid/test-fixture",
    checksumSha256: hash(tag), verifiedAt: now, status: "current",
  }).returning();
  const [article] = await database.insert(schema.legalArticles).values({
    legalVersionId: version.id, articleRef: "Dispositivo sintético de teste", articleOrder: 1,
    path: "test/1", literalText: "No exercício fictício, a equipe deverá organizar os cartões antes da atividade e poderá revisar os exemplos somente na sessão de treinamento.",
    editorialStatus: "reviewed", sourceRights: "official_text",
  }).returning();
  const [opportunity] = await database.insert(schema.contestOpportunities).values({
    publicId: randomUUID(), slug: `teste-${tag}`, categoryId: category.categoryId,
    careerTrackId: category.careerTrackId, jurisdictionCode: "BR", scope: "national", cycleYear: 2026,
    institutionAcronym: `TEST-${tag}`, institutionName: "Instituição sintética", roleName: "Cargo de teste",
    title: "Concurso fictício para integração", summary: "Não é um concurso real.",
    lifecycleStatus: "pre_notice", statusAsOf: "2026-09-05",
    officialUrl: "https://example.invalid/test-fixture", sourceCheckedAt: now,
    editorialStatus: "draft",
  }).returning();
  const [source] = await database.insert(schema.opportunitySourceDocuments).values({
    publicId: randomUUID(), opportunityId: opportunity.id, documentType: "official_announcement",
    title: "Fonte sintética de teste", sourceUrl: "https://example.invalid/test-fixture",
    sourceHost: "example.invalid", observedAt: now, lastSeenAt: now, httpStatus: 200,
    status: "approved", reviewedByUserId: editor.id, reviewedAt: now,
  }).returning();
  await database.update(schema.contestOpportunities).set({
    editorialStatus: "reviewed", reviewedByUserId: editor.id, reviewedAt: now, publishedAt: now,
  }).where(eq(schema.contestOpportunities.id, opportunity.id));
  await database.insert(schema.opportunityOrganizerAssignments).values({
    opportunityId: opportunity.id, quizBankId: bank.id, sourceDocumentId: source.id,
    responsibleType: "external_organizer", role: "examination_provider",
    organizerSlug: "fgv", organizerName: "Perfil FGV em fixture sintética",
    validFrom: "2026-09-01", status: "reviewed", reviewedByUserId: editor.id, reviewedAt: now,
  });
  const [requirement] = await database.insert(schema.opportunityRequirements).values({
    opportunityId: opportunity.id, sourceDocumentId: source.id, subjectId: topic.subjectId,
    topicId: topic.id, legalActId: act.id, legalArticleId: article.id,
    requirementText: `Regra fictícia exclusiva ${Array.from({ length: 8 }, () => randomUUID()).join(" ")}`,
    sourceLocator: "Fixture de teste, página 1", editorialStatus: "reviewed",
    reviewedByUserId: editor.id, reviewedAt: now,
  }).returning();
  ownedJobKeys.push(`draft:${requirement.id}`);
  return { editor, opportunity, source, requirement, article, version, bank, category };
}

async function queueJobs(count = 1) {
  const prefix = `integration:${randomUUID()}:`;
  const jobs = Array.from({ length: count }, (_, index) => ({
    jobKey: prefix + String(index).padStart(3, "0"), kind: "draft_generation",
    subjectId: index + 1, inputHash: hash(prefix + index), nextAttemptAt: now, createdAt: now,
  }));
  ownedJobKeys.push(...jobs.map((job) => job.jobKey));
  await database().insert(schema.editorialAutomationJobs).values(jobs);
  return jobs;
}

describe.skipIf(!testUrl)("motor editorial — PostgreSQL real isolado", () => {
  beforeAll(async () => {
    const [identity] = await database().execute<{ name: string }>(sql`select current_database() as name`);
    expect(identity.name).toBe("leiprova_automation_test");
  });
  afterEach(async () => {
    if (ownedJobKeys.length) {
      await database().delete(schema.editorialAutomationJobs)
        .where(inArray(schema.editorialAutomationJobs.jobKey, ownedJobKeys.splice(0)));
    }
  });
  afterAll(async () => { await client?.end(); });

  it("reexecuta requisito sem comparar o rascunho consigo mesmo nem duplicar opções", async () => {
    const f = await fixture();
    const first = await generateNoticeQuestionDraftForRequirement(database(), f.requirement.id, f.editor.id);
    const repeated = await generateNoticeQuestionDraftForRequirement(database(), f.requirement.id, f.editor.id);
    expect(first.created).toBe(true);
    expect(repeated).toEqual({ publicId: first.publicId, created: false });
    const rows = await database().select().from(schema.questions)
      .where(eq(schema.questions.publicId, first.publicId));
    expect(rows).toHaveLength(1);
    expect(rows[0].editorialStatus).toBe("draft");
    const options = await database().select().from(schema.questionOptions)
      .where(eq(schema.questionOptions.questionId, rows[0].id));
    expect(options).toHaveLength(5);
    expect(options.filter((option) => option.isCorrect)).toHaveLength(1);
  });

  it("duas gerações concorrentes mantêm a mesma identidade e uma única inserção", async () => {
    const f = await fixture();
    const results = await Promise.all([
      generateNoticeQuestionDraftForRequirement(database(), f.requirement.id, f.editor.id),
      generateNoticeQuestionDraftForRequirement(database(), f.requirement.id, f.editor.id),
    ]);
    expect(results[0].publicId).toBe(results[1].publicId);
    expect(results.filter((result) => result.created)).toHaveLength(1);
  });

  it("continua no requisito 51 mesmo depois dos primeiros 50 bloqueados", async () => {
    const jobs = await queueJobs(51);
    for (let index = 0; index < 50; index += 1) {
      const job = await claimEditorialJob(database(), "draft_generation", now);
      expect(job).not.toBeNull();
      expect(await failEditorialJob(database(), job!, true, now)).toBe(true);
    }
    const next = await claimEditorialJob(database(), "draft_generation", now);
    expect(next?.jobKey).toBe(jobs[50].jobKey);
    expect(await finishEditorialJob(database(), next!, { created: true }, now)).toBe(true);
    expect(await claimEditorialJob(database(), "draft_generation", now)).toBeNull();
  });

  it("workers concorrentes recebem reservas distintas", async () => {
    await queueJobs(2);
    const [a, b] = await Promise.all([
      claimEditorialJob(database(), "draft_generation", now),
      claimEditorialJob(database(), "draft_generation", now),
    ]);
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    expect(a?.jobKey).not.toBe(b?.jobKey);
  });

  it("recupera lease vencido e rejeita conclusão do worker antigo", async () => {
    await queueJobs();
    const old = (await claimEditorialJob(database(), "draft_generation", now))!;
    expect(await claimEditorialJob(database(), "draft_generation", now)).toBeNull();
    const later = new Date(now.getTime() + EDITORIAL_LEASE_MS + 1);
    const replacement = (await claimEditorialJob(database(), "draft_generation", later))!;
    expect(replacement.jobKey).toBe(old.jobKey);
    expect(replacement.leaseToken).not.toBe(old.leaseToken);
    expect(await finishEditorialJob(database(), old, { stale: true }, later)).toBe(false);
    expect(await finishEditorialJob(database(), replacement, { recovered: true }, later)).toBe(true);
  });

  it("aplica backoff e para após cinco falhas transitórias", async () => {
    await queueJobs();
    let time = now;
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      const job = (await claimEditorialJob(database(), "draft_generation", time))!;
      expect(job.attempts).toBe(attempt);
      expect(await failEditorialJob(database(), job, false, time)).toBe(true);
      expect(await claimEditorialJob(database(), "draft_generation", time)).toBeNull();
      time = editorialRetryAt(attempt, time);
    }
    expect(await claimEditorialJob(database(), "draft_generation", time)).toBeNull();
    const [job] = await database().select().from(schema.editorialAutomationJobs)
      .where(eq(schema.editorialAutomationJobs.jobKey, ownedJobKeys[0]));
    expect(job.status).toBe("failed");
  });

  it("entrada inalterada permanece bloqueada; revisão modificada volta à fila", async () => {
    const f = await fixture();
    expect(await enqueueReviewedRequirementJobs(database(), now, f.opportunity.id)).toBe(1);
    const job = (await claimEditorialJob(database(), "draft_generation", now))!;
    await failEditorialJob(database(), job, true, now);
    expect(await enqueueReviewedRequirementJobs(database(), now, f.opportunity.id)).toBe(0);
    expect(await claimEditorialJob(database(), "draft_generation", now)).toBeNull();
    const later = new Date(now.getTime() + 60_000);
    await database().update(schema.opportunityRequirements).set({ updatedAt: later })
      .where(eq(schema.opportunityRequirements.id, f.requirement.id));
    expect(await enqueueReviewedRequirementJobs(database(), later, f.opportunity.id)).toBe(1);
    const refreshed = await claimEditorialJob(database(), "draft_generation", later);
    expect(refreshed?.inputHash).not.toBe(job.inputHash);
    expect(refreshed?.attempts).toBe(1);
  });

  it("não permite regenerar nem retornar item existente com fonte revogada", async () => {
    const f = await fixture();
    await generateNoticeQuestionDraftForRequirement(database(), f.requirement.id, f.editor.id);
    await database().update(schema.legalVersions).set({ status: "revoked" })
      .where(eq(schema.legalVersions.id, f.version.id));
    await expect(generateNoticeQuestionDraftForRequirement(database(), f.requirement.id, f.editor.id))
      .rejects.toThrow("norma oficial vigente");
  });

  it("a tabela recusa running sem reserva e limite inválido", async () => {
    const jobs = await queueJobs();
    await expect(database().update(schema.editorialAutomationJobs).set({ status: "running" })
      .where(eq(schema.editorialAutomationJobs.jobKey, jobs[0].jobKey))).rejects.toThrow();
    const [job] = await database().select().from(schema.editorialAutomationJobs)
      .where(and(eq(schema.editorialAutomationJobs.jobKey, jobs[0].jobKey),
        eq(schema.editorialAutomationJobs.status, "pending")));
    expect(job).toBeDefined();
  });

  it("a consulta real separa duas edições da mesma carreira, banca e ano e exige programa vigente", async () => {
    const f = await fixture();
    const generated = await generateNoticeQuestionDraftForRequirement(database(), f.requirement.id, f.editor.id);
    const [question] = await database().select().from(schema.questions)
      .where(eq(schema.questions.publicId, generated.publicId));
    await database().update(schema.questions).set({ editorialStatus: "reviewed",
      reviewedByUserId: f.editor.id, createdByUserId: f.editor.id, cleanRoomAttestedAt: now,
      submittedAt: now, verifiedAt: now }).where(eq(schema.questions.id, question.id));
    const editions = await database().insert(schema.examEditions).values([1, 2].map((index) => ({
      publicId: `teste-edicao-${randomUUID()}`, careerTrackId: f.category.careerTrackId,
      bankId: f.bank.id, title: `Edição fictícia ${index}`, examDate: "2026-12-01", status: "scheduled",
      officialUrl: "https://example.invalid/test-fixture", sourceCheckedAt: now,
    }))).returning();
    const eligible = (editionId: number | null) => database().select({ id: schema.questions.id })
      .from(schema.questions)
      .innerJoin(schema.legalArticles, eq(schema.questions.legalArticleId, schema.legalArticles.id))
      .innerJoin(schema.legalVersions, eq(schema.legalArticles.legalVersionId, schema.legalVersions.id))
      .innerJoin(schema.legalActs, eq(schema.legalVersions.legalActId, schema.legalActs.id))
      .where(and(eq(schema.questions.id, question.id),
        originalStyleConditions({ bankId: f.bank.id }, editionId)));
    expect(await eligible(null)).toHaveLength(1);
    expect(await eligible(editions[0].id)).toHaveLength(0);
    await database().update(schema.contestOpportunities).set({ examEditionId: editions[0].id })
      .where(eq(schema.contestOpportunities.id, f.opportunity.id));
    expect(await eligible(editions[0].id)).toHaveLength(1);
    expect(await eligible(editions[1].id)).toHaveLength(0);
    await database().update(schema.opportunityRequirements).set({ editorialStatus: "suspended" })
      .where(eq(schema.opportunityRequirements.id, f.requirement.id));
    expect(await eligible(editions[0].id)).toHaveLength(0);
    expect(await eligible(null)).toHaveLength(1);
    await database().update(schema.legalVersions).set({ status: "revoked" })
      .where(eq(schema.legalVersions.id, f.version.id));
    expect(await eligible(null)).toHaveLength(0);
  });

  it("a mesma edição não pode pertencer a dois programas", async () => {
    const a = await fixture();
    const b = await fixture();
    const [edition] = await database().insert(schema.examEditions).values({
      publicId: `teste-edicao-${randomUUID()}`, careerTrackId: a.category.careerTrackId,
      bankId: a.bank.id, title: "Fixture de unicidade", examDate: "2026-12-01",
    }).returning();
    await database().update(schema.contestOpportunities).set({ examEditionId: edition.id })
      .where(eq(schema.contestOpportunities.id, a.opportunity.id));
    await expect(database().update(schema.contestOpportunities).set({ examEditionId: edition.id })
      .where(eq(schema.contestOpportunities.id, b.opportunity.id))).rejects.toThrow();
  });

  it("erros novos do quiz alimentam revisão sem adiar vencidas nem repetir o registro de sessão", async () => {
    const f = await fixture();
    const draft = await generateNoticeQuestionDraftForRequirement(database(), f.requirement.id, f.editor.id);
    const [question] = await database().select().from(schema.questions).where(eq(schema.questions.publicId, draft.publicId));
    await database().update(schema.questions).set({ editorialStatus: "reviewed", createdByUserId: f.editor.id,
      reviewedByUserId: f.editor.id, cleanRoomAttestedAt: now, submittedAt: now, verifiedAt: now })
      .where(eq(schema.questions.id, question.id));
    const mistake = [{ questionId: question.id, isCorrect: false }];
    expect(await enqueueNewQuizMistakes(database(), f.editor.id, mistake, now)).toBe(1);
    // A segunda conclusão da mesma sessão não insere nova tentativa e passa lista vazia.
    expect(await enqueueNewQuizMistakes(database(), f.editor.id, [], now)).toBe(0);
    let [review] = await database().select().from(schema.reviewQueue).where(eq(schema.reviewQueue.userId, f.editor.id));
    expect(review.repetitions).toBe(1);
    expect(review.lapses).toBe(1);
    expect(review.nextReviewAt.getTime()).toBe(now.getTime() + 86_400_000);
    const due = new Date(now.getTime() - 60_000);
    await database().update(schema.reviewQueue).set({ nextReviewAt: due })
      .where(eq(schema.reviewQueue.userId, f.editor.id));
    await enqueueNewQuizMistakes(database(), f.editor.id, mistake, now);
    [review] = await database().select().from(schema.reviewQueue).where(eq(schema.reviewQueue.userId, f.editor.id));
    expect(review.nextReviewAt.getTime()).toBe(due.getTime());
    expect(review.repetitions).toBe(2);
    await database().update(schema.legalVersions).set({ status: "revoked" }).where(eq(schema.legalVersions.id, f.version.id));
    expect(await enqueueNewQuizMistakes(database(), f.editor.id, mistake, now)).toBe(0);
  });

  it("não transfere questões de prova licenciada para a revisão autoral, mesmo antes do vencimento", async () => {
    const f = await fixture();
    const draft = await generateNoticeQuestionDraftForRequirement(database(), f.requirement.id, f.editor.id);
    const [edition] = await database().insert(schema.examEditions).values({
      publicId: `teste-licenca-${randomUUID()}`, careerTrackId: f.category.careerTrackId,
      bankId: f.bank.id, title: "Prova inteiramente fictícia de teste", examDate: "2026-01-01",
    }).returning();
    const [question] = await database().update(schema.questions).set({
      quizMode: "previous_exam", styleBankId: null, examEditionId: edition.id,
      sourceRights: "licensed", sourceTitle: "Licença fictícia de teste",
      sourceUrl: "https://example.invalid/test-fixture", sourceRightsHolder: "Fixture",
      licenseBasis: "Licença fictícia — não corresponde a direito real",
      licenseReference: "QA-local", licensedAt: new Date(now.getTime() - 86_400_000),
      licenseExpiresAt: new Date(now.getTime() + 86_400_000), originalQuestionNumber: "1",
      originalQuestionOrder: 1, editorialStatus: "reviewed", reviewedByUserId: f.editor.id,
    }).where(eq(schema.questions.publicId, draft.publicId)).returning();
    const mistake = [{ questionId: question.id, isCorrect: false }];
    expect(await enqueueNewQuizMistakes(database(), f.editor.id, mistake, now)).toBe(0);
    // O mesmo predicado protege sessão e resposta, caso exista uma fila antiga.
    expect(await database().select().from(schema.questions).where(and(
      eq(schema.questions.id, question.id), authorialStudyRightsConditions(),
    ))).toHaveLength(0);
    await database().update(schema.questions).set({ licenseExpiresAt: new Date(now.getTime() - 60_000) })
      .where(eq(schema.questions.id, question.id));
    expect(await enqueueNewQuizMistakes(database(), f.editor.id, mistake, now)).toBe(0);
    expect(await database().select().from(schema.reviewQueue)
      .where(eq(schema.reviewQueue.userId, f.editor.id))).toHaveLength(0);
  });

  it("só oferece edição futura com questão autoral elegível e requisito/fonte ainda aprovados", async () => {
    const f = await fixture();
    const [edition] = await database().insert(schema.examEditions).values({
      publicId: `teste-futuro-${randomUUID()}`, careerTrackId: f.category.careerTrackId,
      bankId: f.bank.id, title: "Edição futura sintética", examDate: "2026-12-01", status: "scheduled",
    }).returning();
    await database().update(schema.contestOpportunities).set({ examEditionId: edition.id })
      .where(eq(schema.contestOpportunities.id, f.opportunity.id));
    const available = async () => {
      const [row] = await database().execute<{ eligible: boolean }>(sql`
        select ${editionHasOriginalTraining(edition.id, f.bank.id)} as eligible
      `);
      return row.eligible;
    };
    expect(await available()).toBe(false);
    const draft = await generateNoticeQuestionDraftForRequirement(database(), f.requirement.id, f.editor.id);
    expect(await available()).toBe(false);
    await database().update(schema.questions).set({ editorialStatus: "reviewed", createdByUserId: f.editor.id,
      reviewedByUserId: f.editor.id, cleanRoomAttestedAt: now, submittedAt: now, verifiedAt: now })
      .where(eq(schema.questions.publicId, draft.publicId));
    expect(await available()).toBe(true);
    await database().update(schema.opportunityRequirements).set({ editorialStatus: "draft" })
      .where(eq(schema.opportunityRequirements.id, f.requirement.id));
    expect(await available()).toBe(false);
    await database().update(schema.opportunityRequirements).set({ editorialStatus: "reviewed" })
      .where(eq(schema.opportunityRequirements.id, f.requirement.id));
    // O banco já impede revogar a fonte mantendo seus dependentes revisados.
    await expect(database().update(schema.opportunitySourceDocuments).set({ status: "pending_review" })
      .where(eq(schema.opportunitySourceDocuments.id, f.source.id))).rejects.toThrow();
    expect(await available()).toBe(true);
    await database().update(schema.legalVersions).set({ status: "revoked" })
      .where(eq(schema.legalVersions.id, f.version.id));
    expect(await available()).toBe(false);
  });
});
