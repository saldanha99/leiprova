import { createHash } from "node:crypto";

import * as cheerio from "cheerio";

import { parseConsolidatedLegalArticles } from "./legal-text";
import { assertOfficialRobotsPathAllowed } from "./planalto-text";
import { normalizeOfficialText } from "./text-normalization";

export const CAMARA_LGPD_SOURCE = {
  monitorUrl: "https://legis.senado.leg.br/norma/27457334",
  url: "https://www2.camara.leg.br/legin/fed/lei/2018/lei-13709-14-agosto-2018-787077-normaatualizada-pl.html",
  parserVersion: "camara-lgpd-consolidated-v1.0.0",
} as const;

export function isAllowedCamaraConsolidatedUrl(url: string) {
  return url === CAMARA_LGPD_SOURCE.url;
}

export function assertCamaraRobotsAllowed(robots: string, url: string) {
  if (!isAllowedCamaraConsolidatedUrl(url)) throw new Error("Compilação da Câmara fora da URL exata permitida.");
  assertOfficialRobotsPathAllowed(robots, new URL(url).pathname);
}

const ARTICLE = /^Art\.\s*(\d{1,3})[º°o]?(?:-([A-Z]))?\.?\s*/iu;
const ANNOTATION = /\((?:(?:[“"']?Caput[”"']?|Artigo|Par[aá]grafo|Inciso|Al[ií]nea|Se[cç][aã]o|Cap[ií]tulo|Ementa)\b[^()]*?(?:reda[cç][aã]o|acrescid|revogad|inclu[ií]d)[^()]*|(?:VETADO|REVOGADO|Vide|Inclu[ií]d[oa]|Revogad[oa])\b[^()]*)\)/giu;
const ONLY_WITHDRAWN = /^(?:(?:Art\.\s*\d+[º°o]?(?:-[A-Z])?\.?)|(?:§\s*\d+[º°o]?)|(?:[IVXLCDM]+\s*[-–—.]?)|(?:[a-z]\)))\s*\([^()]*\b(?:VETAD[OA]|REVOGAD[OA])\b[^()]*\)\.?$/iu;

/** Only this current LGPD page. No imported full-text fixture or automatic approval. */
export function parseCamaraLgpdConsolidatedHtml(html: string, url: string) {
  if (!isAllowedCamaraConsolidatedUrl(url)) throw new Error("Compilação da Câmara fora da URL exata permitida.");
  if (html.includes("\ufffd")) throw new Error("A compilação da Câmara contém erro de decodificação.");
  const $ = cheerio.load(html);
  $("script, noscript, svg, iframe, img").remove();
  const identity = $("body").text().replace(/\s+/gu, " ").trim();
  if (!/C[ÂA]MARA DOS DEPUTADOS/iu.test(identity) || !/Centro de Documenta[cç][aã]o e Informa[cç][aã]o/iu.test(identity) || !/LEI\s+N[º°o]?\.?\s*13\.709,?\s+DE\s+14\s+DE\s+AGOSTO\s+DE\s+2018/iu.test(identity) || /Gateway Time-out|Access Denied|Forbidden/iu.test(identity)) {
    throw new Error("A resposta não é o texto atualizado oficial da LGPD da Câmara.");
  }
  $("style").each((_, element) => {
    for (const rule of $(element).text().matchAll(/([^{}]+)\{([^{}]*)\}/gu)) {
      if (!/text-decoration(?:-line)?\s*:[^;]*line-through/iu.test(rule[2])) continue;
      try { $(rule[1].trim()).remove(); } catch { throw new Error("Marcação revogada da Câmara não interpretável."); }
    }
  });
  $("style, strike, s, del").remove();
  $("[style]").each((_, element) => {
    if (/text-decoration(?:-line)?\s*:[^;]*line-through/iu.test($(element).attr("style") ?? "")) $(element).remove();
  });
  // LibreOffice wraps words across raw HTML lines, even "Art." and its number.
  // Normalize within each paragraph first, not across the entire document.
  const paragraphs = $("body p").toArray().map((element) => $(element).text().replace(/\s+/gu, " ").trim()).filter(Boolean);
  const references = new Set<string>();
  for (const paragraph of paragraphs) {
    const match = ARTICLE.exec(paragraph);
    if (!match) continue;
    const reference = `${Number(match[1])}${match[2] ? `-${match[2].toUpperCase()}` : ""}`;
    if (Number(match[1]) > 65 || references.has(reference)) throw new Error("A compilação da LGPD tem artigo estrangeiro ou redação ativa duplicada.");
    references.add(reference);
  }
  const expectedReferences = [...Array.from({ length: 65 }, (_, index) => String(index + 1)), "14-A", ..."ABCDEFGHIJKLM".split("").map((suffix) => `55-${suffix}`), "58-A", "58-B"];
  if (expectedReferences.some((reference) => !references.has(reference))) {
    throw new Error("A resposta da Câmara não contém a sequência integral da LGPD, incluindo os dispositivos retirados.");
  }
  const lines: string[] = [];
  let currentArticle: number | null = null;
  for (const paragraph of paragraphs) {
    if (/^Bras[ií]lia,/iu.test(paragraph)) break;
    const match = ARTICLE.exec(paragraph);
    if (match) currentArticle = Number(match[1]);
    if (currentArticle === null || currentArticle === 60) continue;
    if (/^(?:CAP[IÍ]TULO|SE[CÇ][AÃ]O|T[IÍ]TULO|SUBSE[CÇ][AÃ]O)\b/iu.test(paragraph) || (!match && paragraph === paragraph.toUpperCase() && /[A-ZÀ-ÖØ-Þ]{3}/u.test(paragraph) && !/^(?:[IVXLCDM]+\s*[-–—]|§)/u.test(paragraph))) continue;
    if (ONLY_WITHDRAWN.test(paragraph) || /^\([^()]*\b(?:VETAD[OA]|REVOGAD[OA])\b[^()]*\)\.?$/iu.test(paragraph)) continue;
    const text = paragraph.replace(ANNOTATION, "").replace(/\s+/gu, " ").trim();
    if (text) lines.push(text);
  }
  const articles = parseConsolidatedLegalArticles(normalizeOfficialText(lines.join("\n")))
    .map((article, index) => ({ ...article, heading: null, articleOrder: index + 1 }));
  if (!articles.some((article) => article.path === "art-1") || !articles.some((article) => article.path === "art-65") || articles.some((article) => article.path === "art-60")) {
    throw new Error("O corpus preparado da LGPD diverge da seleção esperada.");
  }
  const normalizedContent = articles.map((article) => article.literalText).join("\n\n");
  const canonicalContent = articles.map((article) => [article.path, "", article.literalText].join("\n")).join("\n\n");
  return { normalizedContent, articles, checksumSha256: createHash("sha256").update([CAMARA_LGPD_SOURCE.url, CAMARA_LGPD_SOURCE.parserVersion, canonicalContent].join("\n")).digest("hex"), corpusChecksumSha256: createHash("sha256").update(canonicalContent).digest("hex"), rawHtmlChecksumSha256: createHash("sha256").update(html).digest("hex"), excludedAmendmentArticles: [60], humanReviewRequired: true as const, publicationAllowed: false as const };
}
