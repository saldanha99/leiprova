import { and, asc, eq, isNull, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { z } from "zod";
import * as schema from "../db/schema";
import { bindingFingerprint, containsVerbatimQuote, productBindingPackageSchema } from "./product-binding-policy";

export class ProductBindingError extends Error {}
type Db = PostgresJsDatabase<typeof schema>;
type Transaction = Parameters<Parameters<Db["transaction"]>[0]>[0];
type Proposal = z.infer<typeof productBindingPackageSchema>["items"][number];

async function prepare(transaction: Transaction, item: Proposal, actorUserId: number) {
  const [product] = await transaction.select().from(schema.contestStoreProducts)
    .where(eq(schema.contestStoreProducts.slug, item.productSlug));
  const [opportunity] = await transaction.select().from(schema.contestOpportunities)
    .where(eq(schema.contestOpportunities.publicId, item.opportunityPublicId));
  const [requirement] = await transaction.select().from(schema.opportunityRequirements)
    .where(eq(schema.opportunityRequirements.id, item.requirementId));
  const [question] = await transaction.select().from(schema.questions)
    .where(eq(schema.questions.publicId, item.questionPublicId));
  if (!product || !opportunity || !requirement || !question) throw new ProductBindingError("Produto, oportunidade, requisito ou questão inexistente. Nenhum identificador é criado pelo importador.");
  if (requirement.opportunityId !== opportunity.id || (product.opportunityId !== null && product.opportunityId !== opportunity.id)) {
    throw new ProductBindingError("A proposta mistura produtos ou requisitos de oportunidades diferentes.");
  }
  if (question.sourceRights !== "original_authorial" || !["dry_law", "original_style"].includes(question.quizMode) || question.editorialStatus === "suspended") {
    throw new ProductBindingError("Somente questões autorais não suspensas podem receber propostas.");
  }
  if (!question.legalArticleId || !containsVerbatimQuote(requirement.requirementText, item.requirementQuote)) {
    throw new ProductBindingError("Falta artigo identificado ou a citação do requisito não corresponde ao texto registrado.");
  }
  const [source] = await transaction.select().from(schema.opportunitySourceDocuments)
    .where(eq(schema.opportunitySourceDocuments.id, requirement.sourceDocumentId));
  const snapshot = requirement.sourceSnapshotId === null ? null : (await transaction.select({
    id: schema.opportunityDocumentSnapshots.id, sourceDocumentId: schema.opportunityDocumentSnapshots.sourceDocumentId,
    checksumSha256: schema.opportunityDocumentSnapshots.checksumSha256, status: schema.opportunityDocumentSnapshots.status,
  }).from(schema.opportunityDocumentSnapshots)
    .where(eq(schema.opportunityDocumentSnapshots.id, requirement.sourceSnapshotId)))[0];
  if (!source || source.opportunityId !== opportunity.id || (requirement.sourceSnapshotId !== null && (!snapshot || snapshot.sourceDocumentId !== source.id))) {
    throw new ProductBindingError("Fonte ou captura não pertence ao requisito e à oportunidade indicados.");
  }
  const [legal] = await transaction.select({ article: schema.legalArticles, version: schema.legalVersions, act: schema.legalActs })
    .from(schema.legalArticles).innerJoin(schema.legalVersions, eq(schema.legalArticles.legalVersionId, schema.legalVersions.id))
    .innerJoin(schema.legalActs, eq(schema.legalVersions.legalActId, schema.legalActs.id))
    .where(eq(schema.legalArticles.id, question.legalArticleId));
  if (!legal || !legal.act.isActive || legal.version.status !== "current" || legal.article.editorialStatus !== "reviewed" ||
      legal.article.sourceRights !== "official_text" || !containsVerbatimQuote(legal.article.literalText, item.legalQuote)) {
    throw new ProductBindingError("A citação legal exige texto oficial vigente, revisado e correspondente ao artigo da questão.");
  }
  if ((requirement.legalArticleId !== null && requirement.legalArticleId !== legal.article.id) ||
      (requirement.subjectId !== null && requirement.subjectId !== question.subjectId) ||
      (requirement.topicId !== null && requirement.topicId !== question.topicId)) {
    throw new ProductBindingError("O requisito já foi mapeado para artigo, disciplina ou tópico diferente. Não será remapeado implicitamente.");
  }
  const options = await transaction.select({ optionKey: schema.questionOptions.optionKey, text: schema.questionOptions.text,
    isCorrect: schema.questionOptions.isCorrect, rationale: schema.questionOptions.rationale, sortOrder: schema.questionOptions.sortOrder })
    .from(schema.questionOptions).where(eq(schema.questionOptions.questionId, question.id)).orderBy(asc(schema.questionOptions.sortOrder));
  const assignments = await transaction.select().from(schema.opportunityOrganizerAssignments).where(and(
    eq(schema.opportunityOrganizerAssignments.opportunityId, opportunity.id), eq(schema.opportunityOrganizerAssignments.status, "reviewed"),
    isNull(schema.opportunityOrganizerAssignments.validUntil),
  ));
  const organizer = assignments.find((entry) => entry.role === "examination_provider") ?? assignments.find((entry) => entry.role === "primary_responsible");
  const profile = question.styleBankId === null ? null : (await transaction.select().from(schema.questionStyleProfiles)
    .where(eq(schema.questionStyleProfiles.quizBankId, question.styleBankId)))[0];
  const blockers: string[] = ["Revisão humana de aderência ao produto ainda não realizada."];
  if (product.opportunityId === null) blockers.push("Produto ainda sem vínculo editorial aprovado com esta oportunidade.");
  if (question.editorialStatus !== "reviewed") blockers.push("Questão ainda sem revisão editorial aprovada.");
  if (opportunity.editorialStatus !== "reviewed") blockers.push("Oportunidade ainda sem revisão aprovada.");
  if (source.status !== "approved" || (snapshot && snapshot.status !== "approved")) blockers.push("Documento ou captura ainda sem aprovação.");
  if (requirement.editorialStatus !== "reviewed" || !requirement.legalArticleId || !requirement.subjectId || !requirement.topicId) blockers.push("Requisito ainda exige mapeamento e revisão humana.");
  if (question.quizMode === "original_style" && (!organizer || organizer.quizBankId !== question.styleBankId || !profile?.isActive || profile.format !== question.type)) {
    blockers.push("Banca organizadora/perfil de estilo não corresponde à questão.");
  }
  const evidence = {
    schemaVersion: 1, purpose: "proposed_product_scope", publicationAllowed: false,
    opportunityPublicId: opportunity.publicId, questionPublicId: question.publicId,
    questionContent: { prompt: question.prompt, explanation: question.explanation, type: question.type, learningObjective: question.learningObjective, options },
    legalArticleText: legal.article.literalText, legalSourceUrl: legal.version.sourceUrl,
    sourceUrl: source.sourceUrl, sourcePublicId: source.publicId,
    bankProfileVersion: profile?.version ?? null, organizerAssignmentId: organizer?.id ?? null,
    observedStates: { question: question.editorialStatus, requirement: requirement.editorialStatus, source: source.status,
      snapshot: snapshot?.status ?? null, opportunity: opportunity.editorialStatus, product: product.status },
    blockers,
  };
  const values = {
    productSlug: product.slug, opportunityId: opportunity.id, requirementId: requirement.id, questionId: question.id,
    sourceDocumentId: source.id, sourceSnapshotId: snapshot?.id ?? null, sourceSnapshotChecksum: snapshot?.checksumSha256 ?? null,
    legalArticleId: legal.article.id, legalVersionId: legal.version.id, legalVersionChecksum: legal.version.checksumSha256,
    questionUpdatedAt: question.updatedAt, requirementText: requirement.requirementText, sourceLocator: requirement.sourceLocator,
    requirementQuote: item.requirementQuote, legalQuote: item.legalQuote, scopeNotes: item.scopeNotes, evidence, proposedByUserId: actorUserId,
  };
  return { values: { id: bindingFingerprint(values), ...values }, questionPublicId: question.publicId, blockers };
}

/** Não é um publicador. Importa evidências pendentes sem alterar questão, edital, produto ou mapa legado. */
export async function importProductQuestionBindings(db: Db, request: {
  input: unknown; actorPublicId: string; mode: "preview" | "import-pending"; expectedFingerprint?: string;
}) {
  if (!["preview", "import-pending"].includes(request.mode)) throw new ProductBindingError("Modo inválido; este operador nunca aprova vínculos.");
  if (request.mode === "import-pending" && !/^[a-f0-9]{64}$/u.test(request.expectedFingerprint ?? "")) throw new ProductBindingError("Confira o preview e informe sua impressão digital.");
  const input = productBindingPackageSchema.parse(request.input);
  z.uuid().parse(request.actorPublicId);
  return db.transaction(async (transaction) => {
    await transaction.execute(sql`set local statement_timeout = '30s'`);
    await transaction.execute(sql`set local lock_timeout = '5s'`);
    const [actor] = await transaction.select({ id: schema.users.id, role: schema.users.role }).from(schema.users)
      .where(eq(schema.users.publicId, request.actorPublicId));
    if (!actor || !["admin", "editor"].includes(actor.role)) throw new ProductBindingError("Operador editorial inexistente ou sem papel autorizado.");
    const prepared = [];
    for (const item of input.items) prepared.push(await prepare(transaction, item, actor.id));
    const fingerprint = bindingFingerprint(prepared.map((item) => item.values).sort((a, b) => a.id.localeCompare(b.id)));
    if (request.mode === "import-pending" && request.expectedFingerprint !== fingerprint) throw new ProductBindingError("Pacote ou contexto mudou; faça novo preview.");
    let created = 0, reused = 0, wouldCreate = 0;
    for (const item of prepared) {
      const [existing] = await transaction.select({ id: schema.contestProductQuestionBindings.id }).from(schema.contestProductQuestionBindings)
        .where(eq(schema.contestProductQuestionBindings.id, item.values.id));
      if (existing) { reused++; continue; }
      wouldCreate++;
      if (request.mode === "preview") continue;
      // Lista explícita: o Drizzle inclui DEFAULT também nas colunas de revisão,
      // o que exigiria ampliar INSERT justamente para campos que o app não pode escrever.
      const value = item.values;
      const inserted = await transaction.execute<{ id: string }>(sql`
        insert into contest_product_question_bindings (
          id, product_slug, opportunity_id, requirement_id, question_id, source_document_id,
          source_snapshot_id, source_snapshot_checksum, legal_article_id, legal_version_id,
          legal_version_checksum, question_updated_at, requirement_text, source_locator,
          requirement_quote, legal_quote, scope_notes, evidence, proposed_by_user_id
        ) values (${value.id},${value.productSlug},${value.opportunityId},${value.requirementId},${value.questionId},${value.sourceDocumentId},
          ${value.sourceSnapshotId},${value.sourceSnapshotChecksum},${value.legalArticleId},${value.legalVersionId},
          ${value.legalVersionChecksum},${value.questionUpdatedAt.toISOString()}::timestamptz,${value.requirementText},${value.sourceLocator},
          ${value.requirementQuote},${value.legalQuote},${value.scopeNotes},${JSON.stringify(value.evidence)}::jsonb,${value.proposedByUserId})
        on conflict(id) do nothing returning id
      `);
      if (!inserted.length) { reused++; continue; }
      created++;
      await transaction.insert(schema.auditLogs).values({ actorUserId: actor.id, action: "editorial.product_binding.proposed",
        entityType: "contest_product_question_binding", entityId: item.values.id,
        metadata: { productSlug: item.values.productSlug, questionPublicId: item.questionPublicId, requirementId: item.values.requirementId,
          packageFingerprint: fingerprint, status: "pending_review", publicationAllowed: false, humanReviewRecorded: false } });
    }
    return { mode: request.mode, fingerprint, total: prepared.length, created, wouldCreate, reused, publicationAllowed: false as const,
      proposals: prepared.map((item) => ({ id: item.values.id, productSlug: item.values.productSlug,
        questionPublicId: item.questionPublicId, requirementId: item.values.requirementId, blockers: item.blockers })) };
  }, { isolationLevel: "repeatable read", ...(request.mode === "preview" ? { accessMode: "read only" as const } : {}) });
}
