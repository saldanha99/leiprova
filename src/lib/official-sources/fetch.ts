import { createHash } from "node:crypto";

import * as cheerio from "cheerio";

import { parseOfficialExamUrl } from "./exam-registry";
import { isAllowedOfficialLegalUrl } from "./legal-registry";

const USER_AGENT = "LeiProva-OfficialSourceMonitor/1.0 (+https://leiprova.2b.app.br/fontes-e-atualizacao)";
const MAX_METADATA_BYTES = 131_072;

function decodeBody(bytes: Uint8Array, contentType: string | null) {
  const charset = /charset\s*=\s*["']?([^;\s"']+)/i.exec(contentType ?? "")?.[1]?.toLowerCase();
  const encoding = charset === "iso-8859-1" || charset === "windows-1252" ? "windows-1252" : "utf-8";
  return new TextDecoder(encoding).decode(bytes);
}

export function normalizeOfficialText(input: string) {
  return input
    .replace(/\u00a0/g, " ")
    .replace(/[\t\f\v ]+/g, " ")
    .replace(/ *\r?\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function extractOfficialDocumentText(html: string) {
  const $ = cheerio.load(html);
  $("script, style, noscript, svg, iframe").remove();
  $("address, article, aside, blockquote, br, div, footer, h1, h2, h3, h4, h5, h6, header, li, main, nav, p, section, table, tr").each(
    (_, element) => {
      $(element).append("\n");
    },
  );
  return normalizeOfficialText($("body").text());
}

async function fetchWithTrustedRedirects(
  initialUrl: string,
  validate: (url: string) => void,
  maxRedirects = 3,
) {
  let currentUrl = initialUrl;

  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount += 1) {
    validate(currentUrl);
    const response = await fetch(currentUrl, {
      redirect: "manual",
      headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/xhtml+xml" },
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });

    if (![301, 302, 303, 307, 308].includes(response.status)) return response;
    const location = response.headers.get("location");
    if (!location) throw new Error("A fonte oficial respondeu com redirecionamento inválido.");
    currentUrl = new URL(location, currentUrl).toString();
  }

  throw new Error("A fonte oficial excedeu o limite de redirecionamentos.");
}

function validateLegalUrl(url: string) {
  if (!isAllowedOfficialLegalUrl(url)) throw new Error("URL jurídica fora do registro oficial permitido.");
}

export async function fetchOfficialLegalDocument(url: string) {
  const response = await fetchWithTrustedRedirects(url, validateLegalUrl, 0);
  if (!response.ok) throw new Error(`A fonte oficial respondeu com HTTP ${response.status}.`);

  const bytes = new Uint8Array(await response.arrayBuffer());
  const html = decodeBody(bytes, response.headers.get("content-type"));
  const normalizedContent = extractOfficialDocumentText(html);
  const articleMarkerCount = normalizedContent.match(/\bArt\.\s*\d+[ºo]?\b/gi)?.length ?? 0;

  if (normalizedContent.length < 1_000 || articleMarkerCount < 1) {
    throw new Error("A página oficial não contém texto legal suficiente para criar a fotografia de conferência.");
  }

  return {
    sourceUrl: url,
    checksumSha256: createHash("sha256").update(normalizedContent).digest("hex"),
    normalizedContent,
    contentLength: normalizedContent.length,
    articleMarkerCount,
    httpStatus: response.status,
    fetchedAt: new Date(),
  };
}

async function readLimitedBody(response: Response, limit = MAX_METADATA_BYTES) {
  if (!response.body) return new Uint8Array();
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  while (total < limit) {
    const { done, value } = await reader.read();
    if (done) break;
    const remaining = limit - total;
    const chunk = value.length > remaining ? value.slice(0, remaining) : value;
    chunks.push(chunk);
    total += chunk.length;
  }
  await reader.cancel().catch(() => undefined);

  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

export async function verifyOfficialExamUrl(bankSlug: string, input: string) {
  const initialUrl = parseOfficialExamUrl(bankSlug, input).toString();
  const validate = (candidate: string) => void parseOfficialExamUrl(bankSlug, candidate);
  const response = await fetchWithTrustedRedirects(initialUrl, validate);
  const finalUrl = response.url || initialUrl;
  validate(finalUrl);

  const bytes = await readLimitedBody(response);
  const contentType = response.headers.get("content-type");
  const isHtml = contentType?.toLowerCase().includes("html") ?? false;
  const pageTitle = isHtml
    ? normalizeOfficialText(cheerio.load(decodeBody(bytes, contentType))("title").first().text()).slice(0, 300) || null
    : null;

  return {
    httpStatus: response.status,
    pageTitle,
    finalUrl,
    checkedAt: new Date(),
  };
}
