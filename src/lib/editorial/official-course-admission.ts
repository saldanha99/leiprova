import { randomUUID } from "node:crypto";

import postgres from "postgres";

import { buildOfficialCourseDossierPreview, OFFICIAL_COURSE_STANDING_REFERENCE, type OfficialCourseDossierRecipe } from "@/lib/editorial/official-course-dossier";
import type { CapturedOfficialDocument } from "@/lib/opportunities/official-document-fetch";
import { parseOpportunityApprovalReviewerIdentity, requireOpportunityApprovalDatabaseUrl } from "@/lib/opportunities/approval-command";
import { checkOpportunitySourceMetadata, classifyOpportunitySourceHttpStatus } from "@/lib/opportunities/source-metadata-check";

export function assertStandingCourseAdmission(productSlug: string, expectedHash: string, actualHash: string, approvalReference: string | undefined) {
  if (productSlug !== "mpe-mt-promotor-de-justica-2026") throw new Error("Admissão delimitada somente ao MPMT; MPGO permanece bloqueado por divergência cronológica.");
  if (!/^[a-f0-9]{64}$/u.test(expectedHash) || expectedHash !== actualHash) throw new Error("Fingerprint ausente ou diferente da prévia conferida.");
  if (approvalReference !== OFFICIAL_COURSE_STANDING_REFERENCE) throw new Error("Referência exata da autorização de fontes/programas obrigatória.");
}

export function requireStandingCourseMaintenanceDatabaseUrl(databaseUrl: string | undefined) {
  const validated = requireOpportunityApprovalDatabaseUrl({ MIGRATION_DATABASE_URL: databaseUrl });
  const target = new URL(validated);
  if (decodeURIComponent(target.username) !== "leiprova_owner" || target.pathname !== "/leiprova") {
    throw new Error("Use o acesso de manutenção leiprova_owner ao banco leiprova; outros projetos ficam fora deste operador.");
  }
  return validated;
}

export function assertStandingCourseProductUpdate(rows: readonly { slug: string }[], productSlug: string) {
  if (rows.length !== 1 || rows[0].slug !== productSlug) throw new Error("Vínculo do produto não atualizou exatamente o alvo esperado; transação cancelada.");
}

/** New MPMT baseline only. Existing reviewed opportunities are never overwritten. */
export async function admitStandingOfficialCourse(recipe: OfficialCourseDossierRecipe, document: CapturedOfficialDocument, expectedHash: string) {
  assertStandingCourseAdmission(recipe.productSlug, expectedHash, document.checksumSha256, process.env.OPPORTUNITY_APPROVAL_REFERENCE);
  const databaseUrl = requireStandingCourseMaintenanceDatabaseUrl(process.env.MIGRATION_DATABASE_URL);
  const preview = buildOfficialCourseDossierPreview(recipe, document, new Date().toISOString());
  if (!preview.programmeRequirements.length) throw new Error("Programa sem requisitos reconhecidos; admissão bloqueada.");
  const stageEvidenceUrl = "https://conhecimento.fgv.br/sites/default/files/concursos/comunicado_n_05_2026_resultado_definitivo_p_objetiva_04_08_2026_assinado.pdf";
  const stage = await checkOpportunitySourceMetadata({ sourceId: "fgv-conhecimento", publisher: "FGV Conhecimento", url: stageEvidenceUrl,
    documentType: "official_announcement", status: "pending_review", sourcePolicy: "metadata_only", sourceContentStored: false });
  if (classifyOpportunitySourceHttpStatus(stage.httpStatus) !== "verified") throw new Error("Marco oficial do resultado indisponível; admissão bloqueada.");
  const reviewer = parseOpportunityApprovalReviewerIdentity({ ADMIN_EMAILS: process.env.ADMIN_EMAILS, OPPORTUNITY_APPROVAL_REFERENCE: process.env.OPPORTUNITY_APPROVAL_REFERENCE });
  const client = postgres(databaseUrl, { max: 1, prepare: false });
  const note = `Revisão automatizada sob owner_standing_authorization (${reviewer.approvalReference}); humanReview:false. Programa do edital 01/2026 compilado; treino histórico objetivo com legislação atual. Sem aprovação de vínculos legais ou questões.`;
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
      if (products.length !== 1 || products[0].status !== "draft" || products[0].opportunityId !== null) throw new Error("Só admite produto rascunho sem edição; registro existente exige fluxo de revisão próprio.");
      const slug = "mpmt-promotor-substituto-2026-historico-objetiva";
      const existing = await tx`select id from contest_opportunities where slug = ${slug} or (institution_acronym = 'MPMT' and official_notice_number = '01/2026' and cycle_year = 2026) limit 1`;
      if (existing.length) throw new Error("Edição MPMT já existe; não sobrescrever revisão nem duplicar identidade.");
      const catalog = await tx<{ categoryId: string; careerId: string; bankId: string }[]>`
        select category.id::text as "categoryId", career.id::text as "careerId", bank.id::text as "bankId"
        from contest_categories category join contest_category_careers link on link.category_id = category.id
        join quiz_career_tracks career on career.id = link.career_track_id
        cross join quiz_banks bank where category.slug = 'carreiras-juridicas' and career.slug = 'promotor-justica'
          and bank.slug = 'fgv' and category.is_active and career.is_active and bank.is_active`;
      if (catalog.length !== 1) throw new Error("Categoria, carreira ou banca não conferidas no catálogo ativo.");
      const now = new Date().toISOString();
      const opportunityPublicId = randomUUID();
      const [opportunity] = await tx<{ id: string }[]>`
        insert into contest_opportunities (public_id, slug, category_id, career_track_id, jurisdiction_code, scope, cycle_year,
          institution_acronym, institution_name, role_name, official_notice_number, title, summary, lifecycle_status, status_as_of,
          official_url, notice_published_at, exam_date, source_checked_at, editorial_status, published_at, reviewed_by_user_id, reviewed_at, review_notes)
        values (${opportunityPublicId}, ${slug}, ${catalog[0].categoryId}, ${catalog[0].careerId}, 'MT', 'state', 2026,
          'MPMT', ${recipe.institution}, ${recipe.role}, '01/2026', 'MPMT — treino histórico da prova preambular objetiva 2026',
          'Programa do Edital 01/2026 compilado até 20/07/2026; legislação atual. Resultado definitivo da objetiva divulgado em 04/08/2026. Não anuncia edital futuro ou simulado de prova oral.',
          'result_published', '2026-08-04', ${recipe.noticeUrl}, '2026-03-17', '2026-06-14', ${now}, 'reviewed', ${now}, ${actor}, ${now}, ${note}) returning id::text`;
      const sourcePublicId = randomUUID();
      const [source] = await tx<{ id: string }[]>`
        insert into opportunity_source_documents (public_id, opportunity_id, document_type, title, source_url, source_host,
          observed_at, last_seen_at, checksum_sha256, http_status, content_type, source_policy, source_content_stored,
          status, reviewed_by_user_id, reviewed_at, review_notes)
        values (${sourcePublicId}, ${opportunity.id}, 'notice', ${recipe.title}, ${document.documentUrl}, ${document.sourceHost},
          ${now}, ${now}, ${document.checksumSha256}, 200, 'application/pdf', 'official_document', true, 'approved', ${actor}, ${now}, ${note}) returning id::text`;
      const stageSourcePublicId = randomUUID();
      await tx`
        insert into opportunity_source_documents (public_id, opportunity_id, document_type, title, source_url, source_host,
          observed_at, last_seen_at, http_status, content_type, source_policy, source_content_stored, status,
          reviewed_by_user_id, reviewed_at, review_notes)
        values (${stageSourcePublicId}, ${opportunity.id}, 'result', 'Comunicado 05/2026 — resultado definitivo da prova preambular objetiva',
          ${stage.url}, ${stage.hostname}, ${stage.observedAt}, ${stage.observedAt}, ${stage.httpStatus}, ${stage.contentType},
          'metadata_only', false, 'approved', ${actor}, ${now}, ${note})`;
      const snapshotPublicId = randomUUID();
      const [snapshot] = await tx<{ id: string }[]>`
        insert into opportunity_document_snapshots (public_id, source_document_id, document_url, source_host, file_name, mime_type,
          document_bytes, checksum_sha256, byte_length, page_count, extracted_text, page_texts, text_length, parser_version,
          source_policy, authorization_scope, authorized_at, authorized_by_user_id, status, approval_basis, reviewed_by_user_id, reviewed_at, review_notes)
        values (${snapshotPublicId}, ${source.id}, ${document.documentUrl}, ${document.sourceHost}, ${document.fileName}, 'application/pdf',
          ${document.documentBytes}, ${document.checksumSha256}, ${document.byteLength}, ${document.pageCount}, ${document.extractedText},
          ${JSON.stringify(document.pageTexts)}::jsonb, ${document.textLength}, ${document.parserVersion}, 'official_document',
          'owner-approval-2026-09-01', ${now}, ${actor}, 'approved', 'owner_override', ${actor}, ${now}, ${note}) returning id::text`;
      await tx`
        insert into opportunity_organizer_assignments (opportunity_id, quiz_bank_id, source_document_id, responsible_type, role,
          organizer_slug, organizer_name, valid_from, status, reviewed_by_user_id, reviewed_at, review_notes)
        values (${opportunity.id}, null, ${source.id}, 'institutional_commission', 'primary_responsible', 'mpmt', 'Comissão de Concurso do MPMT', '2026-03-17', 'reviewed', ${actor}, ${now}, ${note}),
          (${opportunity.id}, ${catalog[0].bankId}, ${source.id}, 'external_organizer', 'examination_provider', 'fgv', 'Fundação Getulio Vargas', '2026-03-17', 'reviewed', ${actor}, ${now}, ${note})`;
      // Source programme review does not approve a mapping to any legal article.
      const requirementRows = preview.programmeRequirements.map((item) => ({ opportunity_id: opportunity.id, source_document_id: source.id,
        source_snapshot_id: snapshot.id, requirement_text: item.requirementText, source_locator: item.sourceLocator,
        editorial_status: "reviewed", reviewed_by_user_id: actor, reviewed_at: now, review_notes: note }));
      const requirements = await tx`insert into opportunity_requirements ${tx(requirementRows)} returning id::text`;
      const updatedProducts = await tx<{ slug: string }[]>`update contest_store_products set opportunity_id = ${opportunity.id}, preparation_mode = 'historical_training',
        preparation_reviewed_at = ${now}, preparation_reviewed_by_user_id = ${actor}, preparation_approval_reference = ${reviewer.approvalReference},
        preparation_opportunity_updated_at = (select updated_at from contest_opportunities where id = ${opportunity.id}), updated_at = ${now}
        where slug = ${recipe.productSlug} and status = 'draft' and opportunity_id is null returning slug`;
      assertStandingCourseProductUpdate(updatedProducts, recipe.productSlug);
      const metadata = { approvalBasis: "owner_standing_authorization", approvalReference: reviewer.approvalReference, humanReview: false,
        executionSource: "server_cli", productSlug: recipe.productSlug, opportunityPublicId, sourcePublicId, stageSourcePublicId, snapshotPublicId,
        checksumSha256: document.checksumSha256, programmeChecksumSha256: preview.programme.checksumSha256,
        programmePages: [33, 64], requirements: requirements.length, legalMappingsApproved: 0, questionsApproved: 0, productsReleased: 0,
        snapshotStorageApprovalBasis: "owner_override", snapshotCaptureScope: "owner-approval-2026-09-01",
        historicalScope: "objective_preambular_current_legislation", stageEvidenceUrl, stageMetadataObservedAt: stage.observedAt, stageHttpStatus: stage.httpStatus,
        stageEtag: stage.etag, stageLastModified: stage.lastModified, stageContentStored: false };
      const [audit] = await tx<{ id: string }[]>`insert into audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
        values (${actor}, 'editorial.official_course.standing_admitted', 'contest_opportunity', ${opportunityPublicId}, ${JSON.stringify(metadata)}::jsonb) returning id::text`;
      return { mode: "applied", ...metadata, auditId: audit.id };
    });
  } finally { await client.end(); }
}
