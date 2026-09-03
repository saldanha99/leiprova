import { createHash } from "node:crypto";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

import { extractText, getDocumentProxy } from "unpdf";

import {
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

async function assertPublicOfficialHost(hostname: string) {
  const addresses = await lookup(hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new Error("A origem oficial não resolveu para um endereço público seguro.");
  }
}

async function readLimitedBody(response: Response, limit: number) {
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > limit) {
    throw new Error(`O documento excede o limite de ${Math.round(limit / 1024 / 1024)} MB.`);
  }
  if (!response.body) throw new Error("A origem oficial respondeu sem conteúdo.");

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > limit) {
        await reader.cancel();
        throw new Error(`O documento excede o limite de ${Math.round(limit / 1024 / 1024)} MB.`);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

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
  let current = parseOfficialOpportunityDocumentUrl(initialUrl, sourceId);
  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    await assertPublicOfficialHost(current.hostname);
    const response = await fetchImpl(current.url, {
      method: "GET",
      redirect: "manual",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: {
        Accept: "application/pdf,text/html;q=0.9,*/*;q=0.5",
        "User-Agent": "LeiProva-Official-Notice-Importer/1.0 (+https://leiprova.2b.app.br/fontes-e-atualizacao)",
      },
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new Error("A origem oficial redirecionou sem informar o destino.");
      current = resolveOfficialOpportunityDocumentRedirect(current.url, location, sourceId);
      continue;
    }
    if (!response.ok) throw new Error(`A origem oficial respondeu com HTTP ${response.status}.`);
    return { response, finalUrl: current.url };
  }
  throw new Error("A origem oficial excedeu o limite seguro de redirecionamentos.");
}

export async function discoverOfficialDocumentCandidates(
  sourceUrl: string,
  sourceId?: OfficialOpportunitySourceId,
  sourceTitle = "Edital oficial",
) {
  const officialSource = parseOfficialOpportunitySourceUrl(sourceUrl, sourceId);
  if (/\.pdf(?:$|[?#])/i.test(officialSource.url)) {
    return Object.freeze([
      buildDirectOfficialDocumentCandidate(officialSource.url, officialSource.sourceId, sourceTitle),
    ]);
  }

  const { response, finalUrl } = await fetchOfficialResource(
    officialSource.url,
    officialSource.sourceId,
  );
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (contentType.includes("application/pdf")) {
    return Object.freeze([
      buildDirectOfficialDocumentCandidate(finalUrl, officialSource.sourceId, sourceTitle),
    ]);
  }
  if (contentType && !contentType.includes("text/html") && !contentType.includes("text/plain")) {
    throw new Error("A fonte não retornou uma página HTML nem um PDF oficial.");
  }
  const body = await readLimitedBody(response, MAX_DISCOVERY_BYTES);
  const html = new TextDecoder("utf-8", { fatal: false }).decode(body);
  return discoverOfficialDocumentCandidatesFromHtml(
    html,
    finalUrl,
    officialSource.sourceId,
  );
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
  const bytes = await readLimitedBody(response, MAX_OFFICIAL_DOCUMENT_BYTES);
  if (bytes.byteLength < 5 || new TextDecoder("ascii").decode(bytes.slice(0, 5)) !== "%PDF-") {
    throw new Error("O arquivo selecionado não possui a assinatura de um PDF válido.");
  }

  const fileName = safeFileName(response, finalUrl);
  if (isProhibitedExamMaterial(`${candidate.label} ${fileName} ${finalUrl}`)) {
    throw new Error("Cadernos, questões, respostas e gabaritos de terceiros não podem ser capturados.");
  }

  // PDF.js may transfer/detach the input ArrayBuffer. Keep an independent copy
  // for persistence and give the parser another copy that it may consume.
  const documentBytes = Buffer.from(bytes);
  const pdf = await getDocumentProxy(new Uint8Array(documentBytes));
  try {
    if (pdf.numPages < 1 || pdf.numPages > MAX_OFFICIAL_DOCUMENT_PAGES) {
      throw new Error(`O PDF precisa ter entre 1 e ${MAX_OFFICIAL_DOCUMENT_PAGES} páginas.`);
    }
    const result = await extractText(pdf, { mergePages: false });
    const pageTexts = (Array.isArray(result.text) ? result.text : [result.text]).map((page) =>
      page.replace(/\u0000/g, "").replace(/\r\n?/g, "\n").trim(),
    );
    const extractedText = pageTexts.join("\n\n").trim();
    if (extractedText.length < 100) {
      throw new Error("O PDF não contém texto pesquisável suficiente; OCR ainda não está habilitado.");
    }
    if (extractedText.length > MAX_OFFICIAL_DOCUMENT_TEXT_LENGTH) {
      throw new Error("O texto extraído excede o limite operacional de 2 milhões de caracteres.");
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
  } finally {
    await pdf.cleanup();
  }
}
