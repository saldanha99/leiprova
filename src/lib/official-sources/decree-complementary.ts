import { createHash } from "node:crypto";
import * as cheerio from "cheerio";

import { parseConsolidatedLegalArticles } from "./legal-text";
import { assertOfficialRobotsPathAllowed } from "./planalto-text";
import { PROCUREMENT_2026_AMOUNTS, PROCUREMENT_CONTEXT_SOURCE } from "./procurement-context";
import { normalizeOfficialText } from "./text-normalization";

export const DECREE_COMPLEMENTARY_PARSER = "camara-decree-12807-body-annex-v1";
export const DECREE_COMPLEMENTARY_POLICY = "decree-12807-applied-values-2026-v1";
export const DECREE_METADATA_URL = "https://www2.camara.leg.br/legin/fed/decret/2025/decreto-12807-29-dezembro-2025-798615-norma-pe.html";
export const DECREE_METADATA_RAW_SHA = "64bba0bf0f12c09cd0ac59c686f1b35fb5e55a440cbc3a3527b2e79a5f3b5df6";
export const DECREE_SOURCE_KEYS = ["decree-12807-2025-body-2026", "decree-12807-2025-annex-2026"] as const;
export const DECREE_BODY_NORMALIZED_SHA = "5c4c9f103ef230574bb034709ae8b377d8447e95ae604be0f0e137ed2c9f24b0";
export const DECREE_ANNEX_NORMALIZED_SHA = "ddbdd639d2139bb56d156267d4ca875a4e56e97e4cc3e2764a4a8ae94906fe7e";
const sha = (text: string | Uint8Array) => createHash("sha256").update(text).digest("hex");
const canonicalJson = (object: unknown): string => JSON.stringify(object, (_key, value: unknown) => value && typeof value === "object" && !Array.isArray(value) ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b))) : value);
const amountFacts = { policy: DECREE_COMPLEMENTARY_POLICY, amounts: PROCUREMENT_2026_AMOUNTS, statutoryNominalAmountsUnchanged: true, judicialRecontractingExcluded: true, coverageIsNotNormativeExpiry: true };

function assertRaw(bytes: Uint8Array, expected: string) {
  if (sha(bytes) !== expected) throw new Error("Fonte bruta mudou; exige nova reconciliação oficial, sem aprovação por similaridade.");
}

export function parseDecreeBody(bytes: Uint8Array) {
  assertRaw(bytes, PROCUREMENT_CONTEXT_SOURCE.decree.rawSha256);
  const $ = cheerio.load(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  if (!/DECRETO\s+N[º°o]?\.?\s*12\.807/u.test($("h1").text()) || $(".textoNorma .texto").length !== 1) throw new Error("Identidade/corpo do Decreto 12.807 divergente.");
  const root = $(".textoNorma .texto");
  if (root.find("del,s,strike").length) throw new Error("Texto revogado/tachado inesperado no decreto.");
  root.find("br").replaceWith("\n"); root.find("p").append("\n");
  const text = normalizeOfficialText(root.text()).split(/Bras[ií]lia,/u, 1)[0];
  const articles = parseConsolidatedLegalArticles(text.slice(text.indexOf("Art. 1")));
  if (articles.length !== 5 || articles.some((article, index) => article.path !== `art-${index + 1}` || article.heading !== null) || !articles[4].literalText.includes("1º de janeiro de 2026") || !articles[3].literalText.includes("12.343")) throw new Error("Dispositivos/vigência/revogação do decreto não conferidos.");
  return articles.map((article) => article.literalText).join("\n\n");
}

type PdfItem = { str: string; x: number; y: number };
/** Layout is tied to the exact raw PDF, not a general newspaper scraper. */
export function reconstructDecreeAnnexTable(items: readonly PdfItem[]) {
  const selected = items.filter((item) => item.x >= 60 && item.x < 390 && item.y >= 70 && item.y < 275 && item.str.trim() && item.str.trim() !== ".");
  const lines = new Map<number, PdfItem[]>();
  for (const item of selected) { const y = Math.round(item.y * 10) / 10; lines.set(y, [...(lines.get(y) ?? []), item]); }
  const rows: string[] = [];
  for (const [, line] of [...lines.entries()].sort(([a], [b]) => b - a)) {
    const text = normalizeOfficialText(line.sort((a, b) => a.x - b.x).map((item) => item.str).join(" ")).replace(/\s+([,;)])/gu, "$1");
    if (text.startsWith("Art.")) rows.push(text);
    else if (rows.length) rows[rows.length - 1] += ` ${text}`;
    else throw new Error("Continuação de tabela sem dispositivo.");
  }
  const expectedLabels = ["Art. 6º, caput, inciso XXII", "Art. 37, § 2º", "Art. 70, caput, inciso III", "Art. 75, caput, inciso I", "Art. 75, caput, inciso II", 'Art. 75, caput, inciso IV, alínea "c"', "Art. 75, § 7º", "Art. 95, § 2º", "Art. 184-A"];
  if (rows.length !== 9 || rows.some((row, index) => !row.startsWith(expectedLabels[index]) || !row.includes(`R$ ${PROCUREMENT_2026_AMOUNTS[index].brl} (`) || !row.endsWith(")"))) throw new Error("Tabela não coincide com os nove dispositivos/limites conferidos.");
  return `ANEXO — Atualização dos valores estabelecidos na Lei nº 14.133, de 1º de abril de 2021\n${rows.join("\n")}`;
}

export async function parseDecreeAnnex(bytes: Uint8Array) {
  assertRaw(bytes, PROCUREMENT_CONTEXT_SOURCE.annex.rawSha256);
  if (new TextDecoder("ascii").decode(bytes.slice(0, 5)) !== "%PDF-") throw new Error("Anexo sem assinatura PDF.");
  const { getDocumentProxy } = await import("unpdf");
  const document = await getDocumentProxy(new Uint8Array(bytes));
  try {
    if (document.numPages !== 1) throw new Error("Anexo fora da página oficial delimitada.");
    const content = await (await document.getPage(1)).getTextContent();
    const items = content.items.filter((item): item is typeof item & { str: string; transform: number[] } => "str" in item && "transform" in item).map((item) => ({ str: item.str, x: item.transform[4], y: item.transform[5] }));
    return reconstructDecreeAnnexTable(items);
  } finally { await document.cleanup(); }
}

export function prepareDecreeComplementaryEvidence(input: { bodyBytes: Uint8Array; body: string; annexBytes: Uint8Array; annex: string; metadataBytes: Uint8Array; fetchedAt: Date }) {
  assertRaw(input.bodyBytes, PROCUREMENT_CONTEXT_SOURCE.decree.rawSha256); assertRaw(input.annexBytes, PROCUREMENT_CONTEXT_SOURCE.annex.rawSha256); assertRaw(input.metadataBytes, DECREE_METADATA_RAW_SHA);
  const metadata = cheerio.load(new TextDecoder("utf-8", { fatal: true }).decode(input.metadataBytes));
  const metaText = normalizeOfficialText(metadata("body").text());
  if (!metaText.includes("Não consta revogação expressa") || !/DECRETO\s+N[º°o]?\.?\s*12\.807/u.test(metaText)) throw new Error("Situação/identidade atual do decreto divergente.");
  if (input.body !== parseDecreeBody(input.bodyBytes) || sha(input.body) !== DECREE_BODY_NORMALIZED_SHA || sha(input.annex) !== DECREE_ANNEX_NORMALIZED_SHA) throw new Error("Corpo normalizado divergente/incompleto.");
  const observation = { metadataUrl: DECREE_METADATA_URL, metadataRawSha256: sha(input.metadataBytes), observedAt: input.fetchedAt.toISOString(), expressRevocationReported: false, doesNotPromiseFutureValidity: true };
  const parts = [
    { sourceKey: DECREE_SOURCE_KEYS[0], sourceKind: "annual_decree_body", sourceUrl: PROCUREMENT_CONTEXT_SOURCE.decree.url, rawChecksumSha256: sha(input.bodyBytes), normalizedBody: input.body },
    { sourceKey: DECREE_SOURCE_KEYS[1], sourceKind: "annual_decree_annex", sourceUrl: PROCUREMENT_CONTEXT_SOURCE.annex.url, rawChecksumSha256: sha(input.annexBytes), normalizedBody: input.annex },
  ].map((part) => ({ ...part, normalizedChecksumSha256: sha(part.normalizedBody), parserVersion: DECREE_COMPLEMENTARY_PARSER, sourceActType: "decreto", sourceActNumber: "12.807", sourceActYear: 2025, normativeEffectiveFrom: "2026-01-01", normativeValidUntil: null, editorialCoverageFrom: "2026-01-01", editorialCoverageThrough: "2026-12-31", facts: amountFacts, sourceValidityObservation: observation, fetchedAt: input.fetchedAt }));
  const fingerprint = sha(canonicalJson(parts.map((part) => ({ ...part, fetchedAt: null, sourceValidityObservation: { ...part.sourceValidityObservation, observedAt: null } }))));
  return { fingerprint, parts: parts.map((part) => ({ ...part, evidenceFingerprint: fingerprint })), publicationAllowed: false as const, humanReview: false as const };
}

export async function fetchDecreeComplementaryEvidence() {
  const headers = { "User-Agent": "EditalLeiSeca-OfficialSourceMonitor/1.0 (+https://editaleiseca.com.br/fontes-e-atualizacao)", Accept: "text/html,application/pdf;q=0.9,text/plain;q=0.8" };
  const read = async (url: string, max: number) => {
    const response = await fetch(url, { headers, redirect: "manual", signal: AbortSignal.timeout(20_000), cache: "no-store" });
    if (!response.ok || response.redirected || response.url !== url) throw new Error(`Fonte complementar HTTP ${response.status}/URL divergente; sem contorno.`);
    const declared = Number(response.headers.get("content-length")); if (Number.isFinite(declared) && declared > max) throw new Error("Fonte complementar excede o limite.");
    if (!response.body) throw new Error("Fonte complementar sem corpo.");
    const chunks: Uint8Array[] = []; let size = 0; const reader = response.body.getReader();
    try { while (true) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > max) throw new Error("Fonte complementar excede o limite."); chunks.push(value); } } finally { await reader.cancel().catch(() => undefined); }
    const bytes = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    return { bytes, mime: response.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() };
  };
  const robots = await read("https://www2.camara.leg.br/robots.txt", 65_536);
  const robotText = new TextDecoder("utf-8", { fatal: true }).decode(robots.bytes);
  for (const url of [PROCUREMENT_CONTEXT_SOURCE.decree.url, PROCUREMENT_CONTEXT_SOURCE.annex.url, DECREE_METADATA_URL]) assertOfficialRobotsPathAllowed(robotText, new URL(url).pathname);
  const body = await read(PROCUREMENT_CONTEXT_SOURCE.decree.url, 131_072); const annex = await read(PROCUREMENT_CONTEXT_SOURCE.annex.url, 512_000); const metadata = await read(DECREE_METADATA_URL, 131_072);
  if (!body.mime?.includes("html") || annex.mime !== "application/pdf" || !metadata.mime?.includes("html")) throw new Error("MIME de corpo/anexo/metadado divergente; erro não é corpus.");
  return prepareDecreeComplementaryEvidence({ bodyBytes: body.bytes, body: parseDecreeBody(body.bytes), annexBytes: annex.bytes, annex: await parseDecreeAnnex(annex.bytes), metadataBytes: metadata.bytes, fetchedAt: new Date() });
}
