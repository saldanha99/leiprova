import { createHash } from "node:crypto";

import { parseConsolidatedLegalArticles } from "./legal-text";
import { assertOfficialRobotsPathAllowed } from "./planalto-text";

export const CAMARA_PROCUREMENT_SOURCE = {
  monitorUrl: "https://legis.senado.leg.br/norma/33382036",
  url: "https://www2.camara.leg.br/legin/fed/lei/2021/lei-14133-1-abril-2021-791222-normaatualizada-pl.pdf",
  parserVersion: "camara-procurement-pdf-unpdf1.8.1-v1.0.0",
} as const;

export const CAMARA_PROCUREMENT_REVIEW_LIMITATIONS = [
  "Valores monetários nominais da lei dependem dos decretos anuais: não tratá-los como limites atuais sem conferir a norma de atualização.",
  "Notas judiciais/ADI e vetos com texto substantivo precisam de confronto primário; removê-las do literal não comprova vigência/alcance jurídico.",
  "Regras de transição dos arts. 191/193 não autorizam opção licitatória encerrada em 2023 como se ainda estivesse aberta.",
  "Arts. 177–179 alteram outras normas; consultar CPC/CP/Lei de Concessões vigentes separadamente.",
] as const;

export function isAllowedCamaraProcurementUrl(url: string) { return url === CAMARA_PROCUREMENT_SOURCE.url; }

export function assertCamaraProcurementRobotsAllowed(robots: string, url: string) {
  if (!isAllowedCamaraProcurementUrl(url)) throw new Error("PDF da Câmara fora da URL exata da Lei 14.133.");
  assertOfficialRobotsPathAllowed(robots, new URL(url).pathname);
}

// Capitalized own article headings. Lowercase "art." at a PDF line start can
// simply continue a cross-reference from the preceding physical line.
const ARTICLE = /^Art\.\s*((?:\d{1,3}\.)*\d{1,4})[º°o]?(?:-([A-Z]))?\.?\s*/u;
const PROVISION = /^(?:§\s*\d+[º°o]?|Par[aá]grafo [uú]nico\.|[IVXLCDM]+(?:-[A-Z])?\s*[-–—.]|[a-z]\))/u;
const STRUCTURE = /^(?:T[IÍ]TULO|CAP[IÍ]TULO|SE[CÇ][AÃ]O|SUBSE[CÇ][AÃ]O)\b/iu;
const NOTE = /\((?:(?:[“"']?Caput[”"']?|Artigo|Par[aá]grafo(?: [uú]nico)?|Inciso|Al[ií]nea|Se[cç][aã]o|Cap[ií]tulo|Ementa)\b[^()]*?(?:reda[cç][aã]o|acrescid|revogad|inclu[ií]d|vetad)[^()]*|(?:Vide|VETADO|REVOGADO|Inclu[ií]d[oa]|Revogad[oa])\b[^()]*)\)/giu;
const EXCLUDED_AMENDMENTS = new Set([177, 178, 179]);

/** Paragraph reconstruction is fail-closed and independent of HTTP or databases. */
export function parseCamaraProcurementPageTexts(pageTexts: readonly string[], url: string) {
  if (!isAllowedCamaraProcurementUrl(url)) throw new Error("PDF da Câmara fora da URL exata da Lei 14.133.");
  if (pageTexts.length < 1 || pageTexts.length > 150) throw new Error("Quantidade de páginas da compilação fora do limite.");
  const full = pageTexts.join("\n");
  if (full.length > 2_000_000 || /\ufffd|\u0000|Gateway Time-out|Access Denied/iu.test(full) || !/C[ÂA]MARA DOS DEPUTADOS/iu.test(pageTexts[0]) || !/Centro de Documenta[cç][aã]o e Informa[cç][aã]o/iu.test(pageTexts[0]) || !/LEI\s+N[º°o]?\.?\s*14\.133,?\s+DE\s+1[º°o]?\s+DE\s+ABRIL\s+DE\s+2021/iu.test(pageTexts[0])) throw new Error("O PDF não contém a compilação oficial identificada da Lei 14.133.");
  const references = new Set<string>();
  const paragraphs: { path: string; text: string }[] = [];
  let current: number | null = null;
  let currentPath = "";
  let skipHeading = false;
  for (const raw of pageTexts.flatMap((page) => page.split("\n"))) {
    const line = raw.replace(/\s+/gu, " ").trim();
    if (!line) continue;
    if (/^Bras[ií]lia,/iu.test(line)) break;
    const match = ARTICLE.exec(line);
    if (match) {
      const number = Number(match[1].replaceAll(".", ""));
      // Articles of other codes in the three amending blocks are not own articles.
      if (current !== null && EXCLUDED_AMENDMENTS.has(current) && number !== current + 1) continue;
      const reference = `${number}${match[2] ? `-${match[2].toUpperCase()}` : ""}`;
      const extension = match[2] && ["44-A", "184-A"].includes(reference) && number === current;
      if (number > 194 || references.has(reference) || (current === null ? number !== 1 : !extension && number !== current + 1)) throw new Error(`Sequência da Lei 14.133 ambígua, duplicada, estrangeira ou incompleta: Art. ${reference} após ${current ?? "início"}.`);
      references.add(reference); current = number; currentPath = `art-${reference.toLowerCase()}`; skipHeading = false;
      if (!EXCLUDED_AMENDMENTS.has(number)) paragraphs.push({ path: currentPath, text: line });
      continue;
    }
    if (current === null || EXCLUDED_AMENDMENTS.has(current)) continue;
    if (STRUCTURE.test(line)) { skipHeading = true; continue; }
    if (skipHeading) {
      // The title may wrap across several all-capital/mixed-case PDF lines.
      if (!PROVISION.test(line)) continue;
      throw new Error("Disposição sem artigo após título da compilação; exigir nova conferência.");
    }
    if (PROVISION.test(line)) paragraphs.push({ path: currentPath, text: line });
    else {
      const previous = paragraphs.at(-1);
      if (!previous || previous.path !== currentPath) throw new Error("Continuação de parágrafo sem disposição identificada.");
      previous.text += /[a-zà-ú]-$/u.test(previous.text) && /^[a-zà-ú]/u.test(line) ? line : ` ${line}`;
    }
  }
  const expected = [...Array.from({ length: 194 }, (_, index) => String(index + 1)), "44-A", "184-A"];
  if (expected.some((reference) => !references.has(reference)) || references.size !== expected.length) throw new Error("A compilação não contém a sequência integral esperada da Lei 14.133.");
  const monetary = new Set<string>(); const veto = new Set<string>(); const judicial = new Set<string>(); const removed: { path: string; reason: string }[] = [];
  const cleaned: string[] = [];
  for (const paragraph of paragraphs) {
    const notes = paragraph.text.match(NOTE) ?? [];
    if (notes.some((note) => /Vide Decreto/iu.test(note))) monetary.add(paragraph.path);
    if (notes.some((note) => /Vide ADI/iu.test(note))) judicial.add(paragraph.path);
    if (notes.some((note) => /vetad[oa].*(?:mantid[oa]|promulgad[oa])/iu.test(note))) veto.add(paragraph.path);
    if (notes.some((note) => /\brevogad[oa]\b/iu.test(note))) {
      if (ARTICLE.test(paragraph.text) && paragraph.text.replace(NOTE, "").slice(ARTICLE.exec(paragraph.text)![0].length).replace(/[.;\s]/gu, "")) throw new Error("Artigo com texto substantivo marcado como revogado exige nova conferência, sem reatribuir seus parágrafos.");
      removed.push({ path: paragraph.path, reason: "explicit_revocation_note" }); continue;
    }
    const without = paragraph.text.replace(NOTE, "").replace(/\s+/gu, " ").trim();
    // A withdrawn marker with no substantive text is not a legal provision.
    const marker = ARTICLE.exec(without)?.[0] ?? PROVISION.exec(without)?.[0];
    if (marker && !without.slice(marker.length).replace(/[.;:–—-]/gu, "").trim()) { removed.push({ path: paragraph.path, reason: "withdrawn_or_veto_marker_without_text" }); continue; }
    if (/\b(?:revogad[oa] pela|VETADO na Lei)\b/iu.test(paragraph.text) && /^\s*\([^)]*\)\s*\.?$/u.test(paragraph.text.slice((ARTICLE.exec(paragraph.text)?.[0] ?? PROVISION.exec(paragraph.text)?.[0] ?? "").length))) { removed.push({ path: paragraph.path, reason: "explicit_withdrawn_marker" }); continue; }
    if (without) cleaned.push(without);
  }
  const articles = parseConsolidatedLegalArticles(cleaned.join("\n")).map((article, index) => ({ ...article, heading: null, articleOrder: index + 1 }));
  if (articles.length !== 191 || !articles.some((article) => article.path === "art-194") || articles.some((article) => ["art-172", "art-177", "art-178", "art-179", "art-188"].includes(article.path)) || articles.some((article) => /\((?:VETADO|REVOGADO)|reda[cç][aã]o dada|acrescid[oa] pela|Vide Decreto|Vide ADI/iu.test(article.literalText))) throw new Error("Seleção preparada diverge dos 191 artigos delimitados ou contém alterações estrangeiras, dispositivos retirados ou notas editoriais.");
  const normalizedContent = articles.map((article) => article.literalText).join("\n\n");
  const canonicalContent = articles.map((article) => [article.path, "", article.literalText].join("\n")).join("\n\n");
  return { normalizedContent, articles, checksumSha256: createHash("sha256").update([url, CAMARA_PROCUREMENT_SOURCE.parserVersion, canonicalContent].join("\n")).digest("hex"), corpusChecksumSha256: createHash("sha256").update(canonicalContent).digest("hex"), reviewLimitations: CAMARA_PROCUREMENT_REVIEW_LIMITATIONS, monetaryDependencyArticlePaths: [...monetary], vetoReconciliationArticlePaths: [...veto], judicialDependencyArticlePaths: [...judicial], excludedAmendmentArticles: [...EXCLUDED_AMENDMENTS], removedMarkers: removed, pageCount: pageTexts.length, publicationAllowed: false as const, reviewRequired: true as const };
}

export async function extractCamaraProcurementPdf(bytes: Uint8Array, url: string) {
  if (!isAllowedCamaraProcurementUrl(url)) throw new Error("PDF da Câmara fora da URL exata da Lei 14.133.");
  if (bytes.byteLength > 15 * 1024 * 1024 || bytes.byteLength < 5 || new TextDecoder("ascii").decode(bytes.slice(0, 5)) !== "%PDF-") throw new Error("Assinatura ou tamanho inválido do PDF jurídico.");
  const { getDocumentProxy, extractText } = await import("unpdf");
  const document = await getDocumentProxy(new Uint8Array(bytes));
  try {
    if (document.numPages < 1 || document.numPages > 150) throw new Error("PDF jurídico excede o limite de páginas.");
    const result = await extractText(document, { mergePages: false });
    if (!Array.isArray(result.text) || result.totalPages !== result.text.length) throw new Error("Extração não preservou as páginas oficiais.");
    return { ...parseCamaraProcurementPageTexts(result.text, url), rawPdfChecksumSha256: createHash("sha256").update(bytes).digest("hex") };
  } finally { await document.cleanup(); }
}
