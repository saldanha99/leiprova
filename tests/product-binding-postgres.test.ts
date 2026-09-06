import { createHash, randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as schema from "../src/lib/db/schema";
import { importProductQuestionBindings } from "../src/lib/commerce/product-binding-service";
import { bindSyntheticProductQuestions } from "../scripts/lib/synthetic-product-bindings";
import { approvedProductQuestionCount, minimumCourseContentSatisfied } from "../src/lib/commerce/minimum-course-content";

// Não lê .env e não aceita o banco compartilhado, homologação pública ou produção.
const url = process.env.LEIPROVA_BINDING_TEST_DATABASE_URL;
if (url) {
  const parsed = new URL(url);
  if (parsed.hostname !== "127.0.0.1" || parsed.port !== "55441" || parsed.pathname !== "/leiprova_binding_test" ||
      parsed.username !== "leiprova_binding_owner" || parsed.search || parsed.hash) throw new Error("Somente sandbox exclusivo de vínculos.");
}
const client = url ? postgres(url, { max: 2, prepare: false }) : null;
const db = client ? drizzle(client, { schema }) : null;
const restrictedClient = url ? postgres(url.replace("leiprova_binding_owner@", "leiprova_binding_app@"), { max: 1, prepare: false }) : null;
const restrictedDb = restrictedClient ? drizzle(restrictedClient, { schema }) : null;
vi.mock("@/lib/db/client", () => ({ getDb: () => restrictedDb }));
import { getStudyEntitlement } from "../src/lib/study/entitlement";
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const now = new Date("2026-09-06T01:00:00Z");
const before = new Date(now.getTime() - 86_400_000);
const after = new Date(now.getTime() + 86_400_000);

async function fixture() {
  const tag = randomUUID();
  const [editor, user, other] = await db!.insert(schema.users).values(["editor", "student", "student"].map((role, i) => ({
    publicId: randomUUID(), email: `binding-${tag}-${i}@example.invalid`, name: "Pessoa fictícia sem login", passwordHash: "not-a-password", role,
  }))).returning();
  const [category] = await db!.insert(schema.contestCategories).values({ slug: `qa-${tag}`, name: "QA", description: "Categoria sintética" }).returning();
  const [career] = await db!.insert(schema.quizCareerTracks).values({ slug: `qa-${tag}`, name: "QA", shortName: "QA", description: "Carreira sintética" }).returning();
  await db!.insert(schema.contestCategoryCareers).values({ categoryId: category.id, careerTrackId: career.id });
  const [subject] = await db!.insert(schema.quizSubjects).values({ slug: `qa-${tag}`, name: "QA", shortName: "QA" }).returning();
  const [topic] = await db!.insert(schema.quizTopics).values({ subjectId: subject.id, slug: "qa", name: "QA" }).returning();
  const [act] = await db!.insert(schema.legalActs).values({ slug: `qa-${tag}`, title: "Regra sintética sem validade", shortTitle: "QA", actType: "lei",
    actYear: 2026, officialUrl: "https://example.invalid/test-fixture" }).returning();
  const [version] = await db!.insert(schema.legalVersions).values({ legalActId: act.id, sourceUrl: act.officialUrl,
    checksumSha256: hash(tag), verifiedAt: now, status: "current" }).returning();
  const [article] = await db!.insert(schema.legalArticles).values({ legalVersionId: version.id, articleRef: "Regra QA", articleOrder: 1,
    path: "qa/1", literalText: "Na regra fictícia, os cartões azuis devem ser organizados antes dos cartões verdes.", editorialStatus: "reviewed" }).returning();
  const [opportunity] = await db!.insert(schema.contestOpportunities).values({ publicId: randomUUID(), slug: `qa-${tag}`, categoryId: category.id,
    careerTrackId: career.id, jurisdictionCode: "BR", scope: "national", cycleYear: 2026, institutionAcronym: `QA-${tag}`, institutionName: "QA",
    roleName: "Dois cargos fictícios", title: "Concurso sintético compartilhado", summary: "Fixture sem validade jurídica.", lifecycleStatus: "pre_notice",
    statusAsOf: "2026-09-06", officialUrl: act.officialUrl, sourceCheckedAt: now, editorialStatus: "draft" }).returning();
  const [source] = await db!.insert(schema.opportunitySourceDocuments).values({ publicId: randomUUID(), opportunityId: opportunity.id,
    documentType: "official_announcement", title: "Fonte fictícia", sourceUrl: act.officialUrl, sourceHost: "example.invalid", observedAt: now,
    lastSeenAt: now, httpStatus: 200, status: "approved", reviewedByUserId: editor.id, reviewedAt: now }).returning();
  await db!.update(schema.contestOpportunities).set({ editorialStatus: "reviewed", reviewedByUserId: editor.id, reviewedAt: now, publishedAt: now })
    .where(eq(schema.contestOpportunities.id, opportunity.id));
  const [requirement] = await db!.insert(schema.opportunityRequirements).values({ opportunityId: opportunity.id, sourceDocumentId: source.id,
    subjectId: subject.id, topicId: topic.id, legalActId: act.id, legalArticleId: article.id, requirementText: "Reconhecer a sequência de cartões fictícios.",
    sourceLocator: "Fixture sintética página 1", editorialStatus: "reviewed", reviewedByUserId: editor.id, reviewedAt: now }).returning();
  const questions = await db!.insert(schema.questions).values([0, 1].map((i) => ({ publicId: `qa-binding-${tag}-${i}`,
    legalArticleId: article.id, subjectId: subject.id, topicId: topic.id, quizMode: "dry_law", type: "multiple_choice",
    prompt: `Exercício inteiramente fictício ${i}: qual cor vem primeiro?`, explanation: "A regra fictícia determina que os azuis vêm primeiro.", learningObjective: "Validar isolamento de software com regras fictícias.",
    topic: "QA", editorialStatus: "reviewed", sourceRights: "original_authorial", authorshipMethod: "rule_based", generatorModel: "qa-fixture", promptVersion: "v1",
    createdByUserId: editor.id, reviewedByUserId: editor.id, cleanRoomAttestedAt: now, submittedAt: now, verifiedAt: now, originalityCheckedAt: now,
  }))).returning();
  for (const question of questions) await db!.insert(schema.questionOptions).values(["Azul", "Verde"].map((text, i) => ({
    questionId: question.id, optionKey: i ? "B" : "A", text, isCorrect: !i, sortOrder: i,
  })));
  const products = await db!.insert(schema.contestStoreProducts).values(["x", "y"].map((suffix) => ({ slug: `qa-${tag}-${suffix}`, opportunityId: opportunity.id }))).returning();
  await db!.insert(schema.contestOrders).values({ id: tag, userId: user.id, status: "paid", amountCents: 6700,
    lines: [{ productSlug: products[0].slug, opportunityId: opportunity.id, accessKey: "monthly", months: 1, amountCents: 6700, stripePriceId: "synthetic-no-stripe" }], stripeMode: "test" });
  const [purchase] = await db!.insert(schema.contestPurchases).values({ orderId: tag, productSlug: products[0].slug, opportunityId: opportunity.id,
    userId: user.id, status: "active", accessStartsAt: before, accessEndsAt: after }).returning();
  return { editor, user, other, article, version, opportunity, source, requirement, questions, products, purchase };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
function input(f: Fixture, productIndex = 0, questionIndex = 0) {
  return { schemaVersion: 1, items: [{ productSlug: f.products[productIndex].slug, opportunityPublicId: f.opportunity.publicId,
    requirementId: f.requirement.id, questionPublicId: f.questions[questionIndex].publicId, requirementQuote: f.requirement.requirementText,
    legalQuote: f.article.literalText, scopeNotes: "Fixture de aderência por produto, sem concurso, lei ou aprovação editorial real." }] };
}
async function propose(f: Fixture, productIndex = 0, questionIndex = 0) {
  const request = { input: input(f, productIndex, questionIndex), actorPublicId: f.editor.publicId };
  const preview = await importProductQuestionBindings(restrictedDb!, { ...request, mode: "preview" });
  return importProductQuestionBindings(restrictedDb!, { ...request, mode: "import-pending", expectedFingerprint: preview.fingerprint });
}
async function syntheticApproval(f: Fixture, id: string) {
  // Exclusivamente neste sandbox e nesta fixture; não existe comando de aprovação no produto.
  await db!.update(schema.contestProductQuestionBindings).set({ status: "approved", reviewedByUserId: f.editor.id, reviewedAt: now,
    reviewNotes: "Aprovação SINTÉTICA de teste; sem validade editorial ou jurídica." }).where(eq(schema.contestProductQuestionBindings.id, id));
}

async function addSyntheticQuestions(f: Fixture, count: number) {
  const template = f.questions[0];
  // Apenas conteúdo fictício no banco explicitamente validado acima; não replica acervo jurídico.
  for (let index = 0; index < count; index++) {
    const [question] = await db!.insert(schema.questions).values({
      publicId: `qa-minimum-${randomUUID()}`, legalArticleId: template.legalArticleId,
      subjectId: template.subjectId, topicId: template.topicId, quizMode: "dry_law", type: "multiple_choice",
      prompt: `Fixture inteiramente fictícia de contagem ${randomUUID()}: qual cartão vem primeiro?`,
      explanation: template.explanation, learningObjective: template.learningObjective, topic: template.topic,
      editorialStatus: "reviewed", sourceRights: "original_authorial", authorshipMethod: "rule_based",
      generatorModel: "qa-fixture", promptVersion: "v1", createdByUserId: f.editor.id, reviewedByUserId: f.editor.id,
      cleanRoomAttestedAt: now, submittedAt: now, verifiedAt: now, originalityCheckedAt: now,
    }).returning();
    await db!.insert(schema.questionOptions).values(["Azul", "Verde"].map((text, index) => ({
      questionId: question.id, optionKey: index ? "B" : "A", text, isCorrect: !index, sortOrder: index,
    })));
  }
}

async function contentReadiness(f: Fixture, productIndex = 0, opportunityId = f.opportunity.id) {
  const product = sql`${f.products[productIndex].slug}`;
  const opportunity = sql`${opportunityId}`;
  const [result] = await restrictedDb!.execute<{ count: number; ready: boolean }>(sql`select
    ${approvedProductQuestionCount(product, opportunity)} as count,
    ${minimumCourseContentSatisfied(product, opportunity)} as ready`);
  return result;
}
describe.skipIf(!db)("curadoria e entitlement reais — PostgreSQL exclusivo com grants restritos", () => {
  let f: Fixture;
  beforeEach(async () => { f = await fixture(); });
  afterAll(async () => { await client?.end(); await restrictedClient?.end(); });
  it("preview não escreve; importador cria somente pendente, auditável e idempotente", async () => {
    const beforeCount = await db!.select().from(schema.contestProductQuestionBindings).where(eq(schema.contestProductQuestionBindings.productSlug, f.products[0].slug));
    expect(beforeCount).toHaveLength(0);
    const first = await propose(f);
    expect(first.created).toBe(1); expect(first.publicationAllowed).toBe(false);
    const [row] = await db!.select().from(schema.contestProductQuestionBindings).where(eq(schema.contestProductQuestionBindings.id, first.proposals[0].id));
    expect(row.status).toBe("pending_review"); expect(row.reviewedByUserId).toBeNull(); expect(row.reviewedAt).toBeNull();
    expect((await propose(f)).reused).toBe(1);
    const audits = await db!.select().from(schema.auditLogs).where(eq(schema.auditLogs.entityId, row.id));
    expect(audits).toHaveLength(1); expect(audits[0].metadata.humanReviewRecorded).toBe(false);
    expect((await getStudyEntitlement(f.user.id, now)).questionPublicIds).toEqual([]);
  });
  it("dois produtos da mesma oportunidade não vazam questões nem acesso entre clientes", async () => {
    const x = await propose(f); const y = await propose(f, 1, 1);
    await syntheticApproval(f, x.proposals[0].id); await syntheticApproval(f, y.proposals[0].id);
    expect(await getStudyEntitlement(f.user.id, now)).toEqual({ hasFullAccess: false, questionPublicIds: [f.questions[0].publicId] });
    expect((await getStudyEntitlement(f.other.id, now)).questionPublicIds).toEqual([]);
    expect((await propose(f)).reused).toBe(1);
    expect((await getStudyEntitlement(f.user.id, now)).questionPublicIds).toEqual([f.questions[0].publicId]);
  });
  it("requisito pendente aceita proposta, mas não é promovido nem gera mapa legado", async () => {
    await db!.update(schema.opportunityRequirements).set({ editorialStatus: "draft", legalArticleId: null, subjectId: null, topicId: null })
      .where(eq(schema.opportunityRequirements.id, f.requirement.id));
    const result = await propose(f);
    expect(result.proposals[0].blockers.some((line) => line.includes("Requisito"))).toBe(true);
    const [row] = await db!.select().from(schema.opportunityRequirements).where(eq(schema.opportunityRequirements.id, f.requirement.id));
    expect(row.editorialStatus).toBe("draft"); expect(row.legalArticleId).toBeNull();
    expect(await db!.select().from(schema.questionOpportunities).where(eq(schema.questionOpportunities.opportunityId, f.opportunity.id))).toHaveLength(0);
    await syntheticApproval(f, result.proposals[0].id);
    expect((await getStudyEntitlement(f.user.id, now)).questionPublicIds).toEqual([]);
  });
  it("papel do app não pode aprovar, editar evidências ou apagar vínculos", async () => {
    const result = await propose(f); const id = result.proposals[0].id;
    await expect(restrictedDb!.update(schema.contestProductQuestionBindings).set({ status: "approved" })
      .where(eq(schema.contestProductQuestionBindings.id, id))).rejects.toThrow();
    await expect(restrictedDb!.delete(schema.contestProductQuestionBindings).where(eq(schema.contestProductQuestionBindings.id, id))).rejects.toThrow();
    await expect(restrictedDb!.execute(sql`update contest_product_question_bindings set evidence='{}'::jsonb where id=${id}`)).rejects.toThrow();
    await expect(db!.execute(sql`update contest_product_question_bindings set status='approved', reviewed_by_user_id=${f.editor.id},reviewed_at=now(),review_notes=null where id=${id}`)).rejects.toThrow();
  });
  it("rejeita citação alterada e preview desatualizado sem gravar", async () => {
    const request = { input: input(f), actorPublicId: f.editor.publicId };
    const preview = await importProductQuestionBindings(restrictedDb!, { ...request, mode: "preview" });
    await db!.update(schema.questions).set({ explanation: "Explicação sintética alterada para invalidar a impressão." }).where(eq(schema.questions.id, f.questions[0].id));
    await expect(importProductQuestionBindings(restrictedDb!, { ...request, mode: "import-pending", expectedFingerprint: preview.fingerprint })).rejects.toThrow("mudou");
    request.input.items[0].legalQuote = "Citação inexistente no texto legal fictício.";
    await expect(importProductQuestionBindings(restrictedDb!, { ...request, mode: "preview" })).rejects.toThrow("citação legal");
  });
  it("inédita exige a banca efetiva e o perfil exato; revisão de perfil fecha o vínculo", async () => {
    const [bank] = await db!.insert(schema.quizBanks).values({ slug: `qa-${randomUUID()}`, name: "FGV fictícia", fullName: "Somente fixture" }).returning();
    const [profile] = await db!.insert(schema.questionStyleProfiles).values({ quizBankId: bank.id, format: "multiple_choice",
      commandStyle: "Fixture", reasoningDemand: "Fixture", disclaimer: "Perfil sintético exclusivo do teste de software." }).returning();
    await db!.update(schema.questions).set({ quizMode: "original_style", styleBankId: bank.id }).where(eq(schema.questions.id, f.questions[0].id));
    const missing = await propose(f);
    await syntheticApproval(f, missing.proposals[0].id);
    expect((await getStudyEntitlement(f.user.id, now)).questionPublicIds).toEqual([]);
    await db!.insert(schema.opportunityOrganizerAssignments).values({ opportunityId: f.opportunity.id, quizBankId: bank.id,
      sourceDocumentId: f.source.id, responsibleType: "external_organizer", role: "examination_provider", organizerSlug: bank.slug,
      organizerName: "Banca da fixture", validFrom: "2026-09-01", status: "reviewed", reviewedByUserId: f.editor.id, reviewedAt: now });
    const matching = await propose(f); await syntheticApproval(f, matching.proposals[0].id);
    expect((await getStudyEntitlement(f.user.id, now)).questionPublicIds).toEqual([f.questions[0].publicId]);
    await db!.update(schema.questionStyleProfiles).set({ version: 2 }).where(eq(schema.questionStyleProfiles.id, profile.id));
    expect((await getStudyEntitlement(f.user.id, now)).questionPublicIds).toEqual([]);
  });
  it.each(["option", "source", "requirement", "version", "article", "question"])("mudança posterior de %s fecha vínculo aprovado", async (change) => {
    const result = await propose(f); await syntheticApproval(f, result.proposals[0].id);
    expect((await getStudyEntitlement(f.user.id, now)).questionPublicIds).toHaveLength(1);
    if (change === "option") await db!.update(schema.questionOptions).set({ text: "Outro conteúdo" }).where(and(eq(schema.questionOptions.questionId, f.questions[0].id), eq(schema.questionOptions.optionKey, "A")));
    if (change === "source") {
      await expect(db!.update(schema.opportunitySourceDocuments).set({ status: "pending_review" }).where(eq(schema.opportunitySourceDocuments.id, f.source.id))).rejects.toThrow();
      await db!.update(schema.opportunityRequirements).set({ editorialStatus: "draft" }).where(eq(schema.opportunityRequirements.id, f.requirement.id));
      await db!.update(schema.contestOpportunities).set({ editorialStatus: "draft" }).where(eq(schema.contestOpportunities.id, f.opportunity.id));
      await db!.update(schema.opportunitySourceDocuments).set({ status: "pending_review" }).where(eq(schema.opportunitySourceDocuments.id, f.source.id));
    }
    if (change === "requirement") {
      await db!.update(schema.opportunityRequirements).set({ editorialStatus: "draft", requirementText: "Requisito alterado em outra revisão." }).where(eq(schema.opportunityRequirements.id, f.requirement.id));
      await db!.update(schema.opportunityRequirements).set({ editorialStatus: "reviewed" }).where(eq(schema.opportunityRequirements.id, f.requirement.id));
    }
    if (change === "version") await db!.update(schema.legalVersions).set({ status: "revoked" }).where(eq(schema.legalVersions.id, f.version.id));
    if (change === "article") await db!.update(schema.legalArticles).set({ literalText: "A regra fictícia foi alterada." }).where(eq(schema.legalArticles.id, f.article.id));
    if (change === "question") await db!.update(schema.questions).set({ explanation: "Uma nova explicação fictícia." }).where(eq(schema.questions.id, f.questions[0].id));
    expect((await getStudyEntitlement(f.user.id, now)).questionPublicIds).toEqual([]);
  });
  it.each(["expired", "refund", "future"])("compra %s não mantém acesso", async (state) => {
    const result = await propose(f); await syntheticApproval(f, result.proposals[0].id);
    await db!.update(schema.contestPurchases).set(state === "refund" ? { status: "revoked" } : state === "future" ? { accessStartsAt: after, accessEndsAt: new Date(after.getTime() + 86_400_000) } : { accessEndsAt: now })
      .where(and(eq(schema.contestPurchases.orderId, f.purchase.orderId), eq(schema.contestPurchases.productSlug, f.purchase.productSlug)));
    expect((await getStudyEntitlement(f.user.id, now)).questionPublicIds).toEqual([]);
  });
  it.each(["active", "trialing", "incomplete", "unpaid", "expired", "future", "null-end", "infinity"])("Master Stripe %s é validado na leitura", async (state) => {
    const [plan] = await db!.insert(schema.plans).values({ slug: `qa-${randomUUID()}`, name: "Master QA", description: "Teste", billingType: "month", amountCents: 100 }).returning();
    await db!.insert(schema.subscriptions).values({ userId: f.other.id, planId: plan.id, provider: "stripe", status: ["trialing", "incomplete", "unpaid"].includes(state) ? state : "active",
      currentPeriodStart: state === "future" ? after : before, currentPeriodEnd: state === "expired" ? now : state === "null-end" ? null : new Date(after.getTime() + 86_400_000),
      accessEndsAt: state === "null-end" ? null : new Date(after.getTime() + 86_400_000) });
    if (state === "infinity") await db!.execute(sql`update subscriptions set current_period_end='infinity',access_ends_at='infinity' where user_id=${f.other.id}`);
    expect((await getStudyEntitlement(f.other.id, now)).hasFullAccess).toBe(state === "active");
  });
  it("Master sintético documentado preserva acesso com fim finito", async () => {
    const [plan] = await db!.insert(schema.plans).values({ slug: `qa-${randomUUID()}`, name: "Master QA", description: "Teste", billingType: "month", amountCents: 100 }).returning();
    await db!.insert(schema.subscriptions).values({ userId: f.other.id, planId: plan.id, provider: "synthetic_test", status: "active", accessEndsAt: after });
    expect((await getStudyEntitlement(f.other.id, now)).hasFullAccess).toBe(true);
  });
  it("helper de QA preserva somente fixtures documentadas, sem servir ao importador real", async () => {
    expect(await bindSyntheticProductQuestions(client!, f.products[0].slug, f.questions[0].publicId)).toBe(1);
    expect((await getStudyEntitlement(f.user.id, now)).questionPublicIds).toEqual([f.questions[0].publicId]);
    expect(await bindSyntheticProductQuestions(client!, f.products[0].slug, f.questions[0].publicId)).toBe(1);
    expect(await db!.select().from(schema.contestProductQuestionBindings).where(eq(schema.contestProductQuestionBindings.productSlug, f.products[0].slug))).toHaveLength(1);
  });
  it("piso real por produto: 67 fecha, 68 e 69 permitem; vínculos repetidos não inflam a contagem", async () => {
    expect(await contentReadiness(f)).toEqual({ count: 0, ready: false });
    await addSyntheticQuestions(f, 65); // A fixture já contém duas questões distintas.
    await bindSyntheticProductQuestions(client!, f.products[0].slug);
    expect(await contentReadiness(f)).toEqual({ count: 67, ready: false });
    await addSyntheticQuestions(f, 1);
    await bindSyntheticProductQuestions(client!, f.products[0].slug);
    expect(await contentReadiness(f)).toEqual({ count: 68, ready: true });
    const [binding] = await db!.select().from(schema.contestProductQuestionBindings)
      .where(eq(schema.contestProductQuestionBindings.productSlug, f.products[0].slug));
    await db!.insert(schema.contestProductQuestionBindings).values({ ...binding, id: hash(`qa-repeated-${binding.id}`) });
    expect(await contentReadiness(f)).toEqual({ count: 68, ready: true });
    // Cargo Y compartilha a mesma oportunidade, não a curadoria comprada de X.
    expect(await contentReadiness(f, 1)).toEqual({ count: 0, ready: false });
    expect(await contentReadiness(f, 0, f.opportunity.id + 1)).toEqual({ count: 0, ready: false });
    await addSyntheticQuestions(f, 1);
    await bindSyntheticProductQuestions(client!, f.products[0].slug);
    expect(await contentReadiness(f)).toEqual({ count: 69, ready: true });
  });
  it("evidência desatualizada reduz o piso, sem retirar as demais questões de uma compra vigente", async () => {
    await addSyntheticQuestions(f, 66);
    await bindSyntheticProductQuestions(client!, f.products[0].slug);
    expect(await contentReadiness(f)).toEqual({ count: 68, ready: true });
    await db!.update(schema.questions).set({ explanation: "Explicação fictícia editada após a revisão do vínculo." })
      .where(eq(schema.questions.id, f.questions[0].id));
    expect(await contentReadiness(f)).toEqual({ count: 67, ready: false });
    expect((await getStudyEntitlement(f.user.id, now)).questionPublicIds).toHaveLength(67);
    await db!.update(schema.legalVersions).set({ status: "revoked" }).where(eq(schema.legalVersions.id, f.version.id));
    expect(await contentReadiness(f)).toEqual({ count: 0, ready: false });
  });
  it("68 propostas ou mapas com requisito pendente não satisfazem o piso editorial", async () => {
    await addSyntheticQuestions(f, 66);
    await bindSyntheticProductQuestions(client!, f.products[0].slug);
    await db!.update(schema.contestProductQuestionBindings).set({ status: "pending_review", reviewedByUserId: null,
      reviewedAt: null, reviewNotes: null }).where(eq(schema.contestProductQuestionBindings.productSlug, f.products[0].slug));
    expect(await contentReadiness(f)).toEqual({ count: 0, ready: false });
    await db!.update(schema.contestProductQuestionBindings).set({ status: "approved", reviewedByUserId: f.editor.id,
      reviewedAt: now, reviewNotes: "Aprovação SINTÉTICA exclusiva deste teste de software." })
      .where(eq(schema.contestProductQuestionBindings.productSlug, f.products[0].slug));
    await db!.update(schema.opportunityRequirements).set({ editorialStatus: "draft" }).where(eq(schema.opportunityRequirements.id, f.requirement.id));
    expect(await contentReadiness(f)).toEqual({ count: 0, ready: false });
  });
});
