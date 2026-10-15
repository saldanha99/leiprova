import { sql, type SQL } from "drizzle-orm";
import * as cheerio from "cheerio";
import {
  CAMARA_CP_CORRECTION,
  CP63_EXPECTED_HELD_IDS,
  cpCorrectionSha256,
  parseCamaraCpCorrectionCapture,
  type fetchCamaraCpCorrectionEvidence,
} from "../official-sources/camara-cp-correction-parser";
import { assertOfficialRobotsPathAllowed } from "../official-sources/planalto-text";
import { normalizeOfficialText } from "../official-sources/text-normalization";
import {
  CP_CUT_REFERENCE,
  CP_CUT_PRODUCT,
  CP_CUT_CONTRACT,
  CP_CUT_POLICY,
  CP_CUT_OPINION_HASH,
  CP_CUT_ITEMS,
  assertCpCutFresh,
} from "../official-sources/cp-coordinated-cut";
import { approvedProductQuestionCount } from "../commerce/minimum-course-content";
import { questionContractContentHash } from "./question-contract-query";

export const CP_RECONCILIATION_POLICY = "cp-post-suspension-reconciliation-preview-v1";
export const CP_RECONCILIATION_REFERENCE = CP_CUT_REFERENCE;
export const CP_ACT_ID = 17;
export const CP_V63_ID = 63;
export const CP_V112_ID = 112;
export const CP_MONITOR_SNAPSHOT_ID = 2757;
export const CP_TEXT_SNAPSHOT_ID = 1660;
export const CP_RECEIPT_ID = 1;
export const CP_REQUIREMENT_ID = 667;
export const CP_V112_ARTICLE_351_ID = 11029;
export const CP_QUESTION_IDS = [1285, 1286, 1287, 1288, 1289] as const;
export const CP_CUT_INITIAL_AUDIT_ID = 8308;
export const CP_SUSPENSION_AUDIT_ID = 10902;

export type FreshCpEvidence = Awaited<ReturnType<typeof fetchCamaraCpCorrectionEvidence>>;

import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { PgTransaction } from "drizzle-orm/pg-core";
import type * as schema from "../db/schema";

type Db = PostgresJsDatabase<typeof schema>;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
export type { PgTransaction };

export interface MockExecutor {
  execute<T extends Record<string, unknown> = Record<string, unknown>>(
    query: SQL
  ): Promise<T[]>;
}

export type Executor = Tx | MockExecutor;

export interface CpObservedState {
  policy: string;
  approvalReference: string;
  session: {
    database: string;
    role: string;
    readOnly: string;
  };
  source: {
    robotsStatus: number;
    robotsSha256: string;
    rawSha256: string;
    canonicalSha256: string;
    amendmentRawSha256: string;
    articleCount: number;
    corpusFingerprint: string;
  };
  act: {
    id: number;
    slug: string;
    urn: string;
    active: boolean;
    actType: string;
    actNumber: string;
    actYear: number;
  };
  versions: {
    v63: {
      id: number;
      status: string;
      checksum: string;
      sourceUrl: string;
      totalArticles: number;
      heldArticleIds: readonly number[];
    };
    v112: {
      id: number;
      status: string;
      checksum: string;
      sourceUrl: string;
      totalArticles: number;
      articlesDigest: string;
    };
  };
  receipt1: {
    id: number;
    status: string;
    fingerprint: string;
    legalVersionId: number;
    approvalReference: string;
    humanReview: boolean;
    approvalAuditId: number;
  };
  snapshots: {
    monitor2757: {
      id: number;
      status: string;
      checksum: string;
      articleMarkerCount: number;
    };
    text1660: {
      id: number;
      status: string;
      checksum: string;
      articleCount: number;
      parserVersion: string;
    };
  };
  auditTrail: {
    initialCutAuditId: number;
    suspensionAuditId: number;
    suspensionReason: string;
  };
  requirement: {
    id: number;
    opportunityId: number;
    legalActId: number;
    legalArticleId: number;
    editorialStatus: string;
  };
  dependencies: Array<{
    id: number;
    editorialStatus: string;
    legalArticleId: number;
    contentHash: string;
    bindingId: string;
    productSlug: string;
    opportunityId: number;
    requirementId: number;
    sourceDocumentId: number;
    sourceSnapshotId: number | null;
    sourceSnapshotChecksum: string | null;
    legalVersionId: number;
    bindingLegalArticleId: number;
    legalVersionChecksum: string;
    bindingStatus: string;
    correctionPolicy: string | null;
    correctionOpinionHash: string | null;
    certStatus: string | null;
    contractId: string | null;
    certQuestionContentHash: string | null;
    options: Array<{
      option_key: string;
      text: string;
      is_correct: boolean;
      sort_order: number;
    }>;
  }>;
  offers: Array<{
    slug: string;
    opportunityId: number;
    status: string;
    currentValidCount: number;
    projectedValidCount: number;
    netDifference: number;
    floorMetCurrent: boolean;
    floorMetProjected: boolean;
  }>;
}

export interface CpReconciliationPreviewResult {
  mode: "preview_only";
  fingerprint: string;
  policy: string;
  approvalReference: string;
  humanReview: false;
  disclaimer: string;
  source: {
    canonicalUrl: string;
    rawSha256: string;
    canonicalSha256: string;
    articleCount: 402;
    amendmentUrl: string;
    amendmentRawSha256: string;
    fetchedAt: string;
    matchesOfficialPin: boolean;
  };
  act: {
    id: 17;
    slug: string;
    urn: string;
    active: boolean;
    actType: string;
    actNumber: string;
    actYear: number;
  };
  versions: {
    v63: {
      id: 63;
      status: "superseded";
      totalArticles: 423;
      suspendedArticles: 27;
      verified: boolean;
    };
    v112: {
      id: 112;
      status: "pending_review";
      totalArticles: 402;
      verifiedAgainstFresh: boolean;
      canonicalChecksum: string;
    };
  };
  receipt1: {
    id: 1;
    status: "suspended";
    fingerprint: string;
    legalVersionId: 112;
    approvalReference: string;
    isImmutable: boolean;
  };
  snapshots: {
    monitor2757: {
      id: 2757;
      status: "rejected";
      articleMarkerCount: 402;
      checksumSha256: string;
    };
    text1660: {
      id: 1660;
      status: "rejected";
      articleCount: 402;
      parserVersion: string;
      checksumSha256: string;
    };
  };
  auditTrail: {
    initialCutAuditId: number;
    suspensionAuditId: number;
    suspensionReason: string;
    suspensionHypothesisNote: string;
  };
  dependencies: {
    requirement667: {
      id: 667;
      legalArticleId: 11029;
      editorialStatus: "reviewed";
      articleRef: string;
      additionalArticlesCount: number;
    };
    questions: Array<{
      id: number;
      editorialStatus: string;
      legalArticleId: number;
      articleRef: string;
      bindingId: string;
      bindingStatus: string;
      certStatus: string;
      contractId: string;
    }>;
  };
  offers: {
    totalReleased: number;
    products: Array<{
      slug: string;
      status: string;
      currentValidCount: number;
      projectedValidCount: number;
      netDifference: number;
      floorMetCurrent: boolean;
      floorMetProjected: boolean;
    }>;
    enacDetail: {
      currentValidCount: number;
      projectedValidCount: number;
      netRehabilitated: 5;
      floorMetCurrent: boolean;
      floorMetProjected: boolean;
    };
  };
  projection: {
    newAuthorialQuestions: 0;
    rehabilitatedLegacyQuestions: 5;
    databaseWrites: 0;
    currentVersionsModified: 0;
    receiptsCreated: 0;
    pinsUpdated: 0;
    transactionReadOnly: true;
  };
  observedAt: string;
}

export function computeCpReconciliationFingerprint(state: CpObservedState): string {
  return cpCorrectionSha256(JSON.stringify(state));
}

export async function validateCpReconciliationContext(
  tx: Executor,
  fresh: FreshCpEvidence
): Promise<CpReconciliationPreviewResult> {
  assertCpCutFresh(fresh.body.fetchedAt);
  assertCpCutFresh(fresh.amendment.fetchedAt);
  assertCpCutFresh(fresh.robots.fetchedAt);

  // 1. Validar identidade da sessão e transação somente leitura
  const [session] = await tx.execute<{ database: string; role: string; readOnly: string }>(
    sql`select current_database() as database, current_user as role, current_setting('transaction_read_only') as "readOnly"`
  );
  if (session?.database !== "leiprova" || session?.role !== "leiprova_owner") {
    throw new Error("Alvo efetivo divergente: exige banco leiprova e role leiprova_owner.");
  }
  if (session?.readOnly !== "on") {
    throw new Error("Transação somente leitura não confirmada: transaction_read_only deve ser 'on'.");
  }

  // 2. Validar prova oficial fresca contra os pins canônicos (R5, R8)
  // R8: Conferir robots de corpo e emenda
  if (fresh.robots.status !== 200 && fresh.robots.status !== 404) {
    throw new Error(`robots.txt da Câmara respondeu com status HTTP ${fresh.robots.status}; captura bloqueada.`);
  }
  if (fresh.robots.status !== 404) {
    if (!/^text\/plain(?:;|$)/iu.test(fresh.robots.mime)) {
      throw new Error("robots.txt da Câmara não respondeu como política textual; captura bloqueada.");
    }
    const robotsTxt = new TextDecoder("utf-8", { fatal: true }).decode(fresh.robots.bytes);
    assertOfficialRobotsPathAllowed(robotsTxt, new URL(CAMARA_CP_CORRECTION.url).pathname);
    assertOfficialRobotsPathAllowed(robotsTxt, new URL(CAMARA_CP_CORRECTION.amendmentUrl).pathname);
  }

  // R8: Validar HTTP status e MIME de corpo e emenda
  if (fresh.body.status !== 200 || !/^text\/html(?:;|$)/iu.test(fresh.body.mime)) {
    throw new Error(`Corpo oficial do CP com status HTTP ${fresh.body.status} ou MIME inválido.`);
  }
  if (fresh.amendment.status !== 200 || !/^text\/html(?:;|$)/iu.test(fresh.amendment.mime)) {
    throw new Error(`Emenda oficial da Lei 15.517 com status HTTP ${fresh.amendment.status} ou MIME inválido.`);
  }

  // R5: Recomputar hashes e parsing diretamente dos bytes reais de fresh.body
  const verifiedCapture = parseCamaraCpCorrectionCapture(
    fresh.body.bytes,
    CAMARA_CP_CORRECTION.url,
    fresh.body.mime
  );

  // Validar amendment bytes e identidade da Lei 15.517
  if (cpCorrectionSha256(fresh.amendment.bytes) !== CAMARA_CP_CORRECTION.amendmentRawSha256) {
    throw new Error("Lei 15.517 mudou; hash bruto diverge do pin oficial homologado.");
  }
  const $amendment = cheerio.load(new TextDecoder("utf-8", { fatal: true }).decode(fresh.amendment.bytes));
  $amendment("script,style,noscript").remove();
  const amendmentText = normalizeOfficialText($amendment("body").text());
  if (!/LEI Nº 15\.517/iu.test(amendmentText) || !amendmentText.includes("23/09/2026")) {
    throw new Error("Identidade/publicação da Lei 15.517 inválida no HTML oficial.");
  }

  if (
    fresh.parsed.rawSha256 !== verifiedCapture.rawSha256 ||
    fresh.parsed.canonicalSha256 !== verifiedCapture.canonicalSha256 ||
    fresh.parsed.articles.length !== 402
  ) {
    throw new Error("Captura oficial fresca diverge dos pins normativos homologados da Câmara/Lei 15.517.");
  }

  // 3. Validar ato 17 (Código Penal)
  const [act] = await tx.execute<{
    id: number;
    slug: string;
    urn: string;
    active: boolean;
    actType: string;
    actNumber: string;
    actYear: number;
  }>(
    sql`select id::int as id, slug, urn, is_active as active, act_type as "actType", act_number as "actNumber", act_year as "actYear"
        from legal_acts where id = ${CP_ACT_ID}`
  );
  if (
    !act ||
    act.id !== CP_ACT_ID ||
    act.slug !== "codigo-penal" ||
    act.urn !== "urn:lex:br:federal:decreto.lei:1940-12-07;2848" ||
    !act.active ||
    act.actType !== "decreto-lei" ||
    act.actNumber !== "2.848" ||
    act.actYear !== 1940
  ) {
    throw new Error("Identidade do Código Penal (ato 17) divergente.");
  }

  // 4. Validar versões 63 e 112
  const versions = await tx.execute<{
    id: number;
    legalActId: number;
    status: string;
    checksum: string;
    sourceUrl: string;
  }>(
    sql`select id::int as id, legal_act_id::int as "legalActId", status, checksum_sha256 as checksum, source_url as "sourceUrl"
        from legal_versions where legal_act_id = ${CP_ACT_ID} and id in (${CP_V63_ID}, ${CP_V112_ID}) order by id`
  );
  const v63 = versions.find(v => v.id === CP_V63_ID);
  const v112 = versions.find(v => v.id === CP_V112_ID);
  if (
    !v63 ||
    v63.status !== "superseded" ||
    v63.checksum !== CAMARA_CP_CORRECTION.oldVersionChecksum ||
    v63.sourceUrl !== "https://legis.senado.leg.br/norma/527942/publicacao/39870011"
  ) {
    throw new Error("Versão 63 (Senado) divergente: exige status 'superseded' e checksum original.");
  }
  if (
    !v112 ||
    v112.status !== "pending_review" ||
    v112.checksum !== CAMARA_CP_CORRECTION.canonicalSha256 ||
    v112.sourceUrl !== CAMARA_CP_CORRECTION.url
  ) {
    throw new Error("Versão 112 (Câmara) divergente: exige status 'pending_review' e checksum da Câmara.");
  }

  // 5. Validar 27 suspensões na versão 63
  const heldArticles = await tx.execute<{ id: number }>(
    sql`select id::int as id from legal_articles
        where legal_version_id = ${CP_V63_ID} and editorial_status = 'suspended' order by id`
  );
  const observedHeldIds = heldArticles.map(a => a.id);
  const expectedHeldIdsSorted = [...CP63_EXPECTED_HELD_IDS].sort((a, b) => a - b);
  if (JSON.stringify(observedHeldIds) !== JSON.stringify(expectedHeldIdsSorted)) {
    throw new Error("As 27 suspensões históricas da versão 63 foram alteradas ou divergem.");
  }

  const [v63Count] = await tx.execute<{ total: number }>(
    sql`select count(*)::int as total from legal_articles where legal_version_id = ${CP_V63_ID}`
  );
  if (v63Count?.total !== 423) {
    throw new Error(`Contagem de artigos da versão 63 divergente: esperado 423, observado ${v63Count?.total}.`);
  }

  // 6. Validar corpus 402 integral da versão 112 contra a captura fresca revalidada
  const v112Articles = await tx.execute<{
    id: number;
    path: string;
    articleRef: string;
    articleOrder: number;
    literalText: string;
    editorialStatus: string;
    sourceRights: string;
  }>(
    sql`select id::int as id, path, article_ref as "articleRef", article_order as "articleOrder",
               literal_text as "literalText", editorial_status as "editorialStatus", source_rights as "sourceRights"
        from legal_articles where legal_version_id = ${CP_V112_ID} order by article_order, id`
  );
  if (v112Articles.length !== 402) {
    throw new Error(`Versão 112 no banco não contém 402 artigos: observado ${v112Articles.length}.`);
  }
  for (let i = 0; i < 402; i++) {
    const stored = v112Articles[i];
    const official = verifiedCapture.articles[i];
    const expectedOrder = i + 1;
    if (
      stored.articleOrder !== expectedOrder ||
      stored.path !== official.path ||
      stored.articleRef !== official.articleRef ||
      stored.literalText !== official.literalText ||
      stored.editorialStatus !== "reviewed" ||
      stored.sourceRights !== "official_text"
    ) {
      throw new Error(`Artigo ${expectedOrder} (${stored.path}) da versão 112 diverge da redação oficial fresca.`);
    }
  }

  const article351 = v112Articles.find(a => a.path === "art-351");
  if (!article351 || article351.id !== CP_V112_ARTICLE_351_ID) {
    throw new Error(`Artigo 351 da versão 112 divergente: esperado ID ${CP_V112_ARTICLE_351_ID}, observado ${article351?.id}.`);
  }

  // 7. Validar recibo 1 suspenso imutável (R6: exigir receipt1.approvalAuditId === 8308)
  const [receipt1] = await tx.execute<{
    id: number;
    status: string;
    fingerprint: string;
    legalVersionId: number;
    approvalReference: string;
    humanReview: boolean;
    approvalAuditId: number;
  }>(
    sql`select id::int as id, status, fingerprint, legal_version_id::int as "legalVersionId",
               approval_reference as "approvalReference", human_review as "humanReview",
               approval_audit_id::int as "approvalAuditId"
        from legal_cp_correction_evidence where id = ${CP_RECEIPT_ID}`
  );
  if (
    !receipt1 ||
    receipt1.id !== CP_RECEIPT_ID ||
    receipt1.status !== "suspended" ||
    receipt1.fingerprint !== "9731686a9d6a3f08fc0e16bff44c9645a0f3a4e4684923c303d249f713f70031" ||
    receipt1.legalVersionId !== CP_V112_ID ||
    receipt1.approvalReference !== CP_RECONCILIATION_REFERENCE ||
    receipt1.humanReview !== false ||
    receipt1.approvalAuditId !== CP_CUT_INITIAL_AUDIT_ID
  ) {
    throw new Error("Recibo 1 suspenso não confirmado ou alterado indevidamente.");
  }

  // 8. Validar snapshots 2757 e 1660 rejeitados
  const [monitorSnapshot] = await tx.execute<{
    id: number;
    legalActId: number;
    status: string;
    checksum: string;
    articleMarkerCount: number;
  }>(
    sql`select id::int as id, legal_act_id::int as "legalActId", status, checksum_sha256 as checksum, article_marker_count as "articleMarkerCount"
        from legal_source_snapshots where id = ${CP_MONITOR_SNAPSHOT_ID}`
  );
  const [textSnapshot] = await tx.execute<{
    id: number;
    legalActId: number;
    monitorSnapshotId: number;
    status: string;
    checksum: string;
    articleCount: number;
    parserVersion: string;
  }>(
    sql`select id::int as id, legal_act_id::int as "legalActId", monitor_snapshot_id::int as "monitorSnapshotId",
               status, checksum_sha256 as checksum, article_count as "articleCount", parser_version as "parserVersion"
        from legal_text_snapshots where id = ${CP_TEXT_SNAPSHOT_ID}`
  );
  if (
    !monitorSnapshot ||
    monitorSnapshot.status !== "rejected" ||
    monitorSnapshot.legalActId !== CP_ACT_ID ||
    monitorSnapshot.articleMarkerCount !== 402 ||
    monitorSnapshot.checksum !== CAMARA_CP_CORRECTION.canonicalSha256
  ) {
    throw new Error("Snapshot de monitor 2757 divergente: exige status 'rejected'.");
  }
  if (
    !textSnapshot ||
    textSnapshot.status !== "rejected" ||
    textSnapshot.legalActId !== CP_ACT_ID ||
    textSnapshot.monitorSnapshotId !== CP_MONITOR_SNAPSHOT_ID ||
    textSnapshot.articleCount !== 402 ||
    textSnapshot.parserVersion !== "camara-cp-correction-preview-v1.0.0" ||
    textSnapshot.checksum !== CAMARA_CP_CORRECTION.canonicalSha256
  ) {
    throw new Error("Snapshot de texto 1660 divergente: exige status 'rejected'.");
  }

  // 9. Validar trilha de auditoria real
  const [cutAudit] = await tx.execute<{ id: number; action: string }>(
    sql`select id::int as id, action from audit_logs where id = ${CP_CUT_INITIAL_AUDIT_ID}`
  );
  const [suspensionAudit] = await tx.execute<{ id: number; action: string; reason: string; rawSha: string | null }>(
    sql`select id::int as id, action, metadata->>'reason' as reason, metadata->>'rawSha256' as "rawSha"
        from audit_logs where id = ${CP_SUSPENSION_AUDIT_ID}`
  );
  if (!cutAudit || cutAudit.action !== "editorial.legal_cp.coordinated_cut") {
    throw new Error(`Auditoria inicial do corte ${CP_CUT_INITIAL_AUDIT_ID} não confirmada.`);
  }
  if (
    !suspensionAudit ||
    suspensionAudit.action !== "editorial.legal_cp.source_suspended" ||
    suspensionAudit.reason !== "official_capture_unavailable_changed_or_current_corpus_divergent" ||
    suspensionAudit.rawSha !== null
  ) {
    throw new Error(`Auditoria de suspensão ${CP_SUSPENSION_AUDIT_ID} divergente.`);
  }

  // 10. Validar requisito 667
  const [requirement] = await tx.execute<{
    id: number;
    opportunityId: number;
    legalActId: number;
    legalArticleId: number;
    editorialStatus: string;
  }>(
    sql`select id::int as id, opportunity_id::int as "opportunityId", legal_act_id::int as "legalActId",
               legal_article_id::int as "legalArticleId", editorial_status as "editorialStatus"
        from opportunity_requirements where id = ${CP_REQUIREMENT_ID}`
  );
  const [extraReqArticles] = await tx.execute<{ count: number }>(
    sql`select count(*)::int as count from opportunity_requirement_articles where requirement_id = ${CP_REQUIREMENT_ID}`
  );
  if (
    !requirement ||
    requirement.legalActId !== CP_ACT_ID ||
    requirement.legalArticleId !== CP_V112_ARTICLE_351_ID ||
    requirement.editorialStatus !== "reviewed" ||
    requirement.opportunityId !== 2 ||
    extraReqArticles?.count !== 0
  ) {
    throw new Error("Requisito 667 divergente: exige vínculo com Art. 351 (id 11029) e status 'reviewed'.");
  }

  // 11. Validar as 5 dependências (questões 1285-1289) uma a uma contra CP_CUT_ITEMS e o contrato editorial
  const questionRows = await tx.execute<{
    id: number;
    editorialStatus: string;
    legalArticleId: number;
    type: string;
    sourceRights: string;
    quizMode: string;
    styleBankId: number | null;
    contentHash: string;
    articleRef: string;
    bindingId: string;
    productSlug: string;
    opportunityId: number;
    requirementId: number;
    sourceDocumentId: number;
    sourceSnapshotId: number | null;
    sourceSnapshotChecksum: string | null;
    legalVersionId: number;
    bindingLegalArticleId: number;
    legalVersionChecksum: string;
    bindingStatus: string;
    correctionPolicy: string | null;
    correctionOpinionHash: string | null;
    bindingApprovalReference: string | null;
    bindingHumanReview: boolean | null;
    certStatus: string | null;
    contractId: string | null;
    certHumanReview: boolean | null;
    certApprovalReference: string | null;
    certQuestionContentHash: string | null;
    options: Array<{
      option_key: string;
      text: string;
      is_correct: boolean;
      sort_order: number;
    }>;
  }>(
    sql`select q.id::int as id, q.editorial_status as "editorialStatus", q.legal_article_id::int as "legalArticleId",
               q.type, q.source_rights as "sourceRights", q.quiz_mode as "quizMode", q.style_bank_id::int as "styleBankId",
               ${questionContractContentHash(sql`q.id`)} as "contentHash",
               a.article_ref as "articleRef",
               b.id as "bindingId", b.product_slug as "productSlug", b.opportunity_id::int as "opportunityId",
               b.requirement_id::int as "requirementId", b.source_document_id::int as "sourceDocumentId",
               b.source_snapshot_id::int as "sourceSnapshotId", b.source_snapshot_checksum as "sourceSnapshotChecksum",
               b.legal_version_id::int as "legalVersionId", b.legal_article_id::int as "bindingLegalArticleId",
               b.legal_version_checksum as "legalVersionChecksum", b.status as "bindingStatus",
               b.evidence->>'correctionPolicy' as "correctionPolicy",
               b.evidence->>'correctionOpinionHash' as "correctionOpinionHash",
               b.evidence->>'approvalReference' as "bindingApprovalReference",
               (b.evidence->>'humanReview')::boolean as "bindingHumanReview",
               c.status as "certStatus", c.contract_id as "contractId",
               c.human_review as "certHumanReview",
               c.approval_reference as "certApprovalReference",
               c.question_content_hash as "certQuestionContentHash",
               coalesce((select jsonb_agg(to_jsonb(opt) order by opt.sort_order)
                         from question_options opt where opt.question_id = q.id), '[]'::jsonb) as options
        from questions q
        join legal_articles a on a.id = q.legal_article_id
        join contest_product_question_bindings b on b.question_id = q.id
        left join question_contract_certifications c on c.binding_id = b.id
        where q.id in (${sql.join(CP_QUESTION_IDS.map(id => sql`${id}`), sql`,`)})
          and b.legal_version_id = ${CP_V112_ID}
          and b.product_slug = ${CP_CUT_PRODUCT}
          and b.opportunity_id = 2
          and b.requirement_id = ${CP_REQUIREMENT_ID}
        order by q.id, b.id`
  );
  if (questionRows.length !== 5) {
    throw new Error(`As 5 questões CP/ENAC divergentes: esperado exatamente 5 registros, observado ${questionRows.length}.`);
  }
  const uniqueQuestionIds = new Set(questionRows.map(q => q.id));
  if (uniqueQuestionIds.size !== 5) {
    throw new Error("Identificadores de questões duplicados ou incompletos na checagem das 5 dependências.");
  }
  for (let i = 0; i < 5; i++) {
    const q = questionRows[i];
    const item = CP_CUT_ITEMS[i];
    const expectedId = item[0];
    const expectedAnswer = item[1];
    const expectedContentHash = item[4];

    if (q.id !== expectedId) {
      throw new Error(`Ordem ou ID da questão diverge: esperado ${expectedId}, observado ${q.id}.`);
    }
    if (q.contentHash !== expectedContentHash) {
      throw new Error(`Hash do conteúdo da questão ${q.id} diverge do parecer técnico: esperado ${expectedContentHash}, observado ${q.contentHash}.`);
    }
    if (q.certQuestionContentHash !== expectedContentHash) {
      throw new Error(`Hash do certificado da questão ${q.id} diverge: esperado ${expectedContentHash}, observado ${q.certQuestionContentHash}.`);
    }
    if (q.editorialStatus !== "reviewed" || q.legalArticleId !== CP_V112_ARTICLE_351_ID) {
      throw new Error(`Questão ${q.id} deve estar reviewed e vinculada ao Art. 351 (id ${CP_V112_ARTICLE_351_ID}).`);
    }
    if (q.type !== "multiple_choice" || q.sourceRights !== "original_authorial" || q.quizMode !== "original_style" || q.styleBankId !== 2) {
      throw new Error(`Questão ${q.id} diverge do contrato editorial (múltipla escolha, autoral, original_style, banca Vunesp id 2).`);
    }
    if (q.productSlug !== CP_CUT_PRODUCT || q.opportunityId !== 2 || q.requirementId !== CP_REQUIREMENT_ID) {
      throw new Error(`Vínculo da questão ${q.id} fora do produto ENAC / oportunidade 2 / requisito ${CP_REQUIREMENT_ID}.`);
    }
    if (q.sourceDocumentId !== 4 || q.sourceSnapshotId !== 5 || q.sourceSnapshotChecksum !== "6b1343fbbb45d3d2d40cc618aebcf3e15319b365896436daf8e5f9ab3089e0e1") {
      throw new Error(`Vínculo da questão ${q.id} aponta para documento/snapshot de fonte divergente.`);
    }
    if (q.legalVersionId !== CP_V112_ID || q.bindingLegalArticleId !== CP_V112_ARTICLE_351_ID || q.legalVersionChecksum !== CAMARA_CP_CORRECTION.canonicalSha256) {
      throw new Error(`Vínculo da questão ${q.id} aponta para versão/artigo legal divergente.`);
    }
    if (q.bindingStatus !== "approved" || q.correctionPolicy !== CP_CUT_POLICY || q.correctionOpinionHash !== CP_CUT_OPINION_HASH || q.bindingApprovalReference !== CP_CUT_REFERENCE || q.bindingHumanReview !== false) {
      throw new Error(`Vínculo da questão ${q.id} com política/parecer/status divergente.`);
    }
    if (q.certStatus !== "approved" || q.contractId !== CP_CUT_CONTRACT || q.certHumanReview !== false || q.certApprovalReference !== CP_CUT_REFERENCE) {
      throw new Error(`Certificação de contrato da questão ${q.id} divergente ou ausente.`);
    }
    if (!Array.isArray(q.options) || q.options.length !== 5) {
      throw new Error(`Questão ${q.id} não possui exatamente 5 alternativas.`);
    }
    const correctOptions = q.options.filter(o => o.is_correct === true);
    if (correctOptions.length !== 1 || correctOptions[0].option_key !== expectedAnswer) {
      throw new Error(`Gabarito da questão ${q.id} diverge: esperado ${expectedAnswer}, observado ${correctOptions[0]?.option_key}.`);
    }
    for (let optIdx = 0; optIdx < 5; optIdx++) {
      const opt = q.options[optIdx];
      if (opt.option_key !== "ABCDE"[optIdx] || opt.sort_order !== optIdx) {
        throw new Error(`Alternativas da questão ${q.id} fora da ordem canônica A-E.`);
      }
    }
  }

  // 12. Consultar dinamicamente todas as ofertas liberadas (status = 'released')
  // Usar o predicado completo de comércio: approvedProductQuestionCount (que revalida
  // todas as evidências, contratos, certificações, snapshots e versão legal).
  const currentProducts = await tx.execute<{
    slug: string;
    status: string;
    opportunityId: number;
    currentValidCount: number;
  }>(
    sql`select p.slug, p.status, p.opportunity_id::int as "opportunityId",
          ${approvedProductQuestionCount(sql`p.slug`, sql`p.opportunity_id`)} as "currentValidCount"
        from contest_store_products p
        where p.status = 'released'
        order by p.slug`
  );

  // Projeção CTE: sombreia legal_versions simulando unicamente a versão 112 como 'current',
  // preservando todas as demais colunas e avaliando o predicado completo approvedProductQuestionCount.
  const projectedProducts = await tx.execute<{
    slug: string;
    projectedValidCount: number;
  }>(
    sql`with legal_versions as not materialized (
          select
            v.id,
            v.legal_act_id,
            v.source_url,
            v.checksum_sha256,
            v.published_at,
            v.valid_from,
            v.valid_until,
            v.verified_at,
            case when v.id = ${CP_V112_ID} then 'current'::text else v.status end as status,
            v.created_at
          from public.legal_versions v
        )
        select p.slug,
          ${approvedProductQuestionCount(sql`p.slug`, sql`p.opportunity_id`)} as "projectedValidCount"
        from contest_store_products p
        where p.status = 'released'
        order by p.slug`
  );

  if (currentProducts.length === 0) {
    throw new Error("Nenhum produto liberado encontrado na consulta dinâmica de ofertas.");
  }

  if (currentProducts.length !== projectedProducts.length) {
    throw new Error("Cardinalidade divergente entre consultas atual e projetada de ofertas.");
  }

  for (let i = 0; i < currentProducts.length; i++) {
    if (currentProducts[i].slug !== projectedProducts[i].slug) {
      throw new Error(`Ordem ou chave de produto divergente na projeção: atual ${currentProducts[i].slug}, projetado ${projectedProducts[i].slug}.`);
    }
  }

  const storeProducts = currentProducts.map((curr, i) => {
    const proj = projectedProducts[i];
    return {
      slug: curr.slug,
      opportunityId: curr.opportunityId,
      status: curr.status,
      currentValidCount: curr.currentValidCount,
      projectedValidCount: proj.projectedValidCount,
    };
  });

  const enacProduct = storeProducts.find(p => p.slug === CP_CUT_PRODUCT);
  if (!enacProduct) {
    throw new Error(`Produto ${CP_CUT_PRODUCT} não encontrado na lista de ofertas liberadas.`);
  }

  for (const product of storeProducts) {
    const diff = product.projectedValidCount - product.currentValidCount;
    if (product.slug === CP_CUT_PRODUCT) {
      if (diff !== 5) {
        throw new Error(
          `Projeção no ENAC divergente: esperado acréscimo exato de +5 de reabilitação, observado ${diff}.`
        );
      }
      if (product.projectedValidCount < 68) {
        throw new Error(
          `Produto projetado ${product.slug} abaixo do piso legal de 68 questões (projetado ${product.projectedValidCount}).`
        );
      }
    } else {
      if (diff !== 0) {
        throw new Error(`Produto ${product.slug} teve variação indevida de ${diff} na projeção CP.`);
      }
      if (product.currentValidCount < 68 || product.projectedValidCount < 68) {
        throw new Error(`Produto liberado ${product.slug} abaixo do piso legal de 68 questões.`);
      }
    }
  }

  // R7: Calcular fingerprint sobre todos os estados observados completos relevantes
  const articlesDigest = cpCorrectionSha256(
    v112Articles.map(a => `${a.articleOrder}:${a.path}:${cpCorrectionSha256(a.literalText)}`).join("\n")
  );

  const observedState: CpObservedState = {
    policy: CP_RECONCILIATION_POLICY,
    approvalReference: CP_RECONCILIATION_REFERENCE,
    session: {
      database: session.database,
      role: session.role,
      readOnly: session.readOnly,
    },
    source: {
      robotsStatus: fresh.robots.status,
      robotsSha256: cpCorrectionSha256(fresh.robots.bytes),
      rawSha256: verifiedCapture.rawSha256,
      canonicalSha256: verifiedCapture.canonicalSha256,
      amendmentRawSha256: cpCorrectionSha256(fresh.amendment.bytes),
      articleCount: verifiedCapture.articles.length,
      corpusFingerprint: cpCorrectionSha256(
        verifiedCapture.articles.map(a => `${a.path}\n${a.literalText}`).join("\n\n")
      ),
    },
    act: {
      id: act.id,
      slug: act.slug,
      urn: act.urn,
      active: act.active,
      actType: act.actType,
      actNumber: act.actNumber,
      actYear: act.actYear,
    },
    versions: {
      v63: {
        id: v63.id,
        status: v63.status,
        checksum: v63.checksum,
        sourceUrl: v63.sourceUrl,
        totalArticles: v63Count.total,
        heldArticleIds: observedHeldIds,
      },
      v112: {
        id: v112.id,
        status: v112.status,
        checksum: v112.checksum,
        sourceUrl: v112.sourceUrl,
        totalArticles: v112Articles.length,
        articlesDigest,
      },
    },
    receipt1: {
      id: receipt1.id,
      status: receipt1.status,
      fingerprint: receipt1.fingerprint,
      legalVersionId: receipt1.legalVersionId,
      approvalReference: receipt1.approvalReference,
      humanReview: receipt1.humanReview,
      approvalAuditId: receipt1.approvalAuditId,
    },
    snapshots: {
      monitor2757: {
        id: monitorSnapshot.id,
        status: monitorSnapshot.status,
        checksum: monitorSnapshot.checksum,
        articleMarkerCount: monitorSnapshot.articleMarkerCount,
      },
      text1660: {
        id: textSnapshot.id,
        status: textSnapshot.status,
        checksum: textSnapshot.checksum,
        articleCount: textSnapshot.articleCount,
        parserVersion: textSnapshot.parserVersion,
      },
    },
    auditTrail: {
      initialCutAuditId: cutAudit.id,
      suspensionAuditId: suspensionAudit.id,
      suspensionReason: suspensionAudit.reason,
    },
    requirement: {
      id: requirement.id,
      opportunityId: requirement.opportunityId,
      legalActId: requirement.legalActId,
      legalArticleId: requirement.legalArticleId,
      editorialStatus: requirement.editorialStatus,
    },
    dependencies: questionRows.map(q => ({
      id: q.id,
      editorialStatus: q.editorialStatus,
      legalArticleId: q.legalArticleId,
      contentHash: q.contentHash,
      bindingId: q.bindingId,
      productSlug: q.productSlug,
      opportunityId: q.opportunityId,
      requirementId: q.requirementId,
      sourceDocumentId: q.sourceDocumentId,
      sourceSnapshotId: q.sourceSnapshotId,
      sourceSnapshotChecksum: q.sourceSnapshotChecksum,
      legalVersionId: q.legalVersionId,
      bindingLegalArticleId: q.bindingLegalArticleId,
      legalVersionChecksum: q.legalVersionChecksum,
      bindingStatus: q.bindingStatus,
      correctionPolicy: q.correctionPolicy,
      correctionOpinionHash: q.correctionOpinionHash,
      certStatus: q.certStatus,
      contractId: q.contractId,
      certQuestionContentHash: q.certQuestionContentHash,
      options: q.options.map(opt => ({
        option_key: opt.option_key,
        text: opt.text,
        is_correct: opt.is_correct,
        sort_order: opt.sort_order,
      })),
    })),
    offers: storeProducts.map(p => ({
      slug: p.slug,
      opportunityId: p.opportunityId,
      status: p.status,
      currentValidCount: p.currentValidCount,
      projectedValidCount: p.projectedValidCount,
      netDifference: p.projectedValidCount - p.currentValidCount,
      floorMetCurrent: p.currentValidCount >= 68,
      floorMetProjected: p.projectedValidCount >= 68,
    })),
  };

  const fingerprint = computeCpReconciliationFingerprint(observedState);

  return {
    mode: "preview_only",
    fingerprint,
    policy: CP_RECONCILIATION_POLICY,
    approvalReference: CP_RECONCILIATION_REFERENCE,
    humanReview: false,
    disclaimer: "prepared não é aprovação e nenhuma revisão humana é presumida",
    source: {
      canonicalUrl: CAMARA_CP_CORRECTION.url,
      rawSha256: verifiedCapture.rawSha256,
      canonicalSha256: verifiedCapture.canonicalSha256,
      articleCount: 402,
      amendmentUrl: CAMARA_CP_CORRECTION.amendmentUrl,
      amendmentRawSha256: cpCorrectionSha256(fresh.amendment.bytes),
      fetchedAt: fresh.body.fetchedAt.toISOString(),
      matchesOfficialPin: true,
    },
    act: {
      id: 17,
      slug: act.slug,
      urn: act.urn,
      active: act.active,
      actType: act.actType,
      actNumber: act.actNumber,
      actYear: act.actYear,
    },
    versions: {
      v63: {
        id: 63,
        status: "superseded",
        totalArticles: 423,
        suspendedArticles: 27,
        verified: true,
      },
      v112: {
        id: 112,
        status: "pending_review",
        totalArticles: 402,
        verifiedAgainstFresh: true,
        canonicalChecksum: v112.checksum,
      },
    },
    receipt1: {
      id: 1,
      status: "suspended",
      fingerprint: receipt1.fingerprint,
      legalVersionId: 112,
      approvalReference: receipt1.approvalReference,
      isImmutable: true,
    },
    snapshots: {
      monitor2757: {
        id: 2757,
        status: "rejected",
        articleMarkerCount: 402,
        checksumSha256: monitorSnapshot.checksum,
      },
      text1660: {
        id: 1660,
        status: "rejected",
        articleCount: 402,
        parserVersion: textSnapshot.parserVersion,
        checksumSha256: textSnapshot.checksum,
      },
    },
    auditTrail: {
      initialCutAuditId: CP_CUT_INITIAL_AUDIT_ID,
      suspensionAuditId: CP_SUSPENSION_AUDIT_ID,
      suspensionReason: suspensionAudit.reason,
      suspensionHypothesisNote:
        "Hipótese técnica: falha transitória de busca HTTP/TLS da Câmara às 20h47 UTC de 12/10; rawSha nulo indica que a captura não retornou corpo válido na chamada, mas a causa externa não está comprovada como fato absoluto.",
    },
    dependencies: {
      requirement667: {
        id: 667,
        legalArticleId: CP_V112_ARTICLE_351_ID,
        editorialStatus: "reviewed",
        articleRef: article351.articleRef,
        additionalArticlesCount: 0,
      },
      questions: questionRows.map(q => {
        if (!q.certStatus || !q.contractId) {
          throw new Error(`Questão ${q.id} sem certificação ou contrato válido.`);
        }
        return {
          id: q.id,
          editorialStatus: q.editorialStatus,
          legalArticleId: q.legalArticleId,
          articleRef: q.articleRef,
          bindingId: q.bindingId,
          bindingStatus: q.bindingStatus,
          certStatus: q.certStatus,
          contractId: q.contractId,
        };
      }),
    },
    offers: {
      totalReleased: storeProducts.length,
      products: storeProducts.map(p => ({
        slug: p.slug,
        status: p.status,
        currentValidCount: p.currentValidCount,
        projectedValidCount: p.projectedValidCount,
        netDifference: p.projectedValidCount - p.currentValidCount,
        floorMetCurrent: p.currentValidCount >= 68,
        floorMetProjected: p.projectedValidCount >= 68,
      })),
      enacDetail: {
        currentValidCount: enacProduct.currentValidCount,
        projectedValidCount: enacProduct.projectedValidCount,
        netRehabilitated: 5,
        floorMetCurrent: enacProduct.currentValidCount >= 68,
        floorMetProjected: enacProduct.projectedValidCount >= 68,
      },
    },
    projection: {
      newAuthorialQuestions: 0,
      rehabilitatedLegacyQuestions: 5,
      databaseWrites: 0,
      currentVersionsModified: 0,
      receiptsCreated: 0,
      pinsUpdated: 0,
      transactionReadOnly: true,
    },
    observedAt: new Date().toISOString(),
  };
}
