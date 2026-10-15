import { createHash, randomUUID } from "node:crypto";

import { load } from "cheerio";
import postgres from "postgres";

import { requireStandingCourseMaintenanceDatabaseUrl } from "@/lib/editorial/official-course-admission";
import { OFFICIAL_COURSE_STANDING_REFERENCE } from "@/lib/editorial/official-course-dossier";
import {
  assertAnswerKeyEvidence,
  answerKeyEvidenceProvenance,
  MPRJ_XXXIX_PREAMBULAR_ANSWER_KEY_EVIDENCE,
  requiredAnswerKeyDocumentTypes,
} from "@/lib/exams/answer-key-finality";
import {
  MPRJ_PREVIOUS_EDITION_PUBLIC_ID,
  MPRJ_PREVIOUS_PRODUCT_SLUG,
} from "@/lib/exams/previous-exam-link-command";
import { assertOfficialRobotsPathAllowed } from "@/lib/official-sources/planalto-text";
import { verifyOfficialExamUrl } from "@/lib/official-sources/fetch";
import { parseOpportunityApprovalReviewerIdentity } from "@/lib/opportunities/approval-command";
import { saoPauloCalendarDate } from "@/lib/opportunities/catalog-policy";

// Cadastro delimitado da prova preambular do XXXIX Concurso do MPRJ (31/05/2026)
// como prova anterior **externa** do produto MPRJ 2026.
//
// O que distingue este operador do MPMT e do PGE-AC: não existe gabarito oficial
// definitivo autônomo. O Edital XXXIX não possui o subitem que o XXXVIII tinha
// (11.7.3, "com a divulgação dos novos gabaritos, se for o caso"), e a finalidade
// se comprova pelo par gabarito preliminar (01/06/2026) + aviso de 22/06/2026 que,
// julgados os recursos, mantém TODOS os gabaritos. A política que recusa
// composições inválidas é `answer-key-finality.ts`; aqui ela é aplicada contra a
// fonte oficial e o banco.
//
// Nada de licença, cópia, armazenamento ou extração de texto de PDF: só
// metadados de link e âncoras do HTML oficial. O produto permanece `draft`.

const FGV_FILES = "https://conhecimento.fgv.br/sites/default/files/concursos/";
const normalizeOfficialAnchorText = (value: string) =>
  value.normalize("NFKC").replace(/\s+/gu, " ").trim();

export const MPRJ_OFFICIAL_PREVIOUS_EXAM = {
  productSlug: MPRJ_PREVIOUS_PRODUCT_SLUG,
  editionPublicId: MPRJ_PREVIOUS_EDITION_PUBLIC_ID,
  portalUrl: "https://conhecimento.fgv.br/concursos/mprjpromotor2026",
  role: "Promotor de Justiça Substituto",
  jurisdiction: "RJ",
  institution: "MPRJ",
  noticeNumber: "XXXIX/2026",
  examDate: "2026-05-31",
  expectedQuestionCount: 100,
  bookletVersionLabel: "Tipo 1",
  answerKeyFinality: "preliminary_plus_maintenance_act",
  opportunityPublicId: "31739f51-3b4b-4984-a272-54fb549c034d",
  opportunitySlug: "mprj-promotor-substituto-xxxix-2026-historico-objetiva",
  noticeUrl: `${FGV_FILES}edital-xxxix-concurso.pdf`,
  noticeSha256: "a42655899f7c0dcb5aef49164d7b2c0cbd6f7e6ede663fadb31887096b8aad62",
  noticePageCount: 47,
  /** Páginas 1-based do edital aprovado. O programa é aviso separado e não entra. */
  noticePages: { identity: 1, examDate: 21 },
  documents: [
    {
      documentType: "question_booklet",
      title: "MPRJ XXXIX/2026 — prova preambular — caderno Tipo 1",
      label: "Tipo 1",
      publishedOn: "2026-06-01",
      url: `${FGV_FILES}promotor-de-justica-substituto-cns001-tipo-1.pdf`,
    },
    {
      documentType: "answer_key",
      title: "MPRJ XXXIX/2026 — gabarito oficial preliminar da prova preambular",
      label: "Gabarito Oficial Preliminar da Prova Preambular",
      publishedOn: "2026-06-01",
      url: `${FGV_FILES}mprj-promotor-2026-gabaritos-para-publicacao.pdf`,
    },
    {
      documentType: "answer_key_decision",
      title:
        "MPRJ XXXIX/2026 — aviso de 22/06/2026: julgados os recursos, mantidos os gabaritos da prova preambular",
      label: "Recursos gabarito preambular",
      publishedOn: "2026-06-22",
      url: `${FGV_FILES}22.06-recursos-gabarito-preambular.pdf`,
    },
  ],
} as const;

/** A contagem de 100 questões vem da capa do caderno Tipo 1, lida pelo operador
 * do projeto em 14/10/2026. O edital de 47 páginas não é usado para isso, e
 * nenhum PDF é reextraído nesta execução: metadado declarado com proveniência,
 * nunca inferido. */
export const MPRJ_QUESTION_COUNT_CORROBORATION = {
  sourceUrl: MPRJ_OFFICIAL_PREVIOUS_EXAM.documents[0].url,
  statement:
    "Capa do caderno Tipo 1 declara 100 (cem) questões objetivas e 5 (cinco) opções de resposta",
  observedOn: "2026-10-14",
  provenance: "primary_booklet_cover_observed_by_project_operator",
  reextractedInThisExecution: false,
} as const;

/** O ato de 22/06 é ato administrativo, não gabarito: o vínculo é externo e o
 * rótulo exibido deriva do tipo do documento. */
export const MPRJ_ANSWER_KEY_DECISION_BASIS =
  "art. 38, IV, da Deliberação CSMP nº 86, de 11 de dezembro de 2025";

/** Conferência de identidade do conjunto de evidência contra a política pura.
 * Garante que alvo e política não possam divergir em silêncio. */
export function assertMprjAnswerKeyEvidence() {
  const evidence = assertAnswerKeyEvidence(
    MPRJ_XXXIX_PREAMBULAR_ANSWER_KEY_EVIDENCE,
  );
  const target = MPRJ_OFFICIAL_PREVIOUS_EXAM;
  if (
    evidence.finality !== target.answerKeyFinality ||
    evidence.edition.publicId !== target.editionPublicId ||
    evidence.edition.institutionAcronym !== target.institution ||
    evidence.edition.jurisdictionCode !== target.jurisdiction ||
    evidence.edition.roleName !== target.role ||
    evidence.edition.examDate !== target.examDate ||
    evidence.edition.bookletVersionLabel !== target.bookletVersionLabel ||
    evidence.edition.expectedQuestionCount !== target.expectedQuestionCount ||
    evidence.maintenanceAct.decisionLegalBasis !== MPRJ_ANSWER_KEY_DECISION_BASIS
  ) {
    throw new Error("Política de finalidade e alvo MPRJ divergem; cadastro bloqueado.");
  }
  const expectedTypes = requiredAnswerKeyDocumentTypes(evidence.finality);
  const documents = [
    evidence.booklet,
    evidence.preliminaryAnswerKey,
    evidence.maintenanceAct,
  ];
  if (
    documents.length !== target.documents.length ||
    documents.some(
      (document, index) =>
        document.documentType !== expectedTypes[index] ||
        document.documentType !== target.documents[index].documentType ||
        document.sourceUrl !== target.documents[index].url ||
        document.publishedOn !== target.documents[index].publishedOn,
    )
  ) {
    throw new Error("Documentos do alvo MPRJ não correspondem à evidência composta.");
  }
  return evidence;
}

export function assertMprjOfficialAnchors(html: string) {
  const $ = load(html);
  const target = MPRJ_OFFICIAL_PREVIOUS_EXAM;
  const headings = $("h1");
  const heading = normalizeOfficialAnchorText(headings.text());
  // O portal de servidores do MPRJ (/concursos/mprj2025) responde 200 e é outro
  // certame; só o h1 do concurso de ingresso é aceito.
  if (
    headings.length !== 1 ||
    heading !==
      "XXXIX Concurso para Ingresso na Classe Inicial da Carreira do Ministério Público do Estado do Rio de Janeiro"
  ) {
    throw new Error("Portal de outro certame/órgão; cadastro bloqueado.");
  }
  const notice = $("a").filter(
    (_, anchor) => $(anchor).attr("href") === target.noticeUrl,
  );
  if (notice.length !== 1 || !/edital/iu.test(notice.text())) {
    throw new Error("Portal não referencia o edital XXXIX esperado; cadastro bloqueado.");
  }
  const noticeLabel = normalizeOfficialAnchorText(notice.text());
  // A finalidade composta só existe porque não há gabarito definitivo da
  // preambular. Se a FGV publicar um, este operador deixa de valer e recusa aqui,
  // antes de qualquer fingerprint.
  const definitive = $("a").filter((_, anchor) => {
    const text = $(anchor).text().replace(/\s+/gu, " ");
    return /definitiv/iu.test(text) && /preambular/iu.test(text);
  });
  if (definitive.length) {
    throw new Error(
      "Portal anuncia gabarito definitivo da preambular; a evidência composta deixou de ser o caminho e exige decisão própria.",
    );
  }
  const documentEvidence = [];
  for (const document of target.documents) {
    const matches = $("a").filter(
      (_, anchor) => $(anchor).attr("href") === document.url,
    );
    if (
      matches.length !== 1 ||
      normalizeOfficialAnchorText(matches.text()) !== document.label
    ) {
      throw new Error("Anchor oficial ausente, duplicado ou com rótulo diferente.");
    }
    const block = matches.closest(".paragraph--type--texto-data");
    const publishedOn = block.find("time").attr("datetime")?.slice(0, 10);
    if (publishedOn !== document.publishedOn) {
      throw new Error("Data de publicação do link diverge da fonte oficial.");
    }
    const blockText = block.text().replace(/\s+/gu, " ");
    if (
      document.documentType === "question_booklet" &&
      (!blockText.includes(target.role) || !/prova preambular/iu.test(blockText))
    ) {
      throw new Error("Caderno de cargo/etapa diferente.");
    }
    const role = document.documentType === "question_booklet" ? target.role : null;
    const stage = document.documentType === "question_booklet" ? "Prova Preambular" : null;
    if (
      document.documentType === "answer_key" &&
      (!/prelimin/iu.test(document.label) || /definitiv/iu.test(document.label))
    ) {
      throw new Error("Gabarito preliminar não pode ser rotulado como definitivo.");
    }
    documentEvidence.push({
      documentType: document.documentType,
      url: document.url,
      label: normalizeOfficialAnchorText(matches.text()),
      publishedOn,
      role,
      stage,
    });
  }
  return {
    h1: heading,
    notice: { url: target.noticeUrl, label: noticeLabel },
    documents: documentEvidence,
    definitiveAnswerKeyDocument: null,
  };
}

async function boundedOfficialText(url: string, limit: number, fetcher: typeof fetch) {
  const response = await fetcher(url, {
    redirect: "manual",
    signal: AbortSignal.timeout(15_000),
    headers: {
      "User-Agent":
        "EditalLeiSeca-OfficialSourceMonitor/1.0 (+https://editaleiseca.com.br/fontes-e-atualizacao)",
      Accept: "text/html,text/plain",
    },
  });
  if (response.status !== 200 || (response.url && response.url !== url)) {
    throw new Error("Página oficial indisponível ou redirecionada; não contornar bloqueio.");
  }
  const mime = response.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
  if (mime !== "text/plain" && mime !== "text/html") {
    throw new Error("Esperado somente HTML/robots; PDF nunca entra na captura de texto.");
  }
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Página oficial sem corpo.");
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > limit) throw new Error("Página excede limite de metadados.");
      chunks.push(value);
    }
  } finally {
    await reader.cancel();
  }
  return {
    text: new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks)),
    httpStatus: response.status,
  };
}

export async function previewMprjPreviousExam(
  options: { fetcher?: typeof fetch; verifier?: typeof verifyOfficialExamUrl } = {},
) {
  const target = MPRJ_OFFICIAL_PREVIOUS_EXAM;
  const evidence = assertMprjAnswerKeyEvidence();
  const robots = await boundedOfficialText(
    "https://conhecimento.fgv.br/robots.txt",
    64 * 1024,
    options.fetcher ?? fetch,
  );
  for (const url of [
    target.portalUrl,
    target.noticeUrl,
    ...target.documents.map((document) => document.url),
  ]) {
    assertOfficialRobotsPathAllowed(robots.text, new URL(url).pathname);
  }
  const portal = await boundedOfficialText(
    target.portalUrl,
    4 * 1024 * 1024,
    options.fetcher ?? fetch,
  );
  const portalEvidence = assertMprjOfficialAnchors(portal.text);
  const documents = [];
  for (const document of target.documents) {
    const metadata = await (options.verifier ?? verifyOfficialExamUrl)("fgv", document.url);
    if (
      metadata.httpStatus !== 200 ||
      !metadata.isPdf ||
      metadata.finalUrl !== document.url ||
      metadata.contentType?.split(";", 1)[0].trim().toLowerCase() !== "application/pdf"
    ) {
      throw new Error("Link exato não retorna PDF oficial acessível.");
    }
    documents.push({
      ...document,
      ...metadata,
      distributionMode: "external_link",
      sourcePolicy: "metadata_only",
      sourceContentStored: false,
      status: "pending_review",
    });
  }
  return {
    mode: "preview",
    productSlug: target.productSlug,
    editionPublicId: target.editionPublicId,
    observedAt: new Date().toISOString(),
    portalUrl: target.portalUrl,
    portalHttpStatus: portal.httpStatus,
    portalHtmlSha256: createHash("sha256").update(portal.text).digest("hex"),
    portalEvidence,
    robotsSha256: createHash("sha256").update(robots.text).digest("hex"),
    examDate: target.examDate,
    documents,
    answerKeyFinality: target.answerKeyFinality,
    answerKeyProvenance: answerKeyEvidenceProvenance(evidence),
    definitiveAnswerKeyDocument: null,
    noticeEvidence: {
      sourceUrl: target.noticeUrl,
      checksumSha256: target.noticeSha256,
      pages: target.noticePages,
      expectedQuestionCount: target.expectedQuestionCount,
      questionCountCorroboration: MPRJ_QUESTION_COUNT_CORROBORATION,
      pageCount: target.noticePageCount,
    },
    publicationAllowed: false,
    admissionApplied: false,
    latestEditionVerifiedInDatabase: false,
    databaseWrites: 0,
    questionsImported: 0,
    productsReleased: 0,
    humanReview: false,
    verificationPolicy:
      "official_html_anchors_and_bounded_transient_pdf_signature_metadata_no_storage_or_text_extraction",
  };
}

/** Edital aprovado: hash exato, 47 páginas, capa com a identidade do certame e
 * item 11.1 com a data da preambular. A quantidade de questões **não** é extraída
 * do edital; ver MPRJ_QUESTION_COUNT_CORROBORATION. */
export function assertMprjNoticeEvidence(input: {
  checksum: string;
  pages: number;
  identityPage: string;
  datePage: string;
}) {
  const target = MPRJ_OFFICIAL_PREVIOUS_EXAM;
  if (
    input.checksum !== target.noticeSha256 ||
    input.pages !== target.noticePageCount ||
    !/XXXIX/u.test(input.identityPage) ||
    !/MINIST[ÉE]RIO P[ÚU]BLICO DO ESTADO DO RIO DE JANEIRO/iu.test(input.identityPage) ||
    !/Promotor de Justiça Substituto/iu.test(input.identityPage) ||
    !/11\.1[\s\S]*31 de maio de 2026/iu.test(input.datePage) ||
    !/prova preambular/iu.test(input.datePage)
  ) {
    throw new Error("Edital aprovado não comprova certame/cargo/data esperados; cadastro bloqueado.");
  }
}

type MprjPreview = Awaited<ReturnType<typeof previewMprjPreviousExam>>;
export type MprjRegistrationRequest = {
  opportunityPublicId: string;
  expectedNoticeSha256: string;
  mode: "preview" | "apply";
  expectedFingerprint?: string;
};

export function assertMprjRegistrationRequest(request: MprjRegistrationRequest) {
  const target = MPRJ_OFFICIAL_PREVIOUS_EXAM;
  if (
    request.opportunityPublicId !== target.opportunityPublicId ||
    request.expectedNoticeSha256 !== target.noticeSha256 ||
    !["preview", "apply"].includes(request.mode) ||
    (request.mode === "apply" && !/^[a-f0-9]{64}$/u.test(request.expectedFingerprint ?? ""))
  ) {
    throw new Error(
      "Exige oportunidade MPRJ concreta, hash exato e fingerprint explícito para apply.",
    );
  }
}

function assertMprjMetadataFresh(preview: MprjPreview) {
  const target = MPRJ_OFFICIAL_PREVIOUS_EXAM;
  const stamps = [preview.observedAt, ...preview.documents.map((document) => document.checkedAt)];
  if (
    !/^[a-f0-9]{64}$/u.test(preview.portalHtmlSha256) ||
    !/^[a-f0-9]{64}$/u.test(preview.robotsSha256) ||
    preview.portalUrl !== target.portalUrl ||
    preview.portalHttpStatus !== 200 ||
    preview.productSlug !== target.productSlug ||
    preview.editionPublicId !== target.editionPublicId ||
    preview.examDate !== target.examDate ||
    preview.humanReview !== false ||
    preview.answerKeyFinality !== target.answerKeyFinality ||
    preview.definitiveAnswerKeyDocument !== null ||
    preview.answerKeyProvenance.finality !== target.answerKeyFinality ||
    preview.answerKeyProvenance.definitiveAnswerKeyDocument !== null ||
    preview.answerKeyProvenance.decisionEffect !== "all_keys_maintained" ||
    preview.answerKeyProvenance.decisionLegalBasis !== MPRJ_ANSWER_KEY_DECISION_BASIS ||
    preview.answerKeyProvenance.documents.length !== target.documents.length ||
    preview.noticeEvidence.sourceUrl !== target.noticeUrl ||
    preview.noticeEvidence.checksumSha256 !== target.noticeSha256 ||
    preview.noticeEvidence.pageCount !== target.noticePageCount ||
    preview.noticeEvidence.pages.identity !== target.noticePages.identity ||
    preview.noticeEvidence.pages.examDate !== target.noticePages.examDate ||
    preview.noticeEvidence.expectedQuestionCount !== target.expectedQuestionCount ||
    preview.noticeEvidence.questionCountCorroboration.reextractedInThisExecution !== false ||
    preview.documents.length !== target.documents.length ||
    preview.documents.some(
      (document, index) =>
        document.url !== target.documents[index].url ||
        document.documentType !== target.documents[index].documentType ||
        document.publishedOn !== target.documents[index].publishedOn ||
        document.publishedOn <= target.examDate ||
        document.finalUrl !== document.url ||
        document.httpStatus !== 200 ||
        document.contentType?.split(";", 1)[0].trim().toLowerCase() !== "application/pdf" ||
        !document.isPdf ||
        document.sourceContentStored !== false ||
        document.sourcePolicy !== "metadata_only" ||
        document.distributionMode !== "external_link" ||
        document.status !== "pending_review",
    ) ||
    stamps.some((stamp) => {
      const age = Date.now() - new Date(stamp).getTime();
      return !Number.isFinite(age) || age < -30_000 || age > 15 * 60_000;
    })
  ) {
    throw new Error("Metadados incorretos, futuros ou vencidos; repita a conferência.");
  }
}

/** Núcleo transacional: escopo MPRJ exato. O invólucro CLI valida a URL de
 * manutenção. A coerência entre finalidade e documentos presentes não é
 * expressável em CHECK de tabela única e é garantida aqui. */
export async function reviewMprjPreviousExamRegistration(
  tx: postgres.TransactionSql,
  request: MprjRegistrationRequest,
  preview: MprjPreview,
  reviewer: ReturnType<typeof parseOpportunityApprovalReviewerIdentity>,
) {
  assertMprjRegistrationRequest(request);
  assertMprjMetadataFresh(preview);
  if (reviewer.approvalReference !== OFFICIAL_COURSE_STANDING_REFERENCE) {
    throw new Error("Referência permanente exata obrigatória.");
  }
  const target = MPRJ_OFFICIAL_PREVIOUS_EXAM;
  const { opportunityPublicId, expectedNoticeSha256 } = request;
  const [database] = await tx<{ role: string; readOnly: string }[]>`
    select current_user as role, current_setting('transaction_read_only') as "readOnly"`;
  if (
    database.role !== "leiprova_owner" ||
    database.readOnly !== (request.mode === "preview" ? "on" : "off")
  ) {
    throw new Error("Papel/transação não corresponde ao modo solicitado.");
  }
  await tx`set local statement_timeout='30s'`;
  await tx`set local lock_timeout='5s'`;
  const operators = reviewer.email
    ? await tx<{ id: string; role: string }[]>`select id::text, role from users where lower(email)=${reviewer.email} limit 2 ${request.mode === "apply" ? tx`for key share` : tx``}`
    : await tx<{ id: string; role: string }[]>`select id::text, role from users where role='admin' limit 2 ${request.mode === "apply" ? tx`for key share` : tx``}`;
  if (operators.length !== 1 || operators[0].role !== "admin") {
    throw new Error("Administrador único obrigatório.");
  }
  if (request.mode === "apply") {
    await tx`select public.lock_product_binding_review_product(${target.productSlug})`;
  }
  const [identity] = await tx<
    {
      opportunityId: string;
      careerId: string;
      bankId: string;
      baselineEditionId: string | null;
      opportunityUpdatedAt: string;
    }[]
  >`select opportunity.id::text as "opportunityId", opportunity.career_track_id::text as "careerId", bank.id::text as "bankId",
      opportunity.exam_edition_id::text as "baselineEditionId", opportunity.updated_at::text as "opportunityUpdatedAt"
    from contest_store_products product join contest_opportunities opportunity on opportunity.id=product.opportunity_id
    join quiz_career_tracks career on career.id=opportunity.career_track_id join quiz_banks bank on bank.slug='fgv' and bank.is_active
    where product.slug=${target.productSlug} and product.status='draft' and product.preparation_mode='historical_training'
      and product.preparation_approval_reference=${reviewer.approvalReference} and product.preparation_opportunity_updated_at=opportunity.updated_at
      and opportunity.public_id=${opportunityPublicId} and opportunity.slug=${target.opportunitySlug} and opportunity.editorial_status='reviewed'
      and opportunity.institution_acronym='MPRJ' and opportunity.jurisdiction_code='RJ' and opportunity.scope='state' and opportunity.cycle_year=2026
      and opportunity.official_notice_number=${target.noticeNumber} and opportunity.role_name=${target.role} and opportunity.exam_date=${target.examDate}::date
      and opportunity.specialization_id is null and career.slug='promotor-justica' and career.is_active
      and exists(select 1 from opportunity_organizer_assignments organizer where organizer.opportunity_id=opportunity.id
        and organizer.quiz_bank_id=bank.id and organizer.role='examination_provider' and organizer.status='reviewed' and organizer.valid_until is null
        and organizer.valid_from<=(now() at time zone 'America/Sao_Paulo')::date)
      and exists(select 1 from audit_logs admission where admission.entity_id=opportunity.public_id and admission.action='editorial.official_course.composite_standing_admitted'
        and admission.metadata->>'approvalReference'=${reviewer.approvalReference} and admission.metadata->>'humanReview'='false'
        and admission.metadata->>'productSlug'=${target.productSlug}) ${request.mode === "apply" ? tx`for update of product, opportunity` : tx``}`;
  if (!identity) {
    throw new Error("Admissão MPRJ ainda não aplicada ou identidade/vínculo divergem; nenhum cadastro será gravado.");
  }
  if (identity.baselineEditionId !== null) {
    throw new Error("Oportunidade já possui edição-base; não sobrescrever vínculo existente.");
  }
  const snapshots = await tx<
    {
      checksum: string;
      pages: number;
      identityPage: string;
      datePage: string;
      snapshotId: string;
      sourceId: string;
      snapshotUpdatedAt: string;
      sourceStateFingerprint: string;
    }[]
  >`select snapshot.checksum_sha256 as checksum, snapshot.page_count as pages, snapshot.id::text as "snapshotId", source.id::text as "sourceId",
      snapshot.updated_at::text as "snapshotUpdatedAt", encode(sha256(convert_to(to_jsonb(source)::text,'UTF8')),'hex') as "sourceStateFingerprint",
      snapshot.page_texts->>(${target.noticePages.identity - 1}::int) as "identityPage",
      snapshot.page_texts->>(${target.noticePages.examDate - 1}::int) as "datePage"
    from opportunity_document_snapshots snapshot join opportunity_source_documents source on source.id=snapshot.source_document_id
    where source.opportunity_id=${identity.opportunityId} and source.status='approved' and source.source_url=${target.noticeUrl}
      and snapshot.status='approved' and snapshot.checksum_sha256=${expectedNoticeSha256} and source.checksum_sha256=snapshot.checksum_sha256
      and snapshot.document_url=${target.noticeUrl} and encode(sha256(snapshot.document_bytes),'hex')=${expectedNoticeSha256}
      and snapshot.mime_type='application/pdf' and source.document_type='notice' limit 2
      ${request.mode === "apply" ? tx`for share of source,snapshot` : tx``}`;
  if (snapshots.length !== 1) throw new Error("Snapshot único do edital aprovado obrigatório.");
  assertMprjNoticeEvidence(snapshots[0]);
  const assignments = await tx<{ id: string; updatedAt: string }[]>`select id::text, updated_at::text as "updatedAt" from opportunity_organizer_assignments
    where opportunity_id=${identity.opportunityId} and quiz_bank_id=${identity.bankId} and source_document_id=${snapshots[0].sourceId}
      and role='examination_provider' and responsible_type='external_organizer' and status='reviewed'
      and valid_until is null and valid_from<=(now() at time zone 'America/Sao_Paulo')::date limit 2
      ${request.mode === "apply" ? tx`for share` : tx``}`;
  if (assignments.length !== 1) {
    throw new Error("Examinador FGV único e ligado à fonte aprovada obrigatório.");
  }
  const today = saoPauloCalendarDate(new Date());
  if (target.examDate >= today) throw new Error("Prova ainda não realizada.");
  const existing = await tx`select id from exam_editions where public_id=${target.editionPublicId}
    or (institution_acronym='MPRJ' and jurisdiction_code='RJ' and career_track_id=${identity.careerId}
      and specialization_id is null and exam_date=${target.examDate}::date) limit 1`;
  if (existing.length) {
    throw new Error("Edição já existente; não duplicar nem alterar IDs/documentos históricos.");
  }
  const newer = await tx`select id from exam_editions where institution_acronym='MPRJ' and jurisdiction_code='RJ' and career_track_id=${identity.careerId}
    and specialization_id is null and status in ('held','published') and exam_date>${target.examDate}::date and exam_date<${today}::date limit 1`;
  if (newer.length) {
    throw new Error("Existe edição realizada mais recente; seleção exige revisão própria.");
  }
  const actor = operators[0].id;
  const fingerprint = createHash("sha256")
    .update(
      JSON.stringify({
        target: target.editionPublicId,
        opportunityPublicId,
        identity,
        snapshots,
        assignments,
        actor,
        reference: reviewer.approvalReference,
        portalEvidence: preview.portalEvidence,
        robotsSha256: preview.robotsSha256,
        answerKeyFinality: preview.answerKeyFinality,
        answerKeyProvenance: preview.answerKeyProvenance,
        definitiveAnswerKeyDocument: preview.definitiveAnswerKeyDocument,
        questionCountCorroboration: MPRJ_QUESTION_COUNT_CORROBORATION,
        documents: preview.documents.map((document) => ({
          url: document.url,
          documentType: document.documentType,
          publishedOn: document.publishedOn,
          httpStatus: document.httpStatus,
          contentType: document.contentType,
          isPdf: document.isPdf,
          finalUrl: document.finalUrl,
        })),
      }),
    )
    .digest("hex");
  if (request.mode === "preview") {
    return {
      mode: "preview" as const,
      fingerprint,
      productSlug: target.productSlug,
      opportunityPublicId,
      admissionApplied: true,
      latestEditionVerifiedInDatabase: true,
      editionPublicId: target.editionPublicId,
      noticeSha256: expectedNoticeSha256,
      examDate: target.examDate,
      answerKeyFinality: target.answerKeyFinality,
      answerKeyProvenance: preview.answerKeyProvenance,
      definitiveAnswerKeyDocument: null,
      documents: preview.documents,
      databaseWrites: 0,
      questionsImported: 0,
      referencesApproved: 0,
      productsReleased: 0,
      sourceContentStored: false,
      humanReview: false,
      publicationAllowed: false,
    };
  }
  if (request.expectedFingerprint !== fingerprint) {
    throw new Error("Fingerprint da prévia divergiu; recapture e confira antes de apply.");
  }
  const [edition] = await tx<{ id: string }[]>`insert into exam_editions(public_id,career_track_id,bank_id,institution_acronym,jurisdiction_code,source_external_id,title,organizer,jurisdiction,
    official_url,exam_date,status,source_policy,source_content_stored,answer_key_finality,source_page_title,source_http_status,source_checked_at,created_by_user_id,updated_by_user_id)
    values(${target.editionPublicId},${identity.careerId},${identity.bankId},'MPRJ','RJ','fgv-mprj-xxxix-2026-preambular',
      'MPRJ XXXIX/2026 — Promotor de Justiça Substituto — prova preambular','Fundação Getulio Vargas — prova preambular','Rio de Janeiro',${target.portalUrl},${target.examDate},
      'held','metadata_only',false,${target.answerKeyFinality},'XXXIX Concurso para Ingresso na Classe Inicial da Carreira do Ministério Público do Estado do Rio de Janeiro',200,${preview.observedAt},${actor},${actor}) returning id::text`;
  const documentIds: string[] = [];
  for (const document of preview.documents) {
    const publicId = randomUUID();
    documentIds.push(publicId);
    await tx`insert into exam_edition_documents(public_id,exam_edition_id,document_type,title,source_url,source_host,published_at,source_checked_at,http_status,content_type,file_name,
      expected_question_count,distribution_mode,source_policy,status,initiated_by_user_id)
      values(${publicId},${edition.id},${document.documentType},${document.title},${document.url},'conhecimento.fgv.br',${document.publishedOn},${document.checkedAt},200,${document.contentType},
        ${new URL(document.url).pathname.split("/").at(-1)!},${document.documentType === "question_booklet" ? target.expectedQuestionCount : null},'external_link','metadata_only','pending_review',${actor})`;
  }
  const assignmentStamp = new Date().toISOString();
  const updatedOpportunities = await tx<{ id: string }[]>`update contest_opportunities set exam_edition_id=${edition.id}, updated_at=${assignmentStamp}
    where id=${identity.opportunityId} and public_id=${opportunityPublicId} and exam_edition_id is null
      and updated_at::text=${identity.opportunityUpdatedAt} and editorial_status='reviewed'
      and institution_acronym='MPRJ' and jurisdiction_code='RJ' and role_name=${target.role} and official_notice_number=${target.noticeNumber}
      and cycle_year=2026 and exam_date=${target.examDate}::date and career_track_id=${identity.careerId} and specialization_id is null returning id::text`;
  if (updatedOpportunities.length !== 1 || updatedOpportunities[0].id !== identity.opportunityId) {
    throw new Error("Edição-base não atualizou exatamente a oportunidade esperada; transação cancelada.");
  }
  const updatedProducts = await tx<{ slug: string }[]>`update contest_store_products set
    preparation_opportunity_updated_at=(select updated_at from contest_opportunities where id=${identity.opportunityId}), updated_at=${assignmentStamp}
    where slug=${target.productSlug} and opportunity_id=${identity.opportunityId} and status='draft' and preparation_mode='historical_training'
      and preparation_approval_reference=${reviewer.approvalReference} and preparation_opportunity_updated_at::text=${identity.opportunityUpdatedAt} returning slug`;
  if (updatedProducts.length !== 1 || updatedProducts[0].slug !== target.productSlug) {
    throw new Error("Fingerprint do modo não atualizou exatamente o produto esperado; transação cancelada.");
  }
  const metadata = {
    approvalBasis: "owner_standing_authorization",
    approvalReference: reviewer.approvalReference,
    humanReview: false,
    productSlug: target.productSlug,
    opportunityPublicId,
    editionPublicId: target.editionPublicId,
    documentPublicIds: documentIds,
    noticeSha256: expectedNoticeSha256,
    portalHtmlSha256: preview.portalHtmlSha256,
    portalEvidence: preview.portalEvidence,
    fingerprint,
    examDate: target.examDate,
    expectedQuestionCount: target.expectedQuestionCount,
    noticeEvidencePages: [target.noticePages.identity, target.noticePages.examDate],
    answerKeyFinality: target.answerKeyFinality,
    answerKeyProvenance: preview.answerKeyProvenance,
    definitiveAnswerKeyDocument: null,
    questionCountCorroboration: MPRJ_QUESTION_COUNT_CORROBORATION,
    examDateCorroboration: {
      sourceUrl: target.noticeUrl,
      statement: "Item 11.1 do Edital XXXIX: prova preambular em 31 de maio de 2026",
      observedOn: "2026-10-14",
      provenance: "approved_notice_snapshot_page_text_in_this_execution",
      headerReextractedInThisExecution: false,
    },
    documents: preview.documents,
    documentStatus: "pending_review",
    sourcePolicy: "metadata_only",
    sourceContentStored: false,
    latestEditionVerifiedInDatabase: true,
    assignedBaselineEdition: true,
    assignedBaselineEditionId: edition.id,
    assignmentStamp,
    questionsImported: 0,
    referencesApproved: 0,
    productsReleased: 0,
    publicationAllowed: false,
    executionSource: "server_cli",
  };
  const [audit] = await tx<{ id: string }[]>`insert into audit_logs(actor_user_id,action,entity_type,entity_id,metadata)
    values(${actor},'editorial.previous_exam.mprj_metadata_registered','exam_edition',${target.editionPublicId},${tx.json(metadata as unknown as postgres.JSONValue)}) returning id::text`;
  return { mode: "applied", ...metadata, auditId: audit.id };
}

export async function registerMprjPreviousExam(request: MprjRegistrationRequest) {
  assertMprjRegistrationRequest(request);
  const databaseUrl = requireStandingCourseMaintenanceDatabaseUrl(
    process.env.MIGRATION_DATABASE_URL,
  );
  const reviewer = parseOpportunityApprovalReviewerIdentity({
    ADMIN_EMAILS: process.env.ADMIN_EMAILS,
    OPPORTUNITY_APPROVAL_REFERENCE: process.env.OPPORTUNITY_APPROVAL_REFERENCE,
  });
  if (reviewer.approvalReference !== OFFICIAL_COURSE_STANDING_REFERENCE) {
    throw new Error("Referência permanente exata obrigatória.");
  }
  const preview = await previewMprjPreviousExam();
  const client = postgres(databaseUrl, { max: 1, prepare: false, connect_timeout: 5 });
  try {
    return await client.begin(
      request.mode === "preview"
        ? "isolation level repeatable read read only"
        : "isolation level serializable",
      (tx) => reviewMprjPreviousExamRegistration(tx, request, preview, reviewer),
    );
  } finally {
    await client.end();
  }
}
