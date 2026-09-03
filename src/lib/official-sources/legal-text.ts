import * as cheerio from "cheerio";

import { normalizeOfficialText } from "./text-normalization";

export const LEGAL_TEXT_PARSER_VERSION = "senado-consolidated-v1.0.0";

const ARTICLE_LINE = /^(Art\.\s*((?:\d{1,3}\.)*\d{1,4})[º°o]?(?:-([A-Z](?:-[A-Z])?))?\.?)\s*(.*)$/iu;
const STRUCTURE_LINE = /^(?:PARTE|LIVRO|T[IÍ]TULO|CAP[IÍ]TULO|SE[CÇ][AÃ]O|SUBSE[CÇ][AÃ]O)(?:\s+[ÚU]NICO|\s+[IVXLCDM]+|\s+\d+[º°o]?)?$/iu;
const END_MARKER = /^(?:Bras[ií]lia,|Este texto n[aã]o substitui|Senado Federal - Pra[cç]a dos Tr[eê]s Poderes)/iu;
const UPDATE_NOTE = /(?:reda[cç][aã]o dada|nova reda[cç][aã]o|acrescid[oa]|inclu[ií]d[oa]|revogad[oa]|vide |promulga[cç][aã]o de partes vetadas|nome jur[ií]dico|primitivo art\.)/iu;

export type ParsedLegalArticle = {
  articleRef: string;
  articleOrder: number;
  heading: string | null;
  path: string;
  literalText: string;
};

function normalizeArticleRef(raw: string) {
  return raw.toUpperCase();
}

function canonicalArticleRef(raw: string) {
  return normalizeArticleRef(raw)
    .replace(/[.º°]/gu, "")
    .replace(/(?<=\d)O(?=-|$)/gu, "");
}

function articlePath(reference: string) {
  return `art-${canonicalArticleRef(reference).toLowerCase()}`;
}

function isHeadingTitle(line: string) {
  if (line.length < 3 || line.length > 180 || /^Art\./iu.test(line)) return false;
  const letters = line.match(/[A-Za-zÀ-ÖØ-öø-ÿ]/gu) ?? [];
  if (letters.length < 3) return false;
  return letters.every((letter) => letter === letter.toUpperCase());
}

function cleanArticleText(lines: readonly string[]) {
  return normalizeOfficialText(
    lines
      .map((line) => {
        let cleaned = line.trim();
        while (/\([^)]*\)\.?\s*$/u.test(cleaned)) {
          const trailing = /\(([^)]*)\)\.?\s*$/u.exec(cleaned);
          if (!trailing || !UPDATE_NOTE.test(trailing[1])) break;
          cleaned = cleaned.slice(0, trailing.index).trimEnd();
        }
        return cleaned;
      })
      .filter(Boolean)
      .filter((line) => !/^\((?:Dispositivo|Artigo|Caput|Par[aá]grafo|Inciso|Al[ií]nea).*(?:reda[cç][aã]o|acrescid|inclu[ií]d|revogad)/iu.test(line))
      .join("\n"),
  );
}

export function discoverConsolidatedLegalTextUrl(html: string, monitorUrl: string) {
  const monitor = new URL(monitorUrl);
  const match = /^\/norma\/(\d+)$/u.exec(monitor.pathname);
  if (monitor.protocol !== "https:" || monitor.hostname !== "legis.senado.leg.br" || !match) {
    throw new Error("Endereço de monitoramento jurídico inválido.");
  }

  const $ = cheerio.load(html);
  const row = $("tr")
    .toArray()
    .find((element) => {
      const text = normalizeOfficialText($(element).text());
      return /Compila[cç][aã]o Monovigente/iu.test(text) && !/Traduzida/iu.test(text);
    });
  const href = row ? $(row).find('a[href*="publicacao"]').first().attr("href") : undefined;
  if (!href) {
    throw new Error("A fonte oficial ainda não oferece compilação monovigente em texto.");
  }

  const resolved = new URL(href, monitorUrl);
  const expectedPath = new RegExp(`^/norma/${match[1]}/publicacao/\\d+$`, "u");
  if (
    resolved.protocol !== "https:" ||
    resolved.hostname !== "legis.senado.leg.br" ||
    !expectedPath.test(resolved.pathname) ||
    resolved.search ||
    resolved.hash
  ) {
    throw new Error("A compilação indicada saiu do domínio oficial permitido.");
  }
  return resolved.toString();
}

export function extractConsolidatedLegalText(html: string) {
  const $ = cheerio.load(html);
  $("script, style, noscript, svg, iframe, strike, s, del").remove();
  $("[style]").each((_, element) => {
    if (/line-through/iu.test($(element).attr("style") ?? "")) $(element).remove();
  });
  $("a").each((_, element) => {
    const text = normalizeOfficialText($(element).text());
    if (text.startsWith("(") && text.endsWith(")") && UPDATE_NOTE.test(text)) {
      $(element).remove();
    }
  });
  $(
    "address, article, aside, blockquote, br, div, footer, h1, h2, h3, h4, h5, h6, header, li, main, nav, p, section, table, tr",
  ).each((_, element) => {
    $(element).append("\n");
  });
  return normalizeOfficialText($("body").text());
}

export function parseConsolidatedLegalArticles(normalizedContent: string) {
  const articles: ParsedLegalArticle[] = [];
  const references = new Set<string>();
  let current: { reference: string; heading: string | null; lines: string[] } | null = null;
  let structureLabel: string | null = null;
  let heading: string | null = null;

  const flush = () => {
    if (!current) return;
    const literalText = cleanArticleText(current.lines);
    const substantiveText = literalText.slice(current.reference.length).trim();
    if (!substantiveText.replace(/[.\s]/gu, "") || /^\(?Revogad[oa]/iu.test(substantiveText)) {
      current = null;
      return;
    }
    if (literalText.length < current.reference.length + 3) {
      throw new Error(`O ${current.reference} não contém texto legal suficiente.`);
    }
    const displayReference = normalizeArticleRef(
      current.reference.replace(/^Art\.\s*/iu, "").replace(/\.$/u, ""),
    );
    const canonicalReference = canonicalArticleRef(displayReference);
    if (references.has(canonicalReference) && canonicalReference === "1" && articles.length <= 10) {
      articles.length = 0;
      references.clear();
    } else if (references.has(canonicalReference)) {
      throw new Error(`A compilação contém referência duplicada: Art. ${displayReference}.`);
    }
    references.add(canonicalReference);
    articles.push({
      articleRef: `Art. ${displayReference}`,
      articleOrder: articles.length + 1,
      heading: current.heading,
      path: articlePath(displayReference),
      literalText,
    });
    current = null;
  };

  for (const rawLine of normalizedContent.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;
    if (END_MARKER.test(line) && current) {
      flush();
      break;
    }

    const article = ARTICLE_LINE.exec(line);
    if (article) {
      flush();
      const normalizedReference = normalizeOfficialText(article[1]);
      current = {
        reference: normalizedReference,
        heading,
        lines: [`${normalizedReference}${article[4] ? ` ${article[4].trim()}` : ""}`],
      };
      structureLabel = null;
      continue;
    }

    if (STRUCTURE_LINE.test(line)) {
      if (current) flush();
      structureLabel = line;
      continue;
    }
    if (structureLabel && isHeadingTitle(line)) {
      heading = `${structureLabel} · ${line}`;
      structureLabel = null;
      continue;
    }
    if (current) current.lines.push(line);
  }
  flush();

  if (!articles.length) throw new Error("Nenhum artigo foi reconhecido na compilação oficial.");
  return articles;
}
