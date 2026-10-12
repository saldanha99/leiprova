import { createHash } from "node:crypto";

import * as cheerio from "cheerio";

import { extractConsolidatedLegalText, parseConsolidatedLegalArticles } from "./legal-text";
import { normalizeOfficialText } from "./text-normalization";

/** Exact pages, not a general Planalto scraper. Amendment laws are not a current code. */
export const PLANALTO_CONSOLIDATED_SOURCES = [
  {
    slug: "lei-geral-protecao-dados-2018",
    monitorUrl: "https://legis.senado.leg.br/norma/27457334",
    url: "https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709compilado.htm",
    number: "13.709",
    maximumArticle: 65,
    // Changes to the Marco Civil must be read in its own current compilation.
    amendmentArticles: [60],
  },
  {
    slug: "lei-licitacoes-contratos-2021",
    monitorUrl: "https://legis.senado.leg.br/norma/33382036",
    url: "https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2021/lei/l14133.htm",
    number: "14.133",
    maximumArticle: 194,
    // These reproduce amendments to CPC, CP and the Concessions Law.
    amendmentArticles: [177, 178, 179],
  },
] as const;

export const PLANALTO_TEXT_PARSER_VERSION = "planalto-consolidated-v1.0.0";

export function getPlanaltoConsolidatedSource(monitorUrl: string) {
  return PLANALTO_CONSOLIDATED_SOURCES.find((source) => source.monitorUrl === monitorUrl) ?? null;
}

export function isAllowedPlanaltoConsolidatedUrl(url: string) {
  return PLANALTO_CONSOLIDATED_SOURCES.some((source) => source.url === url);
}

/** No HTML replacement characters are silently promoted into legal text. */
export function decodePlanaltoHtml(bytes: Uint8Array, contentType: string | null) {
  const prefix = new TextDecoder("windows-1252").decode(bytes.slice(0, 4096));
  const charset = /charset\s*=\s*["']?([^;\s"'>]+)/iu.exec(contentType ?? "")?.[1]
    ?? /charset\s*=\s*["']?([^;\s"'>]+)/iu.exec(prefix)?.[1];
  if (charset && !/^(?:utf-?8|windows-1252|iso-8859-1)$/iu.test(charset)) {
    throw new Error("A codificação declarada da página oficial não é suportada.");
  }
  const encoding = charset && /^utf-?8$/iu.test(charset) ? "utf-8" : "windows-1252";
  return new TextDecoder(encoding, { fatal: true }).decode(bytes);
}

/** Removes historical presentation before splitting articles, including CSS classes. */
export function parsePlanaltoConsolidatedHtml(html: string, sourceUrl: string) {
  const source = PLANALTO_CONSOLIDATED_SOURCES.find((candidate) => candidate.url === sourceUrl);
  if (!source) throw new Error("Página do Planalto fora da lista de compilações permitidas.");
  if (html.includes("\ufffd")) throw new Error("A página oficial contém caracteres de decodificação inválidos.");
  const $ = cheerio.load(html);
  if (!new RegExp(`LEI\\s+(?:N[º°o]?\\.?\\s*)?${source.number.replace(".", "\\.")}`, "iu").test($("body").text())) {
    throw new Error("A identidade da lei diverge da compilação esperada.");
  }
  // Word-generated Planalto pages also put revoked formatting in stylesheets.
  $("style").each((_, style) => {
    for (const match of $(style).text().matchAll(/([^{}]+)\{([^{}]*)\}/gu)) {
      if (!/text-decoration(?:-line)?\s*:[^;]*line-through/iu.test(match[2])) continue;
      try { $(match[1].trim()).remove(); } catch {
        throw new Error("A marcação de texto revogado não pôde ser interpretada.");
      }
    }
  });
  $("a").each((_, link) => {
    const text = normalizeOfficialText($(link).text());
    if (/^\(?\s*(?:Vig[eê]ncia|Produ[cç][aã]o de efeitos|Vide|Reda[cç][aã]o dada|Inclu[ií]d[oa]|Revogad[oa]|Vigora[r]?)[\s\S]*\)?$/iu.test(text)) {
      $(link).remove();
    }
  });
  // Blockquote can also indent a valid paragraph: discard it only under one of
  // the explicitly identified amending articles, never by presentation alone.
  let enclosingArticle: number | null = null;
  $("p, blockquote").each((_, element) => {
    if (element.tagName === "blockquote") {
      if (source.amendmentArticles.some((number) => number === enclosingArticle)) $(element).remove();
    } else if (!$(element).parents("blockquote").length) {
      const reference = /^Art\.\s*(\d+)/iu.exec(normalizeOfficialText($(element).text()));
      if (reference) enclosingArticle = Number(reference[1]);
    }
  });
  const extracted = extractConsolidatedLegalText($.html());
  const references = new Set<string>();
  for (const match of extracted.matchAll(/^Art\.\s*((?:\d{1,3}\.)*\d{1,4})[º°o]?(?:-([A-Z](?:-[A-Z])?))?/gimu)) {
    const number = Number(match[1].replaceAll(".", ""));
    const reference = `${number}${match[2] ? `-${match[2].toUpperCase()}` : ""}`;
    if (number > source.maximumArticle || references.has(reference)) {
      throw new Error("A compilação tem artigo estrangeiro ou redações ativas duplicadas.");
    }
    references.add(reference);
  }
  const articles = parseConsolidatedLegalArticles(extracted)
    .filter((article) => !source.amendmentArticles.some((number) => article.path === `art-${number}`))
    .filter((article) => !/^Art\.\s*\S+\s*\(?\s*(?:VETADO|REVOGADO)/iu.test(article.literalText))
    .map((article, index) => ({ ...article, heading: null, articleOrder: index + 1 }));
  if (!articles.length || articles[0].path !== "art-1" || !articles.some((article) => article.path === `art-${source.maximumArticle}`)) {
    throw new Error("A compilação oficial está incompleta ou não tem os limites esperados.");
  }
  // Serialization preserves exactly the corpus that a later human will review.
  const normalizedContent = articles.map((article) => article.literalText).join("\n\n");
  return {
    normalizedContent,
    articles,
    checksumSha256: createHash("sha256").update(articles.map((article) => [article.path, article.heading ?? "", article.literalText].join("\n")).join("\n\n")).digest("hex"),
    rawHtmlChecksumSha256: createHash("sha256").update(html).digest("hex"),
    excludedAmendmentArticles: [...source.amendmentArticles],
  };
}

/** Conservative robots evaluation: a fetch failure is never permission. */
export function assertPlanaltoRobotsAllowed(robots: string, sourceUrl: string) {
  if (!isAllowedPlanaltoConsolidatedUrl(sourceUrl)) throw new Error("Compilação do Planalto não permitida.");
  return assertOfficialRobotsPathAllowed(robots, new URL(sourceUrl).pathname);
}

/** Shared policy evaluation; each provider must validate its own exact URL first. */
export function assertOfficialRobotsPathAllowed(robots: string, pathname: string) {
  const rules: { agents: string[]; directives: { allow: boolean; path: string }[] }[] = [];
  let group = { agents: [] as string[], directives: [] as { allow: boolean; path: string }[] };
  for (const raw of robots.split(/\r?\n/u)) {
    const line = raw.replace(/#.*$/u, "").trim();
    if (!line) continue;
    const separator = line.indexOf(":");
    if (separator < 0) throw new Error("O robots.txt da fonte oficial não pôde ser interpretado.");
    const key = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();
    if (key === "user-agent") {
      if (group.directives.length) { rules.push(group); group = { agents: [], directives: [] }; }
      group.agents.push(value.toLowerCase());
    } else if (key === "allow" || key === "disallow") {
      if (!group.agents.length) throw new Error("O robots.txt da fonte oficial não tem grupo de agente válido.");
      if (value) group.directives.push({ allow: key === "allow", path: value });
    }
  }
  rules.push(group);
  const agent = "editaleiseca-officialsourcemonitor";
  const specific = rules.filter((entry) => entry.agents.some((name) => name !== "*" && agent.includes(name)));
  const applicable = specific.length ? specific : rules.filter((entry) => entry.agents.includes("*"));
  let selected: { allow: boolean; weight: number } | null = null;
  for (const rule of applicable.flatMap((entry) => entry.directives)) {
    const escaped = rule.path.replace(/[.+?^{}()|[\]\\]/gu, "\\$&").replaceAll("*", ".*");
    if (!new RegExp(`^${escaped}`, "u").test(pathname)) continue;
    const weight = rule.path.replaceAll("*", "").replace(/\$$/u, "").length;
    if (!selected || weight > selected.weight || (weight === selected.weight && rule.allow)) selected = { allow: rule.allow, weight };
  }
  if (selected && !selected.allow) throw new Error("O robots.txt da fonte oficial proíbe esta compilação.");
}
