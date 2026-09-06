import { load } from "cheerio";

import { discoveryPathBlocked } from "@/lib/editorial/discovery-policy";
import { OfficialDocumentFetchError } from "@/lib/opportunities/official-document-fetch-error";

import {
  parseOfficialOpportunityDocumentUrl,
  type OfficialOpportunitySourceId,
} from "@/lib/opportunities/source-monitor-policy";

export const MAX_OFFICIAL_DOCUMENT_BYTES = 15 * 1024 * 1024;
export const MAX_OFFICIAL_DOCUMENT_PAGES = 250;
export const MAX_OFFICIAL_DOCUMENT_TEXT_LENGTH = 2_000_000;
export const OFFICIAL_DOCUMENT_PARSER_VERSION = "unpdf-1.8.1";

const PROHIBITED_EXAM_MATERIAL =
  /(?:^|[\s_./-])(provas?|gabaritos?|cadernos?(?:\s+de)?\s*(?:prova|quest)|quest(?:ao|oes|ão|ões)|cart(?:ao|ão)\s*(?:resposta|de respostas)|respostas?)(?:$|[\s_./-])/i;
const DESIRED_DOCUMENT =
  /(?:^|[\s_./-])(edital|conteudo\s+programatico|conteúdo\s+programático|programa\s+de\s+conteudos?|programa\s+de\s+conteúdos?|anexo)(?:$|[\s_./-])/i;

export type OfficialDocumentCandidate = Readonly<{
  url: string;
  hostname: string;
  label: string;
  score: number;
}>;

function normalizeLabel(value: string) {
  return value.replace(/\s+/g, " ").trim().slice(0, 300);
}

export function isProhibitedExamMaterial(value: string) {
  const decoded = (() => {
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  })();
  return PROHIBITED_EXAM_MATERIAL.test(decoded.replace(/[?&#=]+/g, " "));
}

function rankDocument(label: string, url: string) {
  const haystack = `${label} ${url}`;
  let score = 0;
  if (/conte[uú]do\s+program[aá]tico/i.test(haystack)) score += 100;
  if (/edital/i.test(haystack)) score += 70;
  if (/anexo/i.test(haystack)) score += 35;
  if (/retifica[cç][aã]o/i.test(haystack)) score += 15;
  if (/\.pdf(?:$|[?#])/i.test(url)) score += 20;
  return score;
}

/** Aplica a política verificada também fora do runner, inclusive nos redirects. */
export function assertOfficialDocumentAccess(url: string, sourceId: OfficialOpportunitySourceId) {
  if (discoveryPathBlocked(url)) {
    throw new OfficialDocumentFetchError("robots_path_disallowed", "policy", sourceId);
  }
}

export function buildDirectOfficialDocumentCandidate(
  url: string,
  sourceId: OfficialOpportunitySourceId,
  label: string,
) {
  let official;
  try {
    official = parseOfficialOpportunityDocumentUrl(url, sourceId);
  } catch {
    throw new OfficialDocumentFetchError("invalid_document_url", "policy", sourceId);
  }
  assertOfficialDocumentAccess(official.url, sourceId);
  const normalizedLabel = normalizeLabel(label || "Documento oficial");
  if (isProhibitedExamMaterial(`${normalizedLabel} ${official.url}`)) {
    throw new OfficialDocumentFetchError("prohibited_exam_material", "policy", sourceId);
  }
  if (!DESIRED_DOCUMENT.test(`${normalizedLabel} ${official.url}`)) {
    throw new OfficialDocumentFetchError("document_not_eligible", "policy", sourceId);
  }
  return Object.freeze({
    url: official.url,
    hostname: official.hostname,
    label: normalizedLabel,
    score: rankDocument(normalizedLabel, official.url),
  });
}

export function discoverOfficialDocumentCandidatesFromHtml(
  html: string,
  pageUrl: string,
  sourceId: OfficialOpportunitySourceId,
) {
  let page;
  try {
    page = parseOfficialOpportunityDocumentUrl(pageUrl, sourceId);
  } catch {
    throw new OfficialDocumentFetchError("invalid_document_url", "policy", sourceId);
  }
  assertOfficialDocumentAccess(page.url, sourceId);
  const $ = load(html);
  const candidates = new Map<string, OfficialDocumentCandidate>();

  $("a[href]").each((_, element) => {
    const href = $(element).attr("href");
    if (!href || !href.trim() || href.trim().startsWith("#")) return;

    let absolute: string;
    try {
      absolute = new URL(href, pageUrl).toString();
    } catch {
      return;
    }

    const label = normalizeLabel(
      `${$(element).text()} ${$(element).attr("title") ?? ""} ${$(element).attr("aria-label") ?? ""}`,
    );
    const combined = `${label} ${absolute}`;
    if (isProhibitedExamMaterial(combined) || !DESIRED_DOCUMENT.test(combined)) return;

    let official;
    try {
      official = parseOfficialOpportunityDocumentUrl(absolute, sourceId);
      assertOfficialDocumentAccess(official.url, sourceId);
    } catch {
      return;
    }

    // Menus/âncoras da notícia não são um arquivo: o fragmento já foi removido.
    if (official.url === page.url) return;

    const candidate: OfficialDocumentCandidate = Object.freeze({
      url: official.url,
      hostname: official.hostname,
      label: label || "Documento oficial",
      score: rankDocument(label, official.url),
    });
    const current = candidates.get(candidate.url);
    if (!current || candidate.score > current.score) candidates.set(candidate.url, candidate);
  });

  return Object.freeze(
    [...candidates.values()]
      .sort((left, right) => right.score - left.score || left.label.localeCompare(right.label, "pt-BR"))
      .slice(0, 15),
  );
}
