import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";

import { CAMARA_PROCUREMENT_SOURCE } from "./camara-procurement-text";
import { getOfficialLegalSource } from "./legal-registry";
import { parseConsolidatedLegalArticles } from "./legal-text";
import { OFFICIAL_LAW_STANDING_REFERENCE, parseStandingLawReviewArgs, standingLawFingerprint, type StandingLawContext } from "./standing-law-review";

export { OFFICIAL_LAW_STANDING_REFERENCE };
export type StandingProcurementContext = StandingLawContext;
export const PROCUREMENT_PARTIAL_POLICY = "camara-14133-partial-182-reviewed-9-pending-v1";
export const PROCUREMENT_RECONCILIATION_DOSSIER = "7bf19c75cb52d961a06ba4640f5d2819c1695ab4801ee368d4c81f46dc85dfd0";
export const PROCUREMENT_RECONCILED_RAW_PDF = "55643452fd720ee726267f62ad2ee59bff0120c5ec9495b9ee7babc74c5ea026";
export const PROCUREMENT_RECONCILED_CORPUS = "e622788d8a7da96d4e77deb8a1ea458ca1014fc44a8dd8a86df310d02a598e8a";
export const PROCUREMENT_PENDING_ARTICLES = [
  { path: "art-6", reasons: ["annual_monetary_dependency_not_integrated"] },
  { path: "art-37", reasons: ["annual_monetary_dependency_not_integrated"] },
  { path: "art-70", reasons: ["annual_monetary_dependency_not_integrated"] },
  { path: "art-75", reasons: ["annual_monetary_dependency_not_integrated", "adi6890_complete_primary_decision_not_reviewed"] },
  { path: "art-95", reasons: ["annual_monetary_dependency_not_integrated"] },
  { path: "art-184-a", reasons: ["annual_monetary_dependency_not_integrated"] },
  { path: "art-175", reasons: ["expired_2023_window_requires_temporal_context"] },
  { path: "art-191", reasons: ["old_tender_regime_choice_closed_requires_temporal_context"] },
  { path: "art-193", reasons: ["revocation_2023_requires_temporal_context"] },
] as const;

// Private dossier bodies are not shipped. These are only the exact primary
// publication provenance and hashes of the 11 compared legal provisions.
export const PROCUREMENT_VETO_EVIDENCE = {
  "dossierSha256": "7bf19c75cb52d961a06ba4640f5d2819c1695ab4801ee368d4c81f46dc85dfd0",
  "corpusSha256": "e622788d8a7da96d4e77deb8a1ea458ca1014fc44a8dd8a86df310d02a598e8a",
  "literalMatches": 11,
  "humanReview": false,
  "sources": [
    {
      "url": "https://www2.camara.leg.br/legin/fed/lei/2021/lei-14133-1-abril-2021-791222-promulgacaodevetos-162977-pl.html",
      "rawSha256": "25fdd612587a58d486c87984be27b4ccb791d685e4b94053173e5660a45146d1",
      "fetchedAtUTC": "2026-10-12T04:56:23.478455+00:00"
    },
    {
      "url": "https://www2.camara.leg.br/legin/fed/lei/2023/lei-14770-22-dezembro-2023-795113-promulgacaodevetos-171846-pl.html",
      "rawSha256": "e14e4f58e8215b3fcdbe3193044721ae20d135985d9f93ae7981858beb28393b",
      "fetchedAtUTC": "2026-10-12T04:56:47.841856+00:00"
    },
    {
      "url": "https://www2.camara.leg.br/legin/fed/lei/2023/lei-14770-22-dezembro-2023-795113-promulgacaodevetos-175775-pl.html",
      "rawSha256": "8fbb4017e7ade846ee47cb654704f4c3e38e562eadee0429c8ade11591e400bc",
      "fetchedAtUTC": "2026-10-12T04:56:48.264683+00:00"
    }
  ],
  "clauses": [
    {
      "path": "art-37",
      "marker": "§ 2º",
      "segmentSha256": "5b042280f3ee080c8466df7fba9c5eaf0c90102b59983e5b1324a64d08943401"
    },
    {
      "path": "art-54",
      "marker": "§ 1º",
      "segmentSha256": "3f463cbd04626f67360b4e388fd3b3bae9393ef59346bad066f2172f460cf1c5"
    },
    {
      "path": "art-115",
      "marker": "§ 4º",
      "segmentSha256": "8dd6136bf3bf2a6af602bd69920b9c5ccf6228c9b28d493ad153436d5f20126c"
    },
    {
      "path": "art-175",
      "marker": "§ 2º",
      "segmentSha256": "2673c997a0cdbf3979bd8185f8f9661904204b8a3460c176968c7f095742963d"
    },
    {
      "path": "art-90",
      "marker": "§ 8º",
      "segmentSha256": "31ba197a77b7a9eef1048fd9bc9d544afac021c0ac2c87a4b7d6e122377830d0"
    },
    {
      "path": "art-90",
      "marker": "§ 9º",
      "segmentSha256": "c69d0e3090debc3a39bf350872ad2887b4b66729af2fd25a743bca30f5609009"
    },
    {
      "path": "art-105",
      "marker": "Parágrafo único.",
      "segmentSha256": "528c736e417955af2da04a08b1d7c9b681f27c8d9ad3c0db8bc5cb3c1f0f0cbd"
    },
    {
      "path": "art-184-a",
      "marker": "§ 2º",
      "segmentSha256": "4c7c98f872453ff9a70666ed8c360eaf658f9667db7e205a99d19bb9d984c849"
    },
    {
      "path": "art-184",
      "marker": "§ 4º",
      "segmentSha256": "d15b68d764570e540dc470d3139b75870574dc0ce162afecac23b23357c7eaf3"
    },
    {
      "path": "art-184-a",
      "marker": "III -",
      "segmentSha256": "24032af5f644878c2f72b67d5b422af9d56a3c1edb6509fdf4e64ac9cf88cffe"
    },
    {
      "path": "art-184-a",
      "marker": "§ 3º",
      "segmentSha256": "ec15881d405fc5dc2d8160a23dbd9268748dec810f70569de8e6fd37ba6f2037"
    }
  ]
} as const;

const HASH = /^[a-f0-9]{64}$/u;
const sha = (value: string) => createHash("sha256").update(value).digest("hex");
const canonical = (articles: ReturnType<typeof parseConsolidatedLegalArticles>) => articles.map((article) => [article.path, "", article.literalText].join("\n")).join("\n\n");

export function parseStandingProcurementReviewArgs(argv: readonly string[]) {
  const extra = new Map<string, string>();
  const base: string[] = [];
  for (const arg of argv) {
    const match = /^(rawpdf|dossier)=([^=]+)$/u.exec(arg);
    if (!match) { base.push(arg); continue; }
    if (extra.has(match[1]) || !HASH.test(match[2])) throw new Error("Hash de PDF/dossiê desconhecido ou repetido.");
    extra.set(match[1], match[2]);
  }
  const command = parseStandingLawReviewArgs(base);
  if (command.inspect) {
    if (extra.size) throw new Error("--inspect não recebe prova de aprovação.");
    return command;
  }
  if (extra.get("rawpdf") !== PROCUREMENT_RECONCILED_RAW_PDF || extra.get("dossier") !== PROCUREMENT_RECONCILIATION_DOSSIER) throw new Error("Exige rawpdf e dossier exatos da reconciliação oficial delimitada.");
  return { ...command, rawpdf: extra.get("rawpdf")!, dossier: extra.get("dossier")! };
}

export function standingProcurementFingerprint(context: StandingProcurementContext) {
  return sha(JSON.stringify({ context: standingLawFingerprint(context), policy: PROCUREMENT_PARTIAL_POLICY, pendingArticles: PROCUREMENT_PENDING_ARTICLES, evidence: PROCUREMENT_VETO_EVIDENCE, rawPdf: PROCUREMENT_RECONCILED_RAW_PDF }));
}

export function validateStandingProcurementIdentity(context: StandingProcurementContext) {
  const registered = getOfficialLegalSource("lei-licitacoes-contratos-2021")!;
  if (context.act.slug !== registered.slug || !context.act.isActive || context.act.officialUrl !== registered.officialUrl || context.act.urn !== registered.lexmlUrn || context.act.actType !== "lei" || context.act.actNumber !== "14.133" || context.act.actYear !== 2021 || context.act.jurisdiction !== "federal") throw new Error("Ato fora da identidade delimitada da Lei 14.133.");
  if (context.monitor.legalActId !== context.act.id || context.text.legalActId !== context.act.id || context.text.monitorSnapshotId !== context.monitor.id || context.monitor.sourceUrl !== CAMARA_PROCUREMENT_SOURCE.monitorUrl || context.text.sourceUrl !== CAMARA_PROCUREMENT_SOURCE.url || context.text.parserVersion !== CAMARA_PROCUREMENT_SOURCE.parserVersion) throw new Error("Fonte, parser ou vínculo de monitoramento fora do escopo.");
  if (!["pending_review", "approved"].includes(context.monitor.status) || !["pending_review", "approved"].includes(context.text.status)) throw new Error("Fotografia rejeitada/superada não pode ser reativada.");
}

export function validateStandingProcurementCorpus(context: StandingProcurementContext) {
  validateStandingProcurementIdentity(context);
  const { text, monitor } = context;
  if (text.contentLength !== text.normalizedContent.length || text.contentLength < 1_000 || !HASH.test(text.checksumSha256) || sha(monitor.normalizedContent) !== monitor.checksumSha256) throw new Error("Integridade da fotografia divergente.");
  const articles = parseConsolidatedLegalArticles(text.normalizedContent);
  const expected = new Set([...Array.from({ length: 194 }, (_, index) => index + 1).filter((number) => ![172, 177, 178, 179, 188].includes(number)).map((number) => `art-${number}`), "art-44-a", "art-184-a"]);
  if (text.articleCount !== 191 || articles.length !== 191 || new Set(articles.map((article) => article.path)).size !== 191 || articles.some((article) => !expected.has(article.path))) throw new Error("Seleção diverge dos 191 artigos integrais delimitados.");
  for (const article of articles) {
    if (article.heading !== null || /\((?:VETAD|REVOGAD)|reda[cç][aã]o dada|acrescid[oa] pela|Vide Decreto|Vide ADI|\ufffd/iu.test(article.literalText)) throw new Error(`Título, texto editorial ou retirado em ${article.path}.`);
  }
  if (sha([text.sourceUrl, text.parserVersion, canonical(articles)].join("\n")) !== text.checksumSha256) throw new Error("Checksum não corresponde à origem/parser/corpus.");
  return articles;
}

export function validateProcurementVetoReconciliation(articles: ReturnType<typeof parseConsolidatedLegalArticles>) {
  for (const clause of PROCUREMENT_VETO_EVIDENCE.clauses) {
    const article = articles.find((candidate) => candidate.path === clause.path);
    // Require paragraph/incipit at a reconstructed line boundary, never a
    // cross-reference that happens to contain the same marker.
    const start = article?.literalText.split("\n").findIndex((line) => line.startsWith(clause.marker)) ?? -1;
    if (!article || start < 0) throw new Error(`Prova de veto ausente em ${clause.path} ${clause.marker}.`);
    const lines = article.literalText.split("\n").slice(start);
    const end = clause.marker === "III -" ? 1 : lines.findIndex((line, index) => index > 0 && /^(?:§ |Par[aá]grafo [uú]nico\.)/u.test(line));
    const segment = (end < 0 ? lines : lines.slice(0, end)).join("\n").normalize("NFC").replace(/[“”]/gu, '"').replace(/\s+/gu, " ").trim();
    if (sha(segment) !== clause.segmentSha256) throw new Error(`Segmento diverge da promulgação confrontada em ${clause.path} ${clause.marker}.`);
  }
  return PROCUREMENT_VETO_EVIDENCE;
}

export function partitionStandingProcurementArticles(articles: ReturnType<typeof parseConsolidatedLegalArticles>) {
  const pending = new Set<string>(PROCUREMENT_PENDING_ARTICLES.map((article) => article.path));
  const reviewed = articles.filter((article) => !pending.has(article.path));
  const deferred = articles.filter((article) => pending.has(article.path));
  if (articles.length !== 191 || new Set(articles.map((article) => article.path)).size !== 191 || reviewed.length !== 182 || deferred.length !== 9 || new Set(deferred.map((article) => article.path)).size !== 9 || PROCUREMENT_PENDING_ARTICLES.some((article) => !deferred.some((candidate) => candidate.path === article.path))) throw new Error("Partição fixa 182 revisados / 9 pendentes divergente.");
  return { reviewed, deferred };
}

type Capture = { sourceUrl: string; checksumSha256: string; normalizedContent: string; fetchedAt: Date };
export type FreshProcurementCapture = { monitor: Capture; text: Capture & { parserVersion: string; articleCount: number; contentLength: number; rawPdfChecksumSha256: string; pageCount: number } };

export function validateFreshStandingProcurementCapture(context: StandingProcurementContext, expected: { checksum: string; fingerprint: string; rawpdf: string; dossier: string }, fresh: FreshProcurementCapture, now = new Date()) {
  const articles = validateStandingProcurementCorpus(context);
  if (context.text.checksumSha256 !== expected.checksum || standingProcurementFingerprint(context) !== expected.fingerprint) throw new Error("Checksum ou fingerprint esperado mudou; preparar nova prévia.");
  if (expected.rawpdf !== PROCUREMENT_RECONCILED_RAW_PDF || expected.dossier !== PROCUREMENT_RECONCILIATION_DOSSIER || fresh.text.rawPdfChecksumSha256 !== expected.rawpdf || sha(canonical(articles)) !== PROCUREMENT_RECONCILED_CORPUS || fresh.text.pageCount !== 88) throw new Error("PDF bruto/corpus/dossiê não corresponde à reconciliação delimitada.");
  validateProcurementCaptureFreshness(context, fresh, now);
  validateProcurementVetoReconciliation(articles);
  return { articles, ...partitionStandingProcurementArticles(articles) };
}

export function validateStandingProcurementExistingArticles(articles: ReturnType<typeof parseConsolidatedLegalArticles>, existing: readonly { path: string; literalText: string; status: string; rights: string; heading: string | null; articleRef: string; articleOrder: number }[]) {
  const { reviewed, deferred } = partitionStandingProcurementArticles(articles);
  const pending = new Set(deferred.map((article) => article.path));
  if (existing.length !== 191 || new Set(existing.map((row) => row.path)).size !== 191 || articles.some((article) => !existing.some((row) => row.path === article.path && row.literalText === article.literalText && row.heading === article.heading && row.articleRef === article.articleRef && row.articleOrder === article.articleOrder && row.rights === "official_text" && row.status === (pending.has(article.path) ? "pending_review" : "reviewed")))) throw new Error("Artigos divergentes do recibo 182 reviewed / 9 pending_review; não restaurar silenciosamente.");
  return { reviewedArticleCount: reviewed.length, pendingArticleCount: deferred.length };
}

export function validateStandingProcurementReceipt(metadata: Record<string, unknown> | undefined, checksum: string, fingerprint: string) {
  if (!metadata || metadata.approvalReference !== OFFICIAL_LAW_STANDING_REFERENCE || metadata.approvalMode !== "owner_standing_authorization" || metadata.humanReview !== false || metadata.partialApproval !== true || metadata.policy !== PROCUREMENT_PARTIAL_POLICY || metadata.checksum !== checksum || metadata.fingerprint !== fingerprint || metadata.capturedArticleCount !== 191 || metadata.reviewedArticleCount !== 182 || metadata.pendingArticleCount !== 9 || metadata.rawPdfChecksumSha256 !== PROCUREMENT_RECONCILED_RAW_PDF || metadata.dossierSha256 !== PROCUREMENT_RECONCILIATION_DOSSIER || !isDeepStrictEqual(metadata.pendingArticles, PROCUREMENT_PENDING_ARTICLES) || !isDeepStrictEqual(metadata.vetoReconciliation, PROCUREMENT_VETO_EVIDENCE)) throw new Error("Recibo parcial sem a política, provas ou partição exatas.");
}

export function validateProcurementCaptureFreshness(context: StandingProcurementContext, fresh: FreshProcurementCapture, now = new Date()) {
  for (const capture of [fresh.monitor, fresh.text]) {
    const age = now.getTime() - capture.fetchedAt.getTime();
    if (!Number.isFinite(age) || age < -30_000 || age > 300_000) throw new Error("Conferência oficial sem frescor para esta execução.");
  }
  if (fresh.monitor.sourceUrl !== context.monitor.sourceUrl || fresh.monitor.checksumSha256 !== context.monitor.checksumSha256 || fresh.monitor.normalizedContent !== context.monitor.normalizedContent || fresh.text.sourceUrl !== context.text.sourceUrl || fresh.text.checksumSha256 !== context.text.checksumSha256 || fresh.text.normalizedContent !== context.text.normalizedContent || fresh.text.parserVersion !== context.text.parserVersion || fresh.text.articleCount !== 191 || fresh.text.contentLength !== context.text.contentLength) throw new Error("Nova captura oficial diverge da fotografia indicada.");
}
