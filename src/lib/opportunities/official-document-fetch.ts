import { createHash } from "node:crypto";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

import { extractText, getDocumentProxy } from "unpdf";

import {
  assertOfficialDocumentAccess,
  buildDirectOfficialDocumentCandidate,
  discoverOfficialDocumentCandidatesFromHtml,
  isProhibitedExamMaterial,
  MAX_OFFICIAL_DOCUMENT_BYTES,
  MAX_OFFICIAL_DOCUMENT_PAGES,
  MAX_OFFICIAL_DOCUMENT_TEXT_LENGTH,
  OFFICIAL_DOCUMENT_PARSER_VERSION,
  type OfficialDocumentCandidate,
} from "@/lib/opportunities/official-document-policy";
import {
  parseOfficialOpportunityDocumentUrl,
  parseOfficialOpportunitySourceUrl,
  resolveOfficialOpportunityDocumentRedirect,
  type OfficialOpportunitySourceId,
} from "@/lib/opportunities/source-monitor-policy";

import {
  OfficialDocumentFetchError,
  normalizeOfficialDocumentFetchError,
} from "@/lib/opportunities/official-document-fetch-error";

const MAX_DISCOVERY_BYTES = 2 * 1024 * 1024;
const MAX_REDIRECTS = 4;
const REQUEST_TIMEOUT_MS = 15_000;

type FetchLike = typeof fetch;

function isPrivateAddress(address: string) {
  if (isIP(address) === 4) {
    const [a, b] = address.split(".").map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a >= 224
    );
  }
  const normalized = address.toLowerCase();
  return (
    normalized === "::" ||
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe8") ||
    normalized.startsWith("fe9") ||
    normalized.startsWith("fea") ||
    normalized.startsWith("feb") ||
    normalized.startsWith("::ffff:127.") ||
    normalized.startsWith("::ffff:10.") ||
    normalized.startsWith("::ffff:192.168.")
  );
}

async function assertPublicOfficialHost(hostname: string, sourceId: OfficialOpportunitySourceId) {
  try {
    const addresses = await lookup(hostname, { all: true, verbatim: true });
    if (!addresses.length || addresses.some(({ address }) => isPrivateAddress(address))) {
      throw new OfficialDocumentFetchError("unsafe_source_address", "dns", sourceId);
    }
  } catch (error) {
    throw normalizeOfficialDocumentFetchError(error, "official_dns_failed", "dns", sourceId);
  }
}

// Não deixa uma falha secundária de cancelamento ocultar o erro que impediu a captura.
async function discardBody(response: Response) {
  try { await response.body?.cancel(); } catch { /* O erro primário é preservado. */ }
}

async function readLimitedBody(
  response: Response,
  limit: number,
  sourceId: OfficialOpportunitySourceId,
) {
  const sizeCode = limit === MAX_DISCOVERY_BYTES ? "discovery_size_limit" : "document_size_limit";
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > limit) {
    await discardBody(response);
    throw new OfficialDocumentFetchError(sizeCode, "body", sourceId);
  }
  if (!response.body) throw new OfficialDocumentFetchError("empty_source_body", "body", sourceId);

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > limit) {
        throw new OfficialDocumentFetchError(sizeCode, "body", sourceId);
      }
      chunks.push(value);
    }
  } catch (error) {
    try { await reader.cancel(); } catch { /* Preserva limite/erro de leitura. */ }
    throw normalizeOfficialDocumentFetchError(error, "official_body_read_failed", "body", sourceId);
  } finally {
    reader.releaseLock();
  }
  if (!total) throw new OfficialDocumentFetchError("empty_source_body", "body", sourceId);

  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

async function fetchOfficialResource(
  initialUrl: string,
  sourceId: OfficialOpportunitySourceId,
  fetchImpl: FetchLike = fetch,
) {
  let current;
  try {
    current = parseOfficialOpportunityDocumentUrl(initialUrl, sourceId);
  } catch {
    throw new OfficialDocumentFetchError("invalid_document_url", "policy", sourceId);
  }
  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    assertOfficialDocumentAccess(current.url, sourceId);
    await assertPublicOfficialHost(current.hostname, sourceId);
    let response: Response;
    try {
      response = await fetchImpl(current.url, {
        method: "GET",
        redirect: "manual",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        headers: {
          Accept: "application/pdf,text/html;q=0.9,*/*;q=0.5",
          "User-Agent": "LeiProva-Official-Notice-Importer/1.0 (+https://leiprova.2b.app.br/fontes-e-atualizacao)",
        },
      });
    } catch (error) {
      throw normalizeOfficialDocumentFetchError(error, "official_request_failed", "request", sourceId);
    }
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      await discardBody(response);
      if (!location) throw new OfficialDocumentFetchError("redirect_missing_location", "redirect", sourceId);
      try {
        current = resolveOfficialOpportunityDocumentRedirect(current.url, location, sourceId);
      } catch {
        throw new OfficialDocumentFetchError("redirect_disallowed", "redirect", sourceId);
      }
      assertOfficialDocumentAccess(current.url, sourceId);
      continue;
    }
    if (!response.ok) {
      await discardBody(response);
      throw new OfficialDocumentFetchError(`official_http_${response.status}`, "request", sourceId);
    }
    return { response, finalUrl: current.url };
  }
  throw new OfficialDocumentFetchError("redirect_limit", "redirect", sourceId);
}

export async function discoverOfficialDocumentCandidates(
  sourceUrl: string,
  sourceId?: OfficialOpportunitySourceId,
  sourceTitle = "Edital oficial",
) {
  let officialSource;
  try {
    officialSource = parseOfficialOpportunitySourceUrl(sourceUrl, sourceId);
  } catch {
    throw new OfficialDocumentFetchError("invalid_source_url", "policy", sourceId);
  }
  const id = officialSource.sourceId;
  assertOfficialDocumentAccess(officialSource.url, id);
  if (/\.pdf(?:$|[?#])/i.test(officialSource.url)) {
    return Object.freeze([
      buildDirectOfficialDocumentCandidate(officialSource.url, id, sourceTitle),
    ]);
  }

  const { response, finalUrl } = await fetchOfficialResource(officialSource.url, id);
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (contentType.includes("application/pdf")) {
    // A descoberta registra só o candidato; a captura fará a leitura limitada do PDF.
    await discardBody(response);
    return Object.freeze([buildDirectOfficialDocumentCandidate(finalUrl, id, sourceTitle)]);
  }
  if (contentType && !contentType.includes("text/html") && !contentType.includes("text/plain")) {
    await discardBody(response);
    throw new OfficialDocumentFetchError("unsupported_source_type", "discovery", id);
  }
  const body = await readLimitedBody(response, MAX_DISCOVERY_BYTES, id);
  const html = new TextDecoder("utf-8", { fatal: false }).decode(body);
  try {
    return discoverOfficialDocumentCandidatesFromHtml(html, finalUrl, id);
  } catch (error) {
    throw normalizeOfficialDocumentFetchError(error, "official_discovery_failed", "discovery", id);
  }
}

function safeFileName(response: Response, finalUrl: string) {
  const disposition = response.headers.get("content-disposition") ?? "";
  const encoded = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  const plain = disposition.match(/filename="?([^";]+)"?/i)?.[1];
  let candidate: string | undefined;
  try {
    candidate = encoded ? decodeURIComponent(encoded) : plain;
  } catch {
    candidate = plain;
  }
  if (!candidate) {
    const pathName = new URL(finalUrl).pathname.split("/").pop() || "edital-oficial.pdf";
    try {
      candidate = decodeURIComponent(pathName);
    } catch {
      candidate = pathName;
    }
  }
  return candidate.replace(/[\\/:*?"<>|\u0000-\u001f]/g, "-").slice(0, 240);
}

export type CapturedOfficialDocument = Readonly<{
  documentUrl: string;
  sourceHost: string;
  fileName: string;
  mimeType: string;
  documentBytes: Buffer;
  checksumSha256: string;
  byteLength: number;
  pageCount: number;
  extractedText: string;
  pageTexts: readonly string[];
  textLength: number;
  parserVersion: string;
}>;

export async function captureOfficialPdf(
  candidate: OfficialDocumentCandidate,
  sourceId: OfficialOpportunitySourceId,
): Promise<CapturedOfficialDocument> {
  buildDirectOfficialDocumentCandidate(candidate.url, sourceId, candidate.label);
  const { response, finalUrl } = await fetchOfficialResource(candidate.url, sourceId);
  const bytes = await readLimitedBody(response, MAX_OFFICIAL_DOCUMENT_BYTES, sourceId);
  if (bytes.byteLength < 5 || new TextDecoder("ascii").decode(bytes.slice(0, 5)) !== "%PDF-") {
    throw new OfficialDocumentFetchError("invalid_pdf_signature", "pdf_signature", sourceId);
  }

  const fileName = safeFileName(response, finalUrl);
  if (isProhibitedExamMaterial(`${candidate.label} ${fileName} ${finalUrl}`)) {
    throw new OfficialDocumentFetchError("prohibited_exam_material", "policy", sourceId);
  }

  // PDF.js may transfer/detach the input ArrayBuffer. Keep an independent copy
  // for persistence and give the parser another copy that it may consume.
  const documentBytes = Buffer.from(bytes);
  let pdf;
  try {
    pdf = await getDocumentProxy(new Uint8Array(documentBytes));
  } catch (error) {
    throw normalizeOfficialDocumentFetchError(error, "pdf_parse_failed", "pdf_parse", sourceId);
  }
  let failed = false;
  try {
    if (pdf.numPages < 1 || pdf.numPages > MAX_OFFICIAL_DOCUMENT_PAGES) {
      throw new OfficialDocumentFetchError("pdf_page_limit", "pdf_extract", sourceId);
    }
    const result = await extractText(pdf, { mergePages: false });
    const pageTexts = (Array.isArray(result.text) ? result.text : [result.text]).map((page) =>
      page.replace(/\u0000/g, "").replace(/\r\n?/g, "\n").trim(),
    );
    const extractedText = pageTexts.join("\n\n").trim();
    if (extractedText.length < 100) {
      throw new OfficialDocumentFetchError("pdf_needs_ocr", "pdf_extract", sourceId);
    }
    if (extractedText.length > MAX_OFFICIAL_DOCUMENT_TEXT_LENGTH) {
      throw new OfficialDocumentFetchError("pdf_text_limit", "pdf_extract", sourceId);
    }

    const official = parseOfficialOpportunityDocumentUrl(finalUrl, sourceId);
    return Object.freeze({
      documentUrl: official.url,
      sourceHost: official.hostname,
      fileName,
      mimeType: "application/pdf",
      documentBytes,
      checksumSha256: createHash("sha256").update(documentBytes).digest("hex"),
      byteLength: documentBytes.byteLength,
      pageCount: result.totalPages,
      extractedText,
      pageTexts: Object.freeze(pageTexts),
      textLength: extractedText.length,
      parserVersion: OFFICIAL_DOCUMENT_PARSER_VERSION,
    });
  } catch (error) {
    failed = true;
    throw normalizeOfficialDocumentFetchError(error, "pdf_extract_failed", "pdf_extract", sourceId);
  } finally {
    try {
      await pdf.cleanup();
    } catch (error) {
      if (!failed) {
        throw normalizeOfficialDocumentFetchError(error, "pdf_cleanup_failed", "pdf_cleanup", sourceId);
      }
    }
  }
}
