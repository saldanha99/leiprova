import { createHash, randomUUID } from "node:crypto";

import postgres from "postgres";

import { OFFICIAL_COURSE_STANDING_REFERENCE } from "@/lib/editorial/official-course-dossier";
import { buildNextOfficialCoursePreview, NEXT_OFFICIAL_COURSE_RECIPES, type NextOfficialCourseRecipe, type ProgrammeSection } from "@/lib/editorial/official-course-preview-candidates";
import { saoPauloCalendarDate } from "@/lib/opportunities/catalog-policy";
import { parseOpportunityApprovalReviewerIdentity } from "@/lib/opportunities/approval-command";
import { requireStandingCourseMaintenanceDatabaseUrl, assertStandingCourseProductUpdate, assertStandingCourseStageMetadata } from "@/lib/editorial/official-course-admission";
import type { CapturedOfficialDocument } from "@/lib/opportunities/official-document-fetch";
import { checkOpportunitySourceMetadata } from "@/lib/opportunities/source-metadata-check";
import type { OpportunitySourceMetadata } from "@/lib/opportunities/source-monitor-policy";
import { verifyOfficialExamUrl } from "@/lib/official-sources/fetch";

const FGV = "https://conhecimento.fgv.br/sites/default/files/concursos/";
export const COMPOSITE_ADMISSION_TARGETS = [
  { productSlug: "mpe-rj-promotor-de-justica-2026", slug: "mprj-promotor-substituto-xxxix-2026-historico-objetiva", acronym: "MPRJ", notice: "XXXIX/2026", category: "carreiras-juridicas", career: "promotor-justica", noticeDate: "2026-03-12", statusDate: "2026-10-06", commission: "Comissão do XXXIX Concurso do MPRJ", stages: [
    { title: "Republicação — habilitados à inscrição definitiva", url: `${FGV}05.10-aviso-relacao-de-habilitados-a-inscricao-definitiva-republicacao.pdf`, publishedOn: "2026-10-06" },
  ] },
  { productSlug: "pge-ac-procurador-do-estado-reta-final", slug: "pgeac-procurador-classe-i-viii-2026-historico-objetiva", acronym: "PGEAC", notice: "VIII/2026", category: "procuradorias", career: "procurador", noticeDate: "2026-02-26", statusDate: "2026-10-05", commission: "Comissão do VIII Concurso da PGE-AC", stages: [
    { title: "Resultado definitivo da prova objetiva", url: `${FGV}529_pge-ac-resultado-definitivo-prova-objetiva-2026-07-06.pdf`, publishedOn: "2026-07-15" },
    { title: "Resultado preliminar da prova escrita subjetiva", url: `${FGV}529_pge-ac_resultado-preliminar-discursiva-2026-09-29_0.pdf`, publishedOn: "2026-10-05" },
  ] },
] as const;

export function compositeCourseTarget(productSlug: string) {
  const target = COMPOSITE_ADMISSION_TARGETS.find((item) => item.productSlug === productSlug);
  const recipe = NEXT_OFFICIAL_COURSE_RECIPES.find((item) => item.productSlug === productSlug);
  if (!target || !recipe) throw new Error("Operador delimitado exclusivamente a MPRJ XXXIX e PGE-AC VIII.");
  return { target, recipe };
}

export function assertCompositeHashes(recipe: NextOfficialCourseRecipe, expected: ReadonlyMap<string, string>, programmeHash: string) {
  if (!/^[a-f0-9]{64}$/u.test(programmeHash) || expected.size !== recipe.documents.length
    || recipe.documents.some((doc) => !/^[a-f0-9]{64}$/u.test(expected.get(doc.key) ?? ""))) throw new Error("Exige conjunto exato de hashes de todos os documentos e programa composto.");
}

export function assertCompositeFreshness(observedAt: string, now = Date.now()) {
  const age = now - Date.parse(observedAt);
  if (!Number.isFinite(age) || age < -60_000 || age > 15 * 60_000) throw new Error("Evidência ausente, futura ou vencida; recapture as fontes nesta execução.");
}

/** Group literal numbered topics with their continuation lines, never reassign legal articles. */
export function compositeProgrammeRequirements(sections: readonly ProgrammeSection[]) {
  const output: { documentKey: string; requirementText: string; sourceLocator: string }[] = [];
  const seen = new Set<string>();
  for (const section of sections) {
    let pending: { text: string; first: number; last: number } | null = null;
    let pointHeading = "";
    const flush = () => {
      if (!pending) return;
      const key = `${section.documentKey}\0${pending.text}`;
      if (seen.has(key)) throw new Error("Requisito literal duplicado na mesma fonte; revisão própria necessária.");
      seen.add(key);
      output.push({ documentKey: section.documentKey, requirementText: pending.text, sourceLocator: `${section.documentKey} · ${section.subject} · p. ${pending.first}${pending.last === pending.first ? "" : `–${pending.last}`}` });
      pending = null;
    };
    for (const fragment of section.fragments) {
      if (!fragment.text.trim() || !Number.isSafeInteger(fragment.page) || fragment.page <= 0) throw new Error("Fragmento sem texto/localizador válido.");
      if (/^Ponto\s+(?:n[ºo°]\s*)?\d+\.?$/iu.test(fragment.text)) {
        flush(); pointHeading = fragment.text; continue;
      }
      if (/^(?:Ponto\s+(?:n[ºo°]\s*)?\d+\.|\d+(?:\.\d+)*[.)]?\s|[a-z]\)\s)/iu.test(fragment.text)) flush();
      if (!pending) pending = { text: `${pointHeading ? `${pointHeading} ` : ""}${fragment.text}`, first: fragment.page, last: fragment.page };
      else { pending.text += ` ${fragment.text}`; pending.last = fragment.page; }
    }
    flush();
  }
  if (!output.length || output.length > 3000) throw new Error("Programa sem requisitos ou excede limite delimitado.");
  return output;
}

export async function verifyCompositeMetadata(productSlug: string) {
  const { target, recipe } = compositeCourseTarget(productSlug);
  const stages: OpportunitySourceMetadata[] = [];
  for (const stage of target.stages) {
    const metadata = await checkOpportunitySourceMetadata({ sourceId: "fgv-conhecimento", publisher: "FGV Conhecimento", url: stage.url, documentType: "official_announcement", status: "pending_review", sourcePolicy: "metadata_only", sourceContentStored: false });
    if (metadata.httpStatus !== 200) throw new Error("Marco da fase não retornou HTTP200; admissão bloqueada.");
    assertStandingCourseStageMetadata(metadata, stage.url);
    stages.push(metadata);
  }
  const previous: Record<string, unknown>[] = [];
  for (const doc of recipe.previousExam.documents) {
    const metadata = await verifyOfficialExamUrl("fgv", doc.url);
    if (metadata.httpStatus !== 200 || !metadata.isPdf || metadata.finalUrl !== doc.url) throw new Error("Link oficial de prova/gabarito não verificado; não presumir disponibilidade.");
    previous.push({ ...doc, ...metadata, distributionMode: "external_link", sourceContentStored: false, approvedForProduct: false });
  }
  return { stages, previous, observedAt: new Date().toISOString() };
}

export async function admitCompositeOfficialCourse(input: Readonly<{
  productSlug: string; captures: ReadonlyMap<string, CapturedOfficialDocument>; capturedAt: ReadonlyMap<string, string>;
  expectedHashes: ReadonlyMap<string, string>; expectedProgrammeHash: string;
}>) {
  const { target, recipe } = compositeCourseTarget(input.productSlug);
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(recipe.examDate) || recipe.examDate >= saoPauloCalendarDate(new Date())) throw new Error("Histórico exige data civil de prova passada comprovada no edital.");
  assertCompositeHashes(recipe, input.expectedHashes, input.expectedProgrammeHash);
  if (process.env.OPPORTUNITY_APPROVAL_REFERENCE !== OFFICIAL_COURSE_STANDING_REFERENCE) throw new Error("Referência exata da decisão de fontes/programas obrigatória.");
  const databaseUrl = requireStandingCourseMaintenanceDatabaseUrl(process.env.MIGRATION_DATABASE_URL);
  if (input.captures.size !== recipe.documents.length || input.capturedAt.size !== recipe.documents.length) throw new Error("Capturas excedentes ou ausentes.");
  for (const doc of recipe.documents) {
    const capture = input.captures.get(doc.key);
    assertCompositeFreshness(input.capturedAt.get(doc.key) ?? "");
    if (!capture || capture.checksumSha256 !== input.expectedHashes.get(doc.key)
      || createHash("sha256").update(capture.documentBytes).digest("hex") !== input.expectedHashes.get(doc.key)) throw new Error("Fonte mudou desde a prévia conferida; aplicação bloqueada.");
  }
  const evidence = await verifyCompositeMetadata(input.productSlug);
  const preview = buildNextOfficialCoursePreview(recipe, input.captures, new Date().toISOString(), evidence.previous);
  if (preview.programme.checksumSha256 !== input.expectedProgrammeHash) throw new Error("Composição do programa mudou desde a prévia conferida.");
  const requirementCandidates = compositeProgrammeRequirements(preview.programme.sections);
  const reviewer = parseOpportunityApprovalReviewerIdentity({ ADMIN_EMAILS: process.env.ADMIN_EMAILS, OPPORTUNITY_APPROVAL_REFERENCE: process.env.OPPORTUNITY_APPROVAL_REFERENCE });
  const client = postgres(databaseUrl, { max: 1, prepare: false });
  const note = `Revisão automatizada de fontes/programa sob owner_standing_authorization (${reviewer.approvalReference}); humanReview:false. Treino histórico da etapa objetiva com legislação atual; mapeamento/vigência/perfil/inéditas ainda pendentes. FGV presta a objetiva; demais etapas seguem a responsabilidade institucional do edital. Não é liberação comercial.`;
  try {
    return await client.begin("isolation level serializable", async (tx) => {
      await tx`set local statement_timeout = '30s'`;
      await tx`set local lock_timeout = '5s'`;
      const operators = reviewer.email ? await tx<{ id: string; role: string }[]>`select id::text, role from users where lower(email) = ${reviewer.email} limit 2 for key share`
        : await tx<{ id: string; role: string }[]>`select id::text, role from users where role = 'admin' limit 2 for key share`;
      if (operators.length !== 1 || operators[0].role !== "admin") throw new Error("Exige administrador único identificado.");
      const actor = operators[0].id;
      await tx`select public.lock_product_binding_review_product(${recipe.productSlug})`;
      const products = await tx<{ opportunityId: string | null; status: string }[]>`select opportunity_id::text as "opportunityId", status from contest_store_products where slug = ${recipe.productSlug} for update`;
      if (products.length !== 1 || products[0].status !== "draft" || products[0].opportunityId !== null) throw new Error("Somente produto draft sem edição; não sobrescrever revisão existente.");
      const existing = await tx`select id from contest_opportunities where slug = ${target.slug} or (institution_acronym = ${target.acronym} and official_notice_number = ${target.notice} and cycle_year = 2026) or (institution_name = ${recipe.institution} and role_name = ${recipe.role} and cycle_year = 2026) limit 1`;
      if (existing.length) throw new Error("Edição já existente; admissão não duplica nem sobrescreve.");
      const catalog = await tx<{ categoryId: string; careerId: string; bankId: string }[]>`select category.id::text as "categoryId", career.id::text as "careerId", bank.id::text as "bankId"
        from contest_categories category join contest_category_careers link on link.category_id = category.id
        join quiz_career_tracks career on career.id = link.career_track_id cross join quiz_banks bank
        where category.slug = ${target.category} and career.slug = ${target.career} and bank.slug = 'fgv' and category.is_active and career.is_active and bank.is_active`;
      if (catalog.length !== 1) throw new Error("Categoria, carreira e banca não conferidas no catálogo ativo.");
      const now = new Date().toISOString();
      for (const stamp of input.capturedAt.values()) assertCompositeFreshness(stamp);
      for (const stage of evidence.stages) assertCompositeFreshness(stage.observedAt);
      const opportunityPublicId = randomUUID();
      const [opportunity] = await tx<{ id: string }[]>`insert into contest_opportunities (public_id, slug, category_id, career_track_id, jurisdiction_code, scope, cycle_year,
        institution_acronym, institution_name, role_name, official_notice_number, title, summary, lifecycle_status, status_as_of, official_url,
        notice_published_at, exam_date, source_checked_at, editorial_status)
        values (${opportunityPublicId}, ${target.slug}, ${catalog[0].categoryId}, ${catalog[0].careerId}, ${recipe.jurisdiction}, 'state', 2026,
          ${target.acronym}, ${recipe.institution}, ${recipe.role}, ${target.notice}, ${`${target.acronym} — treino histórico objetivo ${recipe.cycle}`},
          ${`Programa composto com retificações/republicações oficiais. ${recipe.stage}. Treino histórico objetivo; legislação atual e inéditas exigem preparação própria. Não anuncia edição futura.`},
          'result_published', ${target.statusDate}, ${recipe.documents[0].url}, ${target.noticeDate}, ${recipe.examDate}, ${now}, 'draft') returning id::text`;
      const identities = new Map<string, { sourceId: string; snapshotId: string; sourcePublicId: string; snapshotPublicId: string }>();
      for (const doc of recipe.documents) {
        const capture = input.captures.get(doc.key)!;
        const sourcePublicId = randomUUID();
        const snapshotPublicId = randomUUID();
        const [source] = await tx<{ id: string }[]>`insert into opportunity_source_documents (public_id, opportunity_id, document_type, title, source_url, source_host,
          observed_at, last_seen_at, checksum_sha256, http_status, content_type, source_policy, source_content_stored, status, reviewed_by_user_id, reviewed_at, review_notes)
          values (${sourcePublicId}, ${opportunity.id}, ${doc.key.endsWith("notice") ? "notice" : doc.key.includes("programme") ? "official_announcement" : "correction"}, ${doc.title}, ${capture.documentUrl}, ${capture.sourceHost},
            ${input.capturedAt.get(doc.key)!}, ${input.capturedAt.get(doc.key)!}, ${capture.checksumSha256}, 200, 'application/pdf', 'official_document', true, 'approved', ${actor}, ${now}, ${note}) returning id::text`;
        const [snapshot] = await tx<{ id: string }[]>`insert into opportunity_document_snapshots (public_id, source_document_id, document_url, source_host, file_name, mime_type,
          document_bytes, checksum_sha256, byte_length, page_count, extracted_text, page_texts, text_length, parser_version,
          source_policy, authorization_scope, authorized_at, authorized_by_user_id, status, approval_basis, reviewed_by_user_id, reviewed_at, review_notes)
          values (${snapshotPublicId}, ${source.id}, ${capture.documentUrl}, ${capture.sourceHost}, ${capture.fileName}, 'application/pdf', ${capture.documentBytes},
            ${capture.checksumSha256}, ${capture.byteLength}, ${capture.pageCount}, ${capture.extractedText}, ${tx.json(capture.pageTexts)},
            ${capture.textLength}, ${capture.parserVersion}, 'official_document', 'owner-approval-2026-09-01', ${now}, ${actor}, 'approved', 'owner_override', ${actor}, ${now}, ${note}) returning id::text`;
        identities.set(doc.key, { sourceId: source.id, snapshotId: snapshot.id, sourcePublicId, snapshotPublicId });
      }
      const stageSourcePublicIds: string[] = [];
      for (const [index, stage] of evidence.stages.entries()) {
        const publicId = randomUUID(); stageSourcePublicIds.push(publicId);
        await tx`insert into opportunity_source_documents (public_id, opportunity_id, document_type, title, source_url, source_host, published_at,
          observed_at, last_seen_at, http_status, content_type, source_policy, source_content_stored, status, reviewed_by_user_id, reviewed_at, review_notes)
          values (${publicId}, ${opportunity.id}, 'result', ${target.stages[index].title}, ${stage.url}, ${stage.hostname}, ${target.stages[index].publishedOn},
            ${stage.observedAt}, ${stage.observedAt}, ${stage.httpStatus}, ${stage.contentType}, 'metadata_only', false, 'approved', ${actor}, ${now}, ${note})`;
      }
      const noticeSource = identities.get(recipe.documents[0].key)!;
      await tx`insert into opportunity_organizer_assignments (opportunity_id, quiz_bank_id, source_document_id, responsible_type, role, organizer_slug,
        organizer_name, valid_from, status, reviewed_by_user_id, reviewed_at, review_notes)
        values (${opportunity.id}, null, ${noticeSource.sourceId}, 'institutional_commission', 'primary_responsible', ${target.acronym.toLowerCase()}, ${target.commission}, ${target.noticeDate}, 'reviewed', ${actor}, ${now}, ${note}),
          (${opportunity.id}, ${catalog[0].bankId}, ${noticeSource.sourceId}, 'external_organizer', 'examination_provider', 'fgv', 'Fundação Getulio Vargas — etapa objetiva', ${target.noticeDate}, 'reviewed', ${actor}, ${now}, ${note})`;
      // Approved source and organizer must precede transition from draft (publication trigger).
      await tx`update contest_opportunities set editorial_status = 'reviewed', published_at = ${now}, reviewed_by_user_id = ${actor}, reviewed_at = ${now}, review_notes = ${note}, updated_at = ${now} where id = ${opportunity.id} and editorial_status = 'draft'`;
      const rows = requirementCandidates.map((item) => ({ opportunity_id: opportunity.id, source_document_id: identities.get(item.documentKey)!.sourceId,
        source_snapshot_id: identities.get(item.documentKey)!.snapshotId, requirement_text: item.requirementText, source_locator: item.sourceLocator,
        subject_id: null, topic_id: null, legal_act_id: null, legal_article_id: null, editorial_status: "reviewed", reviewed_by_user_id: actor, reviewed_at: now, review_notes: note }));
      // Small batches preserve parameter limits without creating one query per fragment.
      let count = 0;
      for (let offset = 0; offset < rows.length; offset += 100) {
        const inserted = await tx`insert into opportunity_requirements ${tx(rows.slice(offset, offset + 100))} returning id`;
        count += inserted.length;
      }
      if (count !== requirementCandidates.length) throw new Error("Inserção incompleta de requisitos; transação cancelada.");
      const updated = await tx<{ slug: string }[]>`update contest_store_products set opportunity_id = ${opportunity.id}, preparation_mode = 'historical_training',
        preparation_reviewed_at = ${now}, preparation_reviewed_by_user_id = ${actor}, preparation_approval_reference = ${reviewer.approvalReference},
        preparation_opportunity_updated_at = (select updated_at from contest_opportunities where id = ${opportunity.id}), updated_at = ${now}
        where slug = ${recipe.productSlug} and status = 'draft' and opportunity_id is null returning slug`;
      assertStandingCourseProductUpdate(updated, recipe.productSlug);
      const metadata = { approvalBasis: "owner_standing_authorization", approvalReference: reviewer.approvalReference, humanReview: false, executionSource: "server_cli",
        productSlug: recipe.productSlug, opportunityPublicId, sources: [...identities.entries()].map(([key, ids]) => ({ key, ...ids, checksumSha256: input.captures.get(key)!.checksumSha256 })),
        examDate: recipe.examDate, examDateEvidence: recipe.examDateEvidence, stageSourcePublicIds, stageEvidence: evidence.stages, bankScope: recipe.bankScope, objectiveStageAlreadyHeld: true,
        programmeChecksumSha256: preview.programme.checksumSha256, effectiveSubjects: preview.programme.sections.length, supersededSections: preview.programme.superseded,
        requirements: count, legalMappingsApproved: 0, questionsApproved: 0, productsReleased: 0, productStatus: "draft", preparationMode: "historical_training",
        previousExam: preview.previousExam, snapshotStorageApprovalBasis: "owner_override", snapshotCaptureScope: "owner-approval-2026-09-01" };
      const [audit] = await tx<{ id: string }[]>`insert into audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
        values (${actor}, 'editorial.official_course.composite_standing_admitted', 'contest_opportunity', ${opportunityPublicId}, ${tx.json(metadata as postgres.JSONValue)}) returning id::text`;
      return { mode: "applied", ...metadata, auditId: audit.id };
    });
  } finally { await client.end(); }
}
