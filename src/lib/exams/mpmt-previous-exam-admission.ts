import { createHash, randomUUID } from "node:crypto";

import { load } from "cheerio";
import postgres from "postgres";

import { requireStandingCourseMaintenanceDatabaseUrl } from "@/lib/editorial/official-course-admission";
import { OFFICIAL_COURSE_STANDING_REFERENCE } from "@/lib/editorial/official-course-dossier";
import { MPMT_PREVIOUS_EDITION_PUBLIC_ID, MPMT_PREVIOUS_PRODUCT_SLUG } from "@/lib/exams/previous-exam-link-command";
import { assertOfficialRobotsPathAllowed } from "@/lib/official-sources/planalto-text";
import { verifyOfficialExamUrl } from "@/lib/official-sources/fetch";
import { parseOpportunityApprovalReviewerIdentity } from "@/lib/opportunities/approval-command";
import { saoPauloCalendarDate } from "@/lib/opportunities/catalog-policy";

export const MPMT_OFFICIAL_PREVIOUS_EXAM = {
  productSlug: MPMT_PREVIOUS_PRODUCT_SLUG, editionPublicId: MPMT_PREVIOUS_EDITION_PUBLIC_ID,
  portalUrl: "https://conhecimento.fgv.br/concursos/mpmt", role: "Promotor de Justiça Substituto", jurisdiction: "MT", institution: "MPMT",
  examDate: "2026-06-14", expectedQuestionCount: 100,
  noticeUrl: "https://conhecimento.fgv.br/sites/default/files/concursos/edital_n_01_2026_compilado_ate_a_1_a_retificacao_de_20_07_2026-1.pdf",
  noticeSha256: "1a7b0a61a3d0cc809206b7bc2e3988245f9e4694914008dfad6c5a8dd1e9055b",
  opportunitySlug: "mpmt-promotor-substituto-2026-historico-objetiva",
  documents: [
    { documentType: "question_booklet", title: "MPMT 01/2026 — prova preambular objetiva — Tipo 1", label: "Tipo 1", publishedOn: "2026-06-15", url: "https://conhecimento.fgv.br/sites/default/files/concursos/promotor-de-justica-substituto-cns100-tipo-1_1.pdf" },
    { documentType: "answer_key", title: "MPMT 01/2026 — gabarito oficial definitivo da prova objetiva", label: "Gabarito Oficial Definitivo da Prova Objetiva", publishedOn: "2026-07-20", url: "https://conhecimento.fgv.br/sites/default/files/concursos/mpmt2026-gabaritos-para-publicacao_0.pdf" },
  ],
} as const;

export function assertMpmtOfficialAnchors(html: string) {
  const $ = load(html);
  if (!$("h1").text().includes("Ministério Público do Estado de Mato Grosso")) throw new Error("Portal de outro órgão; cadastro bloqueado.");
  const notice = $("a").filter((_,anchor)=>$(anchor).attr("href")===MPMT_OFFICIAL_PREVIOUS_EXAM.noticeUrl);
  if (notice.length!==1 || !/01\/2026/iu.test(notice.text()) || !/compilado/iu.test(notice.text()) || !/20\.07\.2026/iu.test(notice.text())) throw new Error("Portal não referencia o edital compilado aprovado; recaptura/revisão necessária.");
  for (const document of MPMT_OFFICIAL_PREVIOUS_EXAM.documents) {
    const matches = $("a").filter((_, anchor) => $(anchor).attr("href") === document.url);
    if (matches.length !== 1 || matches.text().replace(/\s+/gu, " ").trim() !== document.label) throw new Error("Anchor oficial ausente, duplicado ou com rótulo diferente.");
    const block = matches.closest(".paragraph--type--texto-data");
    if (block.find("time").attr("datetime")?.slice(0, 10) !== document.publishedOn) throw new Error("Data de publicação do link diverge da fonte oficial.");
    if (document.documentType === "question_booklet" && (!block.text().includes(MPMT_OFFICIAL_PREVIOUS_EXAM.role) || !block.text().includes("Prova Preambular"))) throw new Error("Caderno de cargo/etapa diferente.");
  }
}

async function boundedOfficialText(url: string, limit: number, fetcher: typeof fetch) {
  const response = await fetcher(url, { redirect: "manual", signal: AbortSignal.timeout(15_000), headers: { "User-Agent": "EditalLeiSeca-OfficialSourceMonitor/1.0 (+https://editaleiseca.com.br/fontes-e-atualizacao)", Accept: "text/html,text/plain" } });
  if (response.status !== 200 || (response.url && response.url !== url)) throw new Error("Página oficial indisponível ou redirecionada; não contornar bloqueio.");
  const mime = response.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
  if (mime !== "text/plain" && mime !== "text/html") throw new Error("Esperado somente HTML/robots; PDF nunca entra na captura de texto.");
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Página oficial sem corpo.");
  const chunks: Uint8Array[] = []; let length = 0;
  try {
    while (true) { const { done, value } = await reader.read(); if (done) break; length += value.length; if (length > limit) throw new Error("Página excede limite de metadados."); chunks.push(value); }
  } finally { await reader.cancel(); }
  return { text: new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks)), httpStatus: response.status };
}

export async function previewMpmtPreviousExam(options: { fetcher?: typeof fetch; verifier?: typeof verifyOfficialExamUrl } = {}) {
  const target = MPMT_OFFICIAL_PREVIOUS_EXAM;
  const robots = await boundedOfficialText("https://conhecimento.fgv.br/robots.txt", 64 * 1024, options.fetcher ?? fetch);
  for (const url of [target.portalUrl, ...target.documents.map((document) => document.url)]) assertOfficialRobotsPathAllowed(robots.text, new URL(url).pathname);
  const portal = await boundedOfficialText(target.portalUrl, 2 * 1024 * 1024, options.fetcher ?? fetch);
  assertMpmtOfficialAnchors(portal.text);
  const documents = [];
  for (const document of target.documents) {
    const metadata = await (options.verifier ?? verifyOfficialExamUrl)("fgv", document.url);
    if (metadata.httpStatus !== 200 || !metadata.isPdf || metadata.finalUrl !== document.url || metadata.contentType?.split(";",1)[0].trim().toLowerCase() !== "application/pdf") throw new Error("Link exato não retorna PDF oficial acessível.");
    documents.push({ ...document, ...metadata, distributionMode: "external_link", sourcePolicy: "metadata_only", sourceContentStored: false, status: "pending_review" });
  }
  return { mode: "preview", productSlug: target.productSlug, editionPublicId: target.editionPublicId, observedAt: new Date().toISOString(),
    portalUrl: target.portalUrl, portalHttpStatus: portal.httpStatus, portalHtmlSha256: createHash("sha256").update(portal.text).digest("hex"),
    robotsSha256: createHash("sha256").update(robots.text).digest("hex"), examDate: target.examDate, documents,
    noticeEvidence: { sourceUrl: target.noticeUrl, checksumSha256: target.noticeSha256, pages: { questionCount: 13, examDate: 18 }, expectedQuestionCount: target.expectedQuestionCount, pageCount: 66 },
    admissionApplied: false, latestEditionVerifiedInDatabase: false, databaseWrites: 0, questionsImported: 0, productsReleased: 0, humanReview: false,
    verificationPolicy: "official_html_anchors_and_bounded_transient_pdf_signature_metadata_no_storage_or_text_extraction" };
}

export function assertMpmtNoticeEvidence(input: { checksum: string; pages: number; countPage: string; datePage: string }) {
  if (input.checksum !== MPMT_OFFICIAL_PREVIOUS_EXAM.noticeSha256 || input.pages !== 66
    || !/100 questões de múltipla escolha/iu.test(input.countPage) || !/Promotor de Justiça Substituto/iu.test(input.datePage)
    || !/14 de junho de 2026/iu.test(input.datePage)) throw new Error("Edital aprovado não comprova quantidade/cargo/data esperados; cadastro bloqueado.");
}

export async function registerMpmtPreviousExam(opportunityPublicId: string, expectedNoticeSha256: string) {
  const target = MPMT_OFFICIAL_PREVIOUS_EXAM;
  if (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/u.test(opportunityPublicId) || expectedNoticeSha256 !== target.noticeSha256
    || process.env.OPPORTUNITY_APPROVAL_REFERENCE !== OFFICIAL_COURSE_STANDING_REFERENCE) throw new Error("Exige oportunidade real, hash do edital conferido e referência exata de 12/10.");
  const databaseUrl = requireStandingCourseMaintenanceDatabaseUrl(process.env.MIGRATION_DATABASE_URL);
  const reviewer = parseOpportunityApprovalReviewerIdentity({ ADMIN_EMAILS: process.env.ADMIN_EMAILS, OPPORTUNITY_APPROVAL_REFERENCE: process.env.OPPORTUNITY_APPROVAL_REFERENCE });
  const preview = await previewMpmtPreviousExam();
  const client = postgres(databaseUrl, { max: 1, prepare: false });
  try {
    return await client.begin("isolation level serializable", async (tx) => {
      await tx`set local statement_timeout='30s'`;
      await tx`set local lock_timeout='5s'`;
      const operators = reviewer.email ? await tx<{ id: string; role: string }[]>`select id::text, role from users where lower(email)=${reviewer.email} limit 2 for key share`
        : await tx<{ id: string; role: string }[]>`select id::text, role from users where role='admin' limit 2 for key share`;
      if (operators.length !== 1 || operators[0].role !== "admin") throw new Error("Administrador único obrigatório.");
      await tx`select public.lock_product_binding_review_product(${target.productSlug})`;
      const [identity] = await tx<{ opportunityId: string; careerId: string; bankId: string; baselineEditionId: string | null; opportunityUpdatedAt: string }[]>`select opportunity.id::text as "opportunityId", opportunity.career_track_id::text as "careerId", bank.id::text as "bankId", opportunity.exam_edition_id::text as "baselineEditionId", opportunity.updated_at::text as "opportunityUpdatedAt"
        from contest_store_products product join contest_opportunities opportunity on opportunity.id=product.opportunity_id
        join quiz_career_tracks career on career.id=opportunity.career_track_id join quiz_banks bank on bank.slug='fgv' and bank.is_active
        where product.slug=${target.productSlug} and product.status='draft' and product.preparation_mode='historical_training'
          and product.preparation_approval_reference=${reviewer.approvalReference} and product.preparation_opportunity_updated_at=opportunity.updated_at
          and opportunity.public_id=${opportunityPublicId} and opportunity.slug=${target.opportunitySlug} and opportunity.editorial_status='reviewed'
          and opportunity.institution_acronym='MPMT' and opportunity.jurisdiction_code='MT' and opportunity.cycle_year=2026
          and opportunity.official_notice_number='01/2026' and opportunity.role_name=${target.role} and opportunity.exam_date=${target.examDate}::date
          and opportunity.specialization_id is null and career.slug='promotor-justica' and career.is_active
          and exists(select 1 from opportunity_organizer_assignments organizer where organizer.opportunity_id=opportunity.id
            and organizer.quiz_bank_id=bank.id and organizer.role='examination_provider' and organizer.status='reviewed' and organizer.valid_until is null)
          and exists(select 1 from audit_logs admission where admission.entity_id=opportunity.public_id and admission.action='editorial.official_course.standing_admitted'
            and admission.metadata->>'approvalReference'=${reviewer.approvalReference} and admission.metadata->>'humanReview'='false') for update of product, opportunity`;
      if (!identity) throw new Error("Admissão MPMT ainda não aplicada ou identidade/vínculo divergem; nenhum cadastro será gravado.");
      if (identity.baselineEditionId !== null) throw new Error("Oportunidade já possui edição-base; não sobrescrever vínculo existente.");
      const snapshots = await tx<{ checksum: string; pages: number; countPage: string; datePage: string }[]>`select snapshot.checksum_sha256 as checksum, snapshot.page_count as pages,
        snapshot.page_texts->>12 as "countPage", snapshot.page_texts->>17 as "datePage"
        from opportunity_document_snapshots snapshot join opportunity_source_documents source on source.id=snapshot.source_document_id
        where source.opportunity_id=${identity.opportunityId} and source.status='approved' and source.source_url=${target.noticeUrl}
          and snapshot.status='approved' and snapshot.checksum_sha256=${expectedNoticeSha256} and source.checksum_sha256=snapshot.checksum_sha256 limit 2`;
      if (snapshots.length !== 1) throw new Error("Snapshot único do edital aprovado obrigatório.");
      assertMpmtNoticeEvidence(snapshots[0]);
      const today = saoPauloCalendarDate(new Date());
      if (target.examDate >= today) throw new Error("Prova ainda não realizada.");
      const existing = await tx`select id from exam_editions where public_id=${target.editionPublicId} or (institution_acronym='MPMT' and jurisdiction_code='MT' and career_track_id=${identity.careerId} and specialization_id is null and exam_date=${target.examDate}::date) limit 1`;
      if (existing.length) throw new Error("Edição já existente; não duplicar nem alterar IDs/documentos históricos.");
      const newer = await tx`select id from exam_editions where institution_acronym='MPMT' and jurisdiction_code='MT' and career_track_id=${identity.careerId}
        and specialization_id is null and status in ('held','published') and exam_date>${target.examDate}::date and exam_date<${today}::date limit 1`;
      if (newer.length) throw new Error("Existe edição realizada mais recente; seleção exige revisão própria.");
      const actor = operators[0].id;
      if (Date.now() - Date.parse(preview.observedAt) > 15 * 60_000) throw new Error("Metadados vencidos; repita a conferência.");
      const [edition] = await tx<{ id: string }[]>`insert into exam_editions(public_id,career_track_id,bank_id,institution_acronym,jurisdiction_code,source_external_id,title,organizer,jurisdiction,
        official_url,exam_date,status,source_policy,source_content_stored,source_page_title,source_http_status,source_checked_at,created_by_user_id,updated_by_user_id)
        values(${target.editionPublicId},${identity.careerId},${identity.bankId},'MPMT','MT','fgv-mpmt-01-2026-preambular',
          'MPMT 01/2026 — Promotor de Justiça Substituto — preambular objetiva','Fundação Getulio Vargas — objetiva','Mato Grosso',${target.portalUrl},${target.examDate},
          'held','metadata_only',false,'Concurso Público para o Ministério Público do Estado de Mato Grosso',200,${preview.observedAt},${actor},${actor}) returning id::text`;
      const documentIds: string[] = [];
      for (const document of preview.documents) {
        const publicId = randomUUID(); documentIds.push(publicId);
        await tx`insert into exam_edition_documents(public_id,exam_edition_id,document_type,title,source_url,source_host,published_at,source_checked_at,http_status,content_type,file_name,
          expected_question_count,distribution_mode,source_policy,status,initiated_by_user_id)
          values(${publicId},${edition.id},${document.documentType},${document.title},${document.url},'conhecimento.fgv.br',${document.publishedOn},${document.checkedAt},200,${document.contentType},
            ${new URL(document.url).pathname.split('/').at(-1)!},${document.documentType === 'question_booklet' ? target.expectedQuestionCount : null},'external_link','metadata_only','pending_review',${actor})`;
      }
      const assignmentStamp = new Date().toISOString();
      const updatedOpportunities = await tx<{ id: string }[]>`update contest_opportunities set exam_edition_id=${edition.id}, updated_at=${assignmentStamp}
        where id=${identity.opportunityId} and public_id=${opportunityPublicId} and exam_edition_id is null
          and updated_at=${identity.opportunityUpdatedAt}::timestamptz and editorial_status='reviewed'
          and institution_acronym='MPMT' and jurisdiction_code='MT' and role_name=${target.role} and official_notice_number='01/2026'
          and cycle_year=2026 and exam_date=${target.examDate}::date and career_track_id=${identity.careerId} and specialization_id is null returning id::text`;
      if (updatedOpportunities.length !== 1 || updatedOpportunities[0].id !== identity.opportunityId) throw new Error("Edição-base não atualizou exatamente a oportunidade esperada; transação cancelada.");
      const updatedProducts = await tx<{ slug: string }[]>`update contest_store_products set
        preparation_opportunity_updated_at=(select updated_at from contest_opportunities where id=${identity.opportunityId}), updated_at=${assignmentStamp}
        where slug=${target.productSlug} and opportunity_id=${identity.opportunityId} and status='draft' and preparation_mode='historical_training'
          and preparation_approval_reference=${reviewer.approvalReference} and preparation_opportunity_updated_at=${identity.opportunityUpdatedAt}::timestamptz returning slug`;
      if (updatedProducts.length !== 1 || updatedProducts[0].slug !== target.productSlug) throw new Error("Fingerprint do modo não atualizou exatamente o produto esperado; transação cancelada.");
      const metadata = { approvalBasis: "owner_standing_authorization", approvalReference: reviewer.approvalReference, humanReview: false, productSlug: target.productSlug, opportunityPublicId,
        editionPublicId: target.editionPublicId, documentPublicIds: documentIds, noticeSha256: expectedNoticeSha256, portalHtmlSha256: preview.portalHtmlSha256,
        examDate: target.examDate, expectedQuestionCount: target.expectedQuestionCount, noticeEvidencePages: [13,18], documents: preview.documents,
        documentStatus: "pending_review", sourcePolicy: "metadata_only", sourceContentStored: false, latestEditionVerifiedInDatabase: true,
        assignedBaselineEdition: true, assignedBaselineEditionId: edition.id, assignmentStamp, questionsImported: 0, referencesApproved: 0, productsReleased: 0, executionSource: "server_cli" };
      const [audit] = await tx<{ id: string }[]>`insert into audit_logs(actor_user_id,action,entity_type,entity_id,metadata)
        values(${actor},'editorial.previous_exam.mpmt_metadata_registered','exam_edition',${target.editionPublicId},${tx.json(metadata as unknown as postgres.JSONValue)}) returning id::text`;
      return { mode: "applied", ...metadata, auditId: audit.id };
    });
  } finally { await client.end(); }
}
