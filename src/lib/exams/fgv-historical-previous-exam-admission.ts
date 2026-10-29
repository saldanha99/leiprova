import { createHash, randomUUID } from "node:crypto";

import { load } from "cheerio";
import postgres from "postgres";

import { requireStandingCourseMaintenanceDatabaseUrl } from "@/lib/editorial/official-course-admission";
import { OFFICIAL_COURSE_STANDING_REFERENCE } from "@/lib/editorial/official-course-dossier";
import { assertOfficialRobotsPathAllowed } from "@/lib/official-sources/planalto-text";
import { verifyOfficialExamUrl } from "@/lib/official-sources/fetch";
import { parseOpportunityApprovalReviewerIdentity } from "@/lib/opportunities/approval-command";
import { saoPauloCalendarDate } from "@/lib/opportunities/catalog-policy";

// Registro dos links oficiais (caderno Tipo 1 + gabarito definitivo) das edições
// FGV admitidas pela admissão composta em treino histórico. Mesmo desenho do
// operador PGE-AC VIII/2026, com o alvo descrito por configuração: identidade,
// âncoras do portal e trechos do edital aprovado que comprovam formato e data.
// Só metadados: nenhum PDF de prova é armazenado ou extraído.

const FGV = "https://conhecimento.fgv.br/sites/default/files/concursos/";
export const FGV_HISTORICAL_REGISTRATION_ACTION = "editorial.previous_exam.fgv_historical_metadata_registered";

type PortalDocument = Readonly<{ documentType: "question_booklet" | "answer_key"; title: string; label: string; publishedOn: string; url: string; blockIncludes?: readonly string[] }>;
export type FgvHistoricalPreviousExam = Readonly<{
  productSlug: string; editionPublicId: string; opportunitySlug: string;
  portalUrl: string; portalHeading: string; portalNotice: Readonly<{ url: string; label: string }>;
  role: string; jurisdiction: string; jurisdictionName: string; institution: string; noticeNumber: string; cycleYear: number; careerSlug: string;
  examDate: string; expectedQuestionCount: number;
  noticeUrl: string; noticeSha256: string; noticePageCount: number;
  /** Trechos que precisam constar das páginas do edital aprovado (página iniciando em 1). */
  noticeChecks: readonly Readonly<{ page: number; pattern: string }>[];
  examDateCorroboration: string;
  editionSourceExternalId: string; editionTitle: string;
  documents: readonly PortalDocument[];
}>;

export const FGV_HISTORICAL_PREVIOUS_EXAMS: readonly FgvHistoricalPreviousExam[] = [
  {
    productSlug: "tj-pr-juiz-de-direito-2025-2026", editionPublicId: "tjpr-juiz-substituto-001-2025-objetiva", opportunitySlug: "tjpr-juiz-substituto-001-2025-historico-objetiva",
    portalUrl: "https://conhecimento.fgv.br/concursos/tjpr25", portalHeading: "Tribunal de Justiça do Estado do Paraná",
    portalNotice: { url: `${FGV}tjpr-minuta-edital-de-abertura-cnper-ccicm-fgv-12.12.pdf`, label: "Edital (retificado em 12/12/2025)" },
    role: "Juiz Substituto", jurisdiction: "PR", jurisdictionName: "Paraná", institution: "TJPR", noticeNumber: "001/2025", cycleYear: 2025, careerSlug: "magistratura",
    examDate: "2026-02-22", expectedQuestionCount: 100,
    noticeUrl: `${FGV}tjpr-minuta-edital-de-abertura-cnper-ccicm-fgv-12.12.pdf`, noticeSha256: "a14217cca39169bb1d318705f2b84c96954c277cbde4ad2cf3e8050e0d453563", noticePageCount: 118,
    noticeChecks: [
      { page: 33, pattern: "10\\.4[\\s\\S]*100 \\(cem\\) questões de múltipla escolha[\\s\\S]*5 \\(cinco\\) alternativas e apenas uma resposta correta" },
      { page: 33, pattern: "10\\.1[\\s\\S]*22 de fevereiro de 2026" },
      { page: 1, pattern: "Juiz Substituto" },
    ],
    examDateCorroboration: "Edital 027/2025 da comissão: gabarito preliminar da prova objetiva aplicada no dia 22 de fevereiro de 2026",
    editionSourceExternalId: "fgv-tjpr-001-2025-objetiva", editionTitle: "TJPR 001/2025 — Juiz Substituto — objetiva",
    documents: [
      { documentType: "question_booklet", title: "TJPR 001/2025 — prova objetiva seletiva — Tipo 1", label: "Tipo 1", publishedOn: "2026-02-24", url: `${FGV}juiz-substituto-cns001-tipo-1_0.pdf`, blockIncludes: ["Prova Objetiva Seletiva", "Juiz Substituto"] },
      { documentType: "answer_key", title: "TJPR 001/2025 — gabarito oficial definitivo da prova objetiva (Edital 028/2025)", label: "Gabarito Definitivo", publishedOn: "2026-03-30", url: `${FGV}edital-gabarito-definitivo.pdf` },
    ],
  },
  {
    productSlug: "tj-ba-juiz-de-direito-2026", editionPublicId: "tjba-juiz-substituto-01-2026-objetiva", opportunitySlug: "tjba-juiz-substituto-01-2026-historico-objetiva",
    portalUrl: "https://conhecimento.fgv.br/juiztjba", portalHeading: "Tribunal de Justiça do Estado da Bahia",
    portalNotice: { url: `${FGV}edital-concurso-juiz-substituto-tjba-retificado-2.pdf`, label: "Edital (retificado em 07/04/2026)" },
    role: "Juiz Substituto", jurisdiction: "BA", jurisdictionName: "Bahia", institution: "TJBA", noticeNumber: "01/2026", cycleYear: 2026, careerSlug: "magistratura",
    examDate: "2026-05-24", expectedQuestionCount: 100,
    noticeUrl: `${FGV}edital-concurso-juiz-substituto-tjba-retificado-2.pdf`, noticeSha256: "22fba92863b240de5fc1fc3dc534e4395213f9acd50acf9c334f05bdb408d97d", noticePageCount: 76,
    noticeChecks: [
      { page: 21, pattern: "9\\.4[\\s\\S]*100 \\(cem\\) questões de múltipla escolha[\\s\\S]*05 \\(cinco\\) alternativas e apenas uma resposta correta" },
      { page: 21, pattern: "24 de maio de 2026" },
      { page: 1, pattern: "JUIZ SUBSTITUTO" },
    ],
    examDateCorroboration: "Cabeçalho do gabarito oficial definitivo: Prova Aplicada em 24/05/2026",
    editionSourceExternalId: "fgv-tjba-01-2026-objetiva", editionTitle: "TJBA 01/2026 — Juiz Substituto — objetiva",
    documents: [
      { documentType: "question_booklet", title: "TJBA 01/2026 — prova objetiva seletiva — Tipo 1", label: "Tipo 1", publishedOn: "2026-05-26", url: `${FGV}tjba-2026-juiz-substituto-tipo-1.pdf`, blockIncludes: ["Prova Objetiva Seletiva", "Juiz Substituto"] },
      { documentType: "answer_key", title: "TJBA 01/2026 — gabarito oficial definitivo da prova objetiva seletiva", label: "Gabarito Oficial Definitivo da Prova Objetiva Seletiva", publishedOn: "2026-06-25", url: `${FGV}gabarito-definitivo-tjba-juiz-substituto.pdf` },
    ],
  },
  {
    productSlug: "mpe-go-promotor-de-justica-2025", editionPublicId: "mpgo-promotor-substituto-63-2025-preambular", opportunitySlug: "mpgo-promotor-substituto-63-2025-historico-objetiva",
    portalUrl: "https://conhecimento.fgv.br/concursos/mpgo25", portalHeading: "Ministério Público do Estado de Goiás",
    portalNotice: { url: `${FGV}edital-retificado-publicado.pdf`, label: "Edital (retificado em 26/09/2025)" },
    role: "Promotora e Promotor de Justiça Substituto", jurisdiction: "GO", jurisdictionName: "Goiás", institution: "MPGO", noticeNumber: "182/2025-CSMP", cycleYear: 2025, careerSlug: "promotor-justica",
    examDate: "2026-02-01", expectedQuestionCount: 100,
    noticeUrl: `${FGV}edital-retificado-publicado.pdf`, noticeSha256: "fd02aa8cf2d0c8fd6a51d50cde1b1f5575480fe46b411d5c464cf8d3a7528c5f", noticePageCount: 69,
    // O edital remete a data ao cronograma; formato e quantidade constam dos itens 12.1 e 12.4.
    noticeChecks: [
      { page: 30, pattern: "100 \\(cem\\) questões de múltipla escolha" },
      { page: 31, pattern: "5 \\(cinco\\) alternativas, com somente uma opção correta" },
      { page: 3, pattern: "cronograma provisório a ser publicado pela" },
    ],
    examDateCorroboration: "Comunicados 08 e 09 da Comissão de Concurso: prova preambular aplicada em 01/02/2026",
    editionSourceExternalId: "fgv-mpgo-63-2025-preambular", editionTitle: "MPGO 63º Concurso — Promotor de Justiça Substituto — preambular",
    documents: [
      { documentType: "question_booklet", title: "MPGO 63º — prova preambular — Tipo 1", label: "Tipo 1", publishedOn: "2026-02-02", url: `${FGV}promotor-de-justica-substituto-cns100-tipo-1_0.pdf`, blockIncludes: ["Prova Objetiva", "Promotora e Promotor de Justiça Substituto"] },
      { documentType: "answer_key", title: "MPGO 63º — Comunicado 09, gabarito oficial definitivo da prova preambular", label: "COMUNICADO Nº 9 - Gabarito Oficial Definitivo da Prova Preambular", publishedOn: "2026-03-11", url: `${FGV}comissaodeconcurso_comunicado-n-09.pdf` },
    ],
  },
];

export function fgvHistoricalPreviousExam(productSlug: string) {
  const target = FGV_HISTORICAL_PREVIOUS_EXAMS.find((item) => item.productSlug === productSlug);
  if (!target) throw new Error("Produto fora do lote FGV histórico autorizado.");
  return target;
}

export function assertFgvHistoricalAnchors(target: FgvHistoricalPreviousExam, html: string) {
  const $ = load(html);
  if (!$("h1").text().includes(target.portalHeading)) throw new Error("Portal de outro órgão; cadastro bloqueado.");
  const notice = $("a").filter((_, anchor) => $(anchor).attr("href") === target.portalNotice.url);
  if (notice.length !== 1 || notice.text().replace(/\s+/gu, " ").trim() !== target.portalNotice.label) throw new Error("Portal não referencia o edital aprovado esperado; cadastro bloqueado.");
  for (const document of target.documents) {
    const matches = $("a").filter((_, anchor) => $(anchor).attr("href") === document.url);
    if (matches.length !== 1 || matches.text().replace(/\s+/gu, " ").trim() !== document.label) throw new Error("Anchor oficial ausente, duplicado ou com rótulo diferente.");
    const block = matches.closest(".paragraph--type--texto-data");
    if (block.find("time").attr("datetime")?.slice(0, 10) !== document.publishedOn) throw new Error("Data de publicação do link diverge da fonte oficial.");
    if (document.blockIncludes?.some((text) => !block.text().includes(text))) throw new Error("Caderno de cargo/etapa diferente.");
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

export async function previewFgvHistoricalPreviousExam(target: FgvHistoricalPreviousExam, options: { fetcher?: typeof fetch; verifier?: typeof verifyOfficialExamUrl } = {}) {
  const robots = await boundedOfficialText("https://conhecimento.fgv.br/robots.txt", 64 * 1024, options.fetcher ?? fetch);
  for (const url of [target.portalUrl, target.portalNotice.url, ...target.documents.map((document) => document.url)]) assertOfficialRobotsPathAllowed(robots.text, new URL(url).pathname);
  const portal = await boundedOfficialText(target.portalUrl, 2 * 1024 * 1024, options.fetcher ?? fetch);
  assertFgvHistoricalAnchors(target, portal.text);
  const documents = [];
  for (const document of target.documents) {
    const metadata = await (options.verifier ?? verifyOfficialExamUrl)("fgv", document.url);
    if (metadata.httpStatus !== 200 || !metadata.isPdf || metadata.finalUrl !== document.url || metadata.contentType?.split(";", 1)[0].trim().toLowerCase() !== "application/pdf") throw new Error("Link exato não retorna PDF oficial acessível.");
    documents.push({ ...document, ...metadata, distributionMode: "external_link", sourcePolicy: "metadata_only", sourceContentStored: false, status: "pending_review" });
  }
  return { mode: "preview", productSlug: target.productSlug, editionPublicId: target.editionPublicId, observedAt: new Date().toISOString(),
    portalUrl: target.portalUrl, portalHttpStatus: portal.httpStatus, portalHtmlSha256: createHash("sha256").update(portal.text).digest("hex"),
    robotsSha256: createHash("sha256").update(robots.text).digest("hex"), examDate: target.examDate, documents,
    noticeEvidence: { sourceUrl: target.noticeUrl, checksumSha256: target.noticeSha256, pages: target.noticeChecks.map((check) => check.page), expectedQuestionCount: target.expectedQuestionCount, pageCount: target.noticePageCount },
    publicationAllowed: false, admissionApplied: false, latestEditionVerifiedInDatabase: false, databaseWrites: 0, questionsImported: 0, productsReleased: 0, humanReview: false,
    verificationPolicy: "official_html_anchors_and_bounded_transient_pdf_signature_metadata_no_storage_or_text_extraction" };
}

export function assertFgvHistoricalNoticeEvidence(target: FgvHistoricalPreviousExam, input: { checksum: string; pages: number; pageTexts: readonly string[] }) {
  if (input.checksum !== target.noticeSha256 || input.pages !== target.noticePageCount || input.pageTexts.length !== target.noticePageCount
    || target.noticeChecks.some((check) => !new RegExp(check.pattern, "iu").test(input.pageTexts[check.page - 1] ?? ""))) {
    throw new Error("Edital aprovado não comprova quantidade/formato/data esperados; cadastro bloqueado.");
  }
}

type FgvPreview = Awaited<ReturnType<typeof previewFgvHistoricalPreviousExam>>;
export type FgvRegistrationRequest = { productSlug: string; opportunityPublicId: string; expectedNoticeSha256: string; mode: "preview" | "apply"; expectedFingerprint?: string };
export function assertFgvRegistrationRequest(request: FgvRegistrationRequest) {
  const target = fgvHistoricalPreviousExam(request.productSlug);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(request.opportunityPublicId) || request.expectedNoticeSha256 !== target.noticeSha256
    || !["preview", "apply"].includes(request.mode) || (request.mode === "apply" && !/^[a-f0-9]{64}$/u.test(request.expectedFingerprint ?? ""))) throw new Error("Exige oportunidade concreta, hash exato do edital e fingerprint explícito para apply.");
  return target;
}
function assertFgvMetadataFresh(target: FgvHistoricalPreviousExam, preview: FgvPreview) {
  const stamps = [preview.observedAt, ...preview.documents.map((document) => document.checkedAt)];
  if (!/^[a-f0-9]{64}$/u.test(preview.portalHtmlSha256) || !/^[a-f0-9]{64}$/u.test(preview.robotsSha256) || preview.portalUrl !== target.portalUrl || preview.portalHttpStatus !== 200
    || preview.noticeEvidence.sourceUrl !== target.noticeUrl || preview.noticeEvidence.checksumSha256 !== target.noticeSha256 || preview.noticeEvidence.pageCount !== target.noticePageCount
    || preview.humanReview !== false || preview.productSlug !== target.productSlug || preview.editionPublicId !== target.editionPublicId || preview.examDate !== target.examDate
    || preview.documents.length !== target.documents.length || preview.documents.some((document, index) => document.url !== target.documents[index].url || document.documentType !== target.documents[index].documentType
      || document.publishedOn !== target.documents[index].publishedOn || document.finalUrl !== document.url || document.httpStatus !== 200 || document.contentType?.split(";", 1)[0].trim().toLowerCase() !== "application/pdf"
      || !document.isPdf || document.sourceContentStored !== false || document.sourcePolicy !== "metadata_only" || document.status !== "pending_review")
    || stamps.some((stamp) => { const age = Date.now() - new Date(stamp).getTime(); return !Number.isFinite(age) || age < -30_000 || age > 15 * 60_000; })) throw new Error("Metadados incorretos, futuros ou vencidos; repita a conferência.");
}

/** Núcleo transacional: alvo exato do lote; o wrapper valida a conexão de manutenção. */
export async function reviewFgvHistoricalRegistration(tx: postgres.TransactionSql, request: FgvRegistrationRequest, preview: FgvPreview,
  reviewer: ReturnType<typeof parseOpportunityApprovalReviewerIdentity>) {
  const target = assertFgvRegistrationRequest(request); assertFgvMetadataFresh(target, preview);
  if (reviewer.approvalReference !== OFFICIAL_COURSE_STANDING_REFERENCE) throw new Error("Referência permanente exata obrigatória.");
  const { opportunityPublicId, expectedNoticeSha256 } = request;
  const [database] = await tx<{ role: string; readOnly: string }[]>`select current_user as role,current_setting('transaction_read_only') as "readOnly"`;
  if (database.role !== "leiprova_owner" || database.readOnly !== (request.mode === "preview" ? "on" : "off")) throw new Error("Papel/transação não corresponde ao modo solicitado.");
  await tx`set local statement_timeout='30s'`;
  await tx`set local lock_timeout='5s'`;
  const operators = reviewer.email ? await tx<{ id: string; role: string }[]>`select id::text, role from users where lower(email)=${reviewer.email} limit 2 ${request.mode === "apply" ? tx`for key share` : tx``}`
    : await tx<{ id: string; role: string }[]>`select id::text, role from users where role='admin' limit 2 ${request.mode === "apply" ? tx`for key share` : tx``}`;
  if (operators.length !== 1 || operators[0].role !== "admin") throw new Error("Administrador único obrigatório.");
  if (request.mode === "apply") await tx`select public.lock_product_binding_review_product(${target.productSlug})`;
  const [identity] = await tx<{ opportunityId: string; careerId: string; bankId: string; baselineEditionId: string | null; opportunityUpdatedAt: string }[]>`select opportunity.id::text as "opportunityId", opportunity.career_track_id::text as "careerId", bank.id::text as "bankId", opportunity.exam_edition_id::text as "baselineEditionId", opportunity.updated_at::text as "opportunityUpdatedAt"
    from contest_store_products product join contest_opportunities opportunity on opportunity.id=product.opportunity_id
    join quiz_career_tracks career on career.id=opportunity.career_track_id join quiz_banks bank on bank.slug='fgv' and bank.is_active
    where product.slug=${target.productSlug} and product.status='draft' and product.preparation_mode='historical_training'
      and product.preparation_approval_reference=${reviewer.approvalReference} and product.preparation_opportunity_updated_at=opportunity.updated_at
      and opportunity.public_id=${opportunityPublicId} and opportunity.slug=${target.opportunitySlug} and opportunity.editorial_status='reviewed'
      and opportunity.institution_acronym=${target.institution} and opportunity.jurisdiction_code=${target.jurisdiction} and opportunity.scope='state' and opportunity.cycle_year=${target.cycleYear}
      and opportunity.official_notice_number=${target.noticeNumber} and opportunity.role_name=${target.role} and opportunity.exam_date=${target.examDate}::date
      and opportunity.specialization_id is null and career.slug=${target.careerSlug} and career.is_active
      and exists(select 1 from opportunity_organizer_assignments organizer where organizer.opportunity_id=opportunity.id
        and organizer.quiz_bank_id=bank.id and organizer.role='examination_provider' and organizer.status='reviewed' and organizer.valid_until is null
        and organizer.valid_from<=(now() at time zone 'America/Sao_Paulo')::date)
      and exists(select 1 from audit_logs admission where admission.entity_id=opportunity.public_id and admission.action='editorial.official_course.composite_standing_admitted'
        and admission.metadata->>'approvalReference'=${reviewer.approvalReference} and admission.metadata->>'humanReview'='false'
        and admission.metadata->>'productSlug'=${target.productSlug}) ${request.mode === "apply" ? tx`for update of product, opportunity` : tx``}`;
  if (!identity) throw new Error("Admissão composta ainda não aplicada ou identidade/vínculo divergem; nenhum cadastro será gravado.");
  if (identity.baselineEditionId !== null) throw new Error("Oportunidade já possui edição-base; não sobrescrever vínculo existente.");
  const snapshots = await tx<{ checksum: string; pages: number; pageTexts: string[]; snapshotId: string; sourceId: string; snapshotUpdatedAt: string; sourceStateFingerprint: string }[]>`select snapshot.checksum_sha256 as checksum, snapshot.page_count as pages, snapshot.page_texts as "pageTexts", snapshot.id::text as "snapshotId", source.id::text as "sourceId", snapshot.updated_at::text as "snapshotUpdatedAt", encode(sha256(convert_to(to_jsonb(source)::text,'UTF8')),'hex') as "sourceStateFingerprint"
    from opportunity_document_snapshots snapshot join opportunity_source_documents source on source.id=snapshot.source_document_id
    where source.opportunity_id=${identity.opportunityId} and source.status='approved' and source.source_url=${target.noticeUrl}
      and snapshot.status='approved' and snapshot.checksum_sha256=${expectedNoticeSha256} and source.checksum_sha256=snapshot.checksum_sha256
      and snapshot.document_url=${target.noticeUrl} and encode(sha256(snapshot.document_bytes),'hex')=${expectedNoticeSha256}
      and snapshot.mime_type='application/pdf' and source.document_type='notice' limit 2
      ${request.mode === "apply" ? tx`for share of source,snapshot` : tx``}`;
  if (snapshots.length !== 1) throw new Error("Snapshot único do edital aprovado obrigatório.");
  assertFgvHistoricalNoticeEvidence(target, snapshots[0]);
  const assignments = await tx<{ id: string; updatedAt: string }[]>`select id::text,updated_at::text as "updatedAt" from opportunity_organizer_assignments
    where opportunity_id=${identity.opportunityId} and quiz_bank_id=${identity.bankId} and source_document_id=${snapshots[0].sourceId}
      and role='examination_provider' and responsible_type='external_organizer' and status='reviewed'
      and valid_until is null and valid_from<=(now() at time zone 'America/Sao_Paulo')::date limit 2
      ${request.mode === "apply" ? tx`for share` : tx``}`;
  if (assignments.length !== 1) throw new Error("Examinador FGV único e ligado à fonte aprovada obrigatório.");
  const today = saoPauloCalendarDate(new Date());
  if (target.examDate >= today) throw new Error("Prova ainda não realizada.");
  const existing = await tx`select id from exam_editions where public_id=${target.editionPublicId} or (institution_acronym=${target.institution} and jurisdiction_code=${target.jurisdiction} and career_track_id=${identity.careerId} and specialization_id is null and exam_date=${target.examDate}::date) limit 1`;
  if (existing.length) throw new Error("Edição já existente; não duplicar nem alterar IDs/documentos históricos.");
  const newer = await tx`select id from exam_editions where institution_acronym=${target.institution} and jurisdiction_code=${target.jurisdiction} and career_track_id=${identity.careerId}
    and specialization_id is null and status in ('held','published') and exam_date>${target.examDate}::date and exam_date<${today}::date limit 1`;
  if (newer.length) throw new Error("Existe edição realizada mais recente; seleção exige revisão própria.");
  const actor = operators[0].id;
  const snapshotIdentity = snapshots.map(({ pageTexts: omitted, ...rest }) => { void omitted; return rest; });
  const fingerprint = createHash("sha256").update(JSON.stringify({ target: target.editionPublicId, opportunityPublicId, identity, snapshots: snapshotIdentity, assignments,
    actor, reference: reviewer.approvalReference, portalHtmlSha256: preview.portalHtmlSha256, robotsSha256: preview.robotsSha256,
    documents: preview.documents.map((document) => ({ url: document.url, documentType: document.documentType, publishedOn: document.publishedOn,
      httpStatus: document.httpStatus, contentType: document.contentType, isPdf: document.isPdf, finalUrl: document.finalUrl })) })).digest("hex");
  if (request.mode === "preview") return { mode: "preview" as const, fingerprint, productSlug: target.productSlug, opportunityPublicId,
    admissionApplied: true, latestEditionVerifiedInDatabase: true, editionPublicId: target.editionPublicId, noticeSha256: expectedNoticeSha256, examDate: target.examDate, documents: preview.documents,
    databaseWrites: 0, questionsImported: 0, referencesApproved: 0, productsReleased: 0, sourceContentStored: false, humanReview: false, publicationAllowed: false };
  if (request.expectedFingerprint !== fingerprint) throw new Error("Fingerprint da prévia divergiu; recapture e confira antes de apply.");
  const portalTitle = `Concurso Público para o ${target.portalHeading}`;
  const [edition] = await tx<{ id: string }[]>`insert into exam_editions(public_id,career_track_id,bank_id,institution_acronym,jurisdiction_code,source_external_id,title,organizer,jurisdiction,
    official_url,exam_date,status,source_policy,source_content_stored,source_page_title,source_http_status,source_checked_at,created_by_user_id,updated_by_user_id)
    values(${target.editionPublicId},${identity.careerId},${identity.bankId},${target.institution},${target.jurisdiction},${target.editionSourceExternalId},
      ${target.editionTitle},'Fundação Getulio Vargas — objetiva',${target.jurisdictionName},${target.portalUrl},${target.examDate},
      'held','metadata_only',false,${portalTitle},200,${preview.observedAt},${actor},${actor}) returning id::text`;
  const documentIds: string[] = [];
  for (const document of preview.documents) {
    const publicId = randomUUID(); documentIds.push(publicId);
    await tx`insert into exam_edition_documents(public_id,exam_edition_id,document_type,title,source_url,source_host,published_at,source_checked_at,http_status,content_type,file_name,
      expected_question_count,distribution_mode,source_policy,status,initiated_by_user_id)
      values(${publicId},${edition.id},${document.documentType},${document.title},${document.url},'conhecimento.fgv.br',${document.publishedOn},${document.checkedAt},200,${document.contentType},
        ${new URL(document.url).pathname.split("/").at(-1)!},${document.documentType === "question_booklet" ? target.expectedQuestionCount : null},'external_link','metadata_only','pending_review',${actor})`;
  }
  const assignmentStamp = new Date().toISOString();
  const updatedOpportunities = await tx<{ id: string }[]>`update contest_opportunities set exam_edition_id=${edition.id}, updated_at=${assignmentStamp}
    where id=${identity.opportunityId} and public_id=${opportunityPublicId} and exam_edition_id is null
      and updated_at::text=${identity.opportunityUpdatedAt} and editorial_status='reviewed'
      and institution_acronym=${target.institution} and jurisdiction_code=${target.jurisdiction} and role_name=${target.role} and official_notice_number=${target.noticeNumber}
      and cycle_year=${target.cycleYear} and exam_date=${target.examDate}::date and career_track_id=${identity.careerId} and specialization_id is null returning id::text`;
  if (updatedOpportunities.length !== 1 || updatedOpportunities[0].id !== identity.opportunityId) throw new Error("Edição-base não atualizou exatamente a oportunidade esperada; transação cancelada.");
  const updatedProducts = await tx<{ slug: string }[]>`update contest_store_products set
    preparation_opportunity_updated_at=(select updated_at from contest_opportunities where id=${identity.opportunityId}), updated_at=${assignmentStamp}
    where slug=${target.productSlug} and opportunity_id=${identity.opportunityId} and status='draft' and preparation_mode='historical_training'
      and preparation_approval_reference=${reviewer.approvalReference} and preparation_opportunity_updated_at::text=${identity.opportunityUpdatedAt} returning slug`;
  if (updatedProducts.length !== 1 || updatedProducts[0].slug !== target.productSlug) throw new Error("Fingerprint do modo não atualizou exatamente o produto esperado; transação cancelada.");
  const metadata = { approvalBasis: "owner_standing_authorization", approvalReference: reviewer.approvalReference, humanReview: false, productSlug: target.productSlug, opportunityPublicId,
    editionPublicId: target.editionPublicId, documentPublicIds: documentIds, noticeSha256: expectedNoticeSha256, portalHtmlSha256: preview.portalHtmlSha256,
    fingerprint, examDate: target.examDate, expectedQuestionCount: target.expectedQuestionCount, noticeEvidencePages: target.noticeChecks.map((check) => check.page),
    examDateCorroboration: { statement: target.examDateCorroboration, observedOn: "2026-10-29", provenance: "official_documents_observed_by_project_operator", headerReextractedInThisExecution: false }, documents: preview.documents,
    documentStatus: "pending_review", sourcePolicy: "metadata_only", sourceContentStored: false, latestEditionVerifiedInDatabase: true,
    assignedBaselineEdition: true, assignedBaselineEditionId: edition.id, assignmentStamp, questionsImported: 0, referencesApproved: 0, productsReleased: 0, publicationAllowed: false, executionSource: "server_cli" };
  const [audit] = await tx<{ id: string }[]>`insert into audit_logs(actor_user_id,action,entity_type,entity_id,metadata)
    values(${actor},${FGV_HISTORICAL_REGISTRATION_ACTION},'exam_edition',${target.editionPublicId},${tx.json(metadata as unknown as postgres.JSONValue)}) returning id::text`;
  return { mode: "applied", ...metadata, auditId: audit.id };
}

export async function registerFgvHistoricalPreviousExam(request: FgvRegistrationRequest) {
  const target = assertFgvRegistrationRequest(request);
  const databaseUrl = requireStandingCourseMaintenanceDatabaseUrl(process.env.MIGRATION_DATABASE_URL);
  const reviewer = parseOpportunityApprovalReviewerIdentity({ ADMIN_EMAILS: process.env.ADMIN_EMAILS, OPPORTUNITY_APPROVAL_REFERENCE: process.env.OPPORTUNITY_APPROVAL_REFERENCE });
  if (reviewer.approvalReference !== OFFICIAL_COURSE_STANDING_REFERENCE) throw new Error("Referência permanente exata obrigatória.");
  const preview = await previewFgvHistoricalPreviousExam(target);
  const client = postgres(databaseUrl, { max: 1, prepare: false, connect_timeout: 5 });
  try { return await client.begin(request.mode === "preview" ? "isolation level repeatable read read only" : "isolation level serializable", (tx) => reviewFgvHistoricalRegistration(tx, request, preview, reviewer)); }
  finally { await client.end(); }
}
