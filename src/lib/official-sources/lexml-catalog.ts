import * as cheerio from "cheerio";
import type { CheerioAPI } from "cheerio";

// Módulo de lote Node usado pelo monitor em scripts/. Os endpoints são fixos e
// nenhuma função deste arquivo deve ser importada por um Client Component.

const LEXML_SRU_ENDPOINT = "https://www.lexml.gov.br/busca/SRU";
const SENATE_OPEN_DATA_BASE_URL = "https://legis.senado.leg.br/dadosabertos/legislacao";
const USER_AGENT = "LeiProva-LegalCatalog/1.0 (+https://leiprova.2b.app.br/fontes-e-atualizacao)";
const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_RESPONSE_BYTES = 2_097_152;
const MAX_SRU_RECORDS = 10;
const SRU_NAMESPACE = "http://www.loc.gov/zing/srw/";
const SUPPORTED_NUMBERED_SENATE_TYPES = new Set(["LEI", "DEL", "LCP", "DEC", "EMC", "MPV"]);

export type LegalCatalogProvider = "lexml_sru" | "senado_open_data";

export type LegalCatalogLookupErrorCode = "invalid_query" | "not_found" | "identity_mismatch" | "unavailable";

export type LegalCatalogAttemptReason =
  | "not_found"
  | "identity_mismatch"
  | "waf_challenge"
  | "html_response"
  | "timeout"
  | "network_error"
  | "http_error"
  | "response_too_large"
  | "invalid_content_type"
  | "invalid_payload";

export interface LegalCatalogAttempt {
  provider: LegalCatalogProvider;
  reason: LegalCatalogAttemptReason;
  httpStatus: number | null;
}

export class LegalCatalogLookupError extends Error {
  readonly code: LegalCatalogLookupErrorCode;
  readonly attempts: readonly LegalCatalogAttempt[];

  constructor(code: LegalCatalogLookupErrorCode, message: string, attempts: readonly LegalCatalogAttempt[] = []) {
    super(message);
    this.name = "LegalCatalogLookupError";
    this.code = code;
    this.attempts = attempts;
  }
}

export interface LegalActCatalogQuery {
  urn?: string;
  type?: string;
  number?: string | number;
  year?: number;
}

export interface LegalCatalogMetadata {
  provider: LegalCatalogProvider;
  urn: string;
  title: string | null;
  actType: string;
  actNumber: string;
  actYear: number;
  signingDate: string | null;
  officialUrl: string;
  sourceUrl: string;
  providerDocumentId: string | null;
}

export interface LegalCatalogLookupOptions {
  timeoutMs?: number;
  maxResponseBytes?: number;
}

interface ParsedUrnIdentity {
  urn: string;
  actType: string;
  actNumber: string;
  actYear: number;
  signingDate: string | null;
}

interface NormalizedQuery {
  urn: string | null;
  actType: string;
  actTypeKey: string;
  actNumber: string;
  actNumberKey: string;
  actYear: number;
  senateType: string;
}

interface ProviderCandidate {
  urn: string;
  title: string | null;
  signingDate: string | null;
  officialUrl: string | null;
  providerDocumentId: string | null;
  explicitType?: string | null;
  explicitNumber?: string | null;
  explicitYear?: number | null;
}

type ProviderOutcome =
  | { kind: "match"; metadata: LegalCatalogMetadata }
  | { kind: "not_found" }
  | { kind: "identity_mismatch" };

class ProviderRequestError extends Error {
  readonly attempt: LegalCatalogAttempt;

  constructor(provider: LegalCatalogProvider, reason: LegalCatalogAttemptReason, httpStatus: number | null = null) {
    super(`${provider}: ${reason}`);
    this.name = "ProviderRequestError";
    this.attempt = { provider, reason, httpStatus };
  }
}

const TYPE_ALIASES: Readonly<Record<string, { lexml: string; senate: string; cql: string }>> = {
  lei: { lexml: "lei", senate: "LEI", cql: "lei" },
  del: { lexml: "decreto.lei", senate: "DEL", cql: "decreto lei" },
  decretolei: { lexml: "decreto.lei", senate: "DEL", cql: "decreto lei" },
  lcp: { lexml: "lei.complementar", senate: "LCP", cql: "lei complementar" },
  leicomplementar: { lexml: "lei.complementar", senate: "LCP", cql: "lei complementar" },
  dec: { lexml: "decreto", senate: "DEC", cql: "decreto" },
  decreto: { lexml: "decreto", senate: "DEC", cql: "decreto" },
  emc: { lexml: "emenda.constitucional", senate: "EMC", cql: "emenda constitucional" },
  emendaconstitucional: { lexml: "emenda.constitucional", senate: "EMC", cql: "emenda constitucional" },
  mpv: { lexml: "medida.provisoria", senate: "MPV", cql: "medida provisoria" },
  medidaprovisoria: { lexml: "medida.provisoria", senate: "MPV", cql: "medida provisoria" },
  conv: { lexml: "constituicao", senate: "CON-v", cql: "constituicao" },
  constituicao: { lexml: "constituicao", senate: "CON-v", cql: "constituicao" },
};

function compactWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function simplifyToken(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function normalizeActNumber(value: string | number) {
  const normalized = String(value).trim().replace(/[^a-zA-Z0-9-]/g, "").toLowerCase();
  if (!normalized) throw invalidQuery("O número do ato é obrigatório.");
  return /^\d+$/.test(normalized) ? normalized.replace(/^0+(?=\d)/, "") : normalized;
}

function normalizeUrn(value: string) {
  const urn = value.trim();
  if (urn.length > 512 || !/^urn:lex:br:[^\s\u0000-\u001f]+$/i.test(urn)) {
    throw invalidQuery("A URN informada não segue o padrão LexML brasileiro.");
  }
  return urn;
}

function normalizeIsoDate(value: string | null | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const brazilian = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(trimmed);
  if (brazilian) return `${brazilian[3]}-${brazilian[2]}-${brazilian[1]}`;
  return null;
}

function parseLexmlUrn(value: string): ParsedUrnIdentity | null {
  const urn = value.trim();
  if (!/^urn:lex:br:/i.test(urn)) return null;
  const match = /:([^:;]+):(\d{4}(?:-\d{2}(?:-\d{2})?)?);([^@!]+)(?:[@!].*)?$/i.exec(urn);
  if (!match) return null;

  const actType = match[1].toLowerCase();
  let actNumber: string;
  try {
    actNumber = normalizeActNumber(match[3]);
  } catch {
    return null;
  }
  const actYear = Number(match[2].slice(0, 4));
  const signingDate = /^\d{4}-\d{2}-\d{2}$/.test(match[2]) ? match[2] : null;

  return { urn, actType, actNumber, actYear, signingDate };
}

function typeDescriptor(value: string) {
  const simplified = simplifyToken(value);
  const withoutSenateVariant = simplifyToken(value.replace(/-[nv]$/i, ""));
  return TYPE_ALIASES[simplified] ?? TYPE_ALIASES[withoutSenateVariant] ?? {
    lexml: value.trim().toLowerCase().replace(/[\s_-]+/g, "."),
    senate: value.trim().toUpperCase(),
    cql: value.trim().toLowerCase().replace(/[._-]+/g, " "),
  };
}

function canonicalTypeKey(value: string) {
  return simplifyToken(typeDescriptor(value).lexml);
}

function invalidQuery(message: string): LegalCatalogLookupError {
  return new LegalCatalogLookupError("invalid_query", message);
}

function normalizeQuery(input: LegalActCatalogQuery): NormalizedQuery {
  const hasUrn = typeof input.urn === "string" && input.urn.trim().length > 0;
  const identityParts = [input.type, input.number, input.year];
  const suppliedIdentityParts = identityParts.filter((part) => part !== undefined && part !== null).length;

  if (!hasUrn && suppliedIdentityParts === 0) {
    throw invalidQuery("Informe uma URN ou o conjunto tipo, número e ano do ato.");
  }
  if (!hasUrn && suppliedIdentityParts > 0 && suppliedIdentityParts !== 3) {
    throw invalidQuery("Tipo, número e ano devem ser informados juntos.");
  }

  const urn = hasUrn ? normalizeUrn(input.urn!) : null;
  const urnIdentity = urn ? parseLexmlUrn(urn) : null;
  if (urn && !urnIdentity) throw invalidQuery("A URN não contém uma identidade de ato individual válida.");

  const explicitType = input.type !== undefined && input.type !== null ? String(input.type).trim() : null;
  if (explicitType !== null && (!explicitType || explicitType.length > 80)) {
    throw invalidQuery("O tipo do ato é inválido.");
  }
  const explicitNumber = input.number !== undefined && input.number !== null ? normalizeActNumber(input.number) : null;
  const explicitYear = input.year !== undefined && input.year !== null ? Number(input.year) : null;
  if (explicitYear !== null && (!Number.isInteger(explicitYear) || explicitYear < 1000 || explicitYear > 9999)) {
    throw invalidQuery("O ano do ato é inválido.");
  }

  if (urnIdentity) {
    if (
      (explicitType !== null && canonicalTypeKey(explicitType) !== canonicalTypeKey(urnIdentity.actType)) ||
      (explicitNumber !== null && explicitNumber !== urnIdentity.actNumber) ||
      (explicitYear !== null && explicitYear !== urnIdentity.actYear)
    ) {
      throw invalidQuery("A URN e a identidade tipo/número/ano apontam para atos diferentes.");
    }
  }

  const actType = explicitType ?? urnIdentity!.actType;
  const descriptor = typeDescriptor(actType);
  if (!urn && !SUPPORTED_NUMBERED_SENATE_TYPES.has(descriptor.senate)) {
    throw invalidQuery(
      "A consulta por tipo, número e ano aceita apenas atos numerados suportados; para os demais, informe a URN LexML.",
    );
  }
  const actNumber = explicitNumber ?? urnIdentity!.actNumber;
  const actYear = explicitYear ?? urnIdentity!.actYear;

  return {
    urn,
    actType: descriptor.lexml,
    actTypeKey: canonicalTypeKey(descriptor.lexml),
    actNumber,
    actNumberKey: normalizeActNumber(actNumber),
    actYear,
    senateType: descriptor.senate,
  };
}

function escapeCqlTerm(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function buildSruUrl(query: NormalizedQuery) {
  const url = new URL(LEXML_SRU_ENDPOINT);
  const cql = query.urn
    ? `urn = "${escapeCqlTerm(query.urn)}"`
    : `urn = "br federal ${escapeCqlTerm(typeDescriptor(query.actType).cql)} ${query.actYear} ${escapeCqlTerm(query.actNumber)}"`;
  url.searchParams.set("operation", "searchRetrieve");
  url.searchParams.set("version", "1.1");
  url.searchParams.set("query", cql);
  url.searchParams.set("recordSchema", "dc");
  url.searchParams.set("maximumRecords", String(MAX_SRU_RECORDS));
  url.searchParams.set("startRecord", "1");
  return url;
}

function buildSenateUrl(query: NormalizedQuery) {
  if (query.urn) {
    const url = new URL(`${SENATE_OPEN_DATA_BASE_URL}/urn`);
    url.searchParams.set("urn", query.urn);
    url.searchParams.set("v", "3");
    return url;
  }

  const path = [query.senateType, query.actNumber, String(query.actYear)].map(encodeURIComponent).join("/");
  const url = new URL(`${SENATE_OPEN_DATA_BASE_URL}/${path}`);
  url.searchParams.set("v", "3");
  return url;
}

function normalizeOptions(options: LegalCatalogLookupOptions) {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxResponseBytes = options.maxResponseBytes ?? DEFAULT_MAX_RESPONSE_BYTES;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60_000) {
    throw invalidQuery("O timeout do catálogo deve estar entre 1 e 60000 ms.");
  }
  if (!Number.isInteger(maxResponseBytes) || maxResponseBytes < 1_024 || maxResponseBytes > 2_097_152) {
    throw invalidQuery("O limite da resposta deve estar entre 1024 e 2097152 bytes.");
  }
  return { timeoutMs, maxResponseBytes };
}

function isTimeoutError(error: unknown) {
  return error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError");
}

async function readLimitedBody(response: Response, provider: LegalCatalogProvider, limit: number) {
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > limit) {
    throw new ProviderRequestError(provider, "response_too_large", response.status);
  }
  if (!response.body) return new Uint8Array();

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (total + value.length > limit) {
      await reader.cancel().catch(() => undefined);
      throw new ProviderRequestError(provider, "response_too_large", response.status);
    }
    chunks.push(value);
    total += value.length;
  }

  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

function decodeBody(bytes: Uint8Array, contentType: string | null, provider: LegalCatalogProvider) {
  const charset = /charset\s*=\s*["']?([^;\s"']+)/i.exec(contentType ?? "")?.[1]?.toLowerCase();
  const encoding = charset === "iso-8859-1" || charset === "windows-1252" ? "windows-1252" : "utf-8";
  try {
    return new TextDecoder(encoding, { fatal: true }).decode(bytes);
  } catch {
    throw new ProviderRequestError(provider, "invalid_payload");
  }
}

function htmlReason(body: string): "waf_challenge" | "html_response" | null {
  const sample = body.slice(0, 16_384).toLowerCase();
  const looksLikeHtml = /<!doctype\s+html|<html\b|<head\b|<title\b/.test(sample);
  if (!looksLikeHtml) return null;
  if (
    sample.includes("verificação de segurança") ||
    sample.includes("verificacao de seguranca") ||
    sample.includes("/_challenge") ||
    sample.includes("confirmando que este acesso") ||
    sample.includes("captcha") ||
    sample.includes("cloudflare")
  ) {
    return "waf_challenge";
  }
  return "html_response";
}

function isExpectedContentType(contentType: string | null, expected: "xml" | "json") {
  if (!contentType) return false;
  const mediaType = contentType.split(";", 1)[0].trim().toLowerCase();
  return expected === "xml"
    ? mediaType === "application/xml" || mediaType === "text/xml" || mediaType.endsWith("+xml")
    : mediaType === "application/json" || mediaType.endsWith("+json");
}

async function fetchProviderBody(
  provider: LegalCatalogProvider,
  url: URL,
  expected: "xml" | "json",
  options: ReturnType<typeof normalizeOptions>,
) {
  const signal = AbortSignal.timeout(options.timeoutMs);
  let response: Response;
  try {
    response = await fetch(url, {
      redirect: "error",
      headers: {
        Accept: expected === "xml" ? "application/xml,text/xml;q=0.9" : "application/json",
        "User-Agent": USER_AGENT,
      },
      signal,
      cache: "no-store",
    });
  } catch (error) {
    throw new ProviderRequestError(
      provider,
      isTimeoutError(error) || (signal.aborted && isTimeoutError(signal.reason)) ? "timeout" : "network_error",
    );
  }

  let bytes: Uint8Array;
  try {
    bytes = await readLimitedBody(response, provider, options.maxResponseBytes);
  } catch (error) {
    if (error instanceof ProviderRequestError) throw error;
    throw new ProviderRequestError(
      provider,
      isTimeoutError(error) || (signal.aborted && isTimeoutError(signal.reason)) ? "timeout" : "network_error",
      response.status,
    );
  }
  const contentType = response.headers.get("content-type");
  const body = decodeBody(bytes, contentType, provider);
  const detectedHtml = htmlReason(body);
  if (detectedHtml) throw new ProviderRequestError(provider, detectedHtml, response.status);
  if (response.status === 404) return { body, sourceUrl: url.toString(), notFound: true as const };
  if (!response.ok) throw new ProviderRequestError(provider, "http_error", response.status);
  if (!isExpectedContentType(contentType, expected)) {
    throw new ProviderRequestError(provider, "invalid_content_type", response.status);
  }
  return { body, sourceUrl: url.toString(), notFound: false as const };
}

function localName(elementName: string) {
  return elementName.split(":").at(-1)?.toLowerCase() ?? "";
}

function firstTextByLocalNames($: CheerioAPI, names: readonly string[]) {
  const wanted = new Set(names.map((name) => name.toLowerCase()));
  const element = $("*")
    .toArray()
    .find((candidate) => candidate.type === "tag" && wanted.has(localName(candidate.name)));
  return element ? compactWhitespace($(element).text()) || null : null;
}

function allTextsByLocalNames($: CheerioAPI, names: readonly string[]) {
  const wanted = new Set(names.map((name) => name.toLowerCase()));
  return $("*")
    .toArray()
    .filter((candidate) => candidate.type === "tag" && wanted.has(localName(candidate.name)))
    .map((candidate) => compactWhitespace($(candidate).text()))
    .filter(Boolean);
}

function officialMetadataUrl(value: string | null, urn: string) {
  if (value) {
    try {
      const url = new URL(value);
      if (
        url.protocol === "https:" &&
        (url.hostname === "www.lexml.gov.br" ||
          url.hostname === "lexml.gov.br" ||
          url.hostname === "normas.leg.br" ||
          url.hostname.endsWith(".senado.leg.br"))
      ) {
        return url.toString();
      }
    } catch {
      // A URL recebida é apenas metadado; uma origem não oficial é descartada.
    }
  }
  return `https://www.lexml.gov.br/urn/${urn}`;
}

function metadataFromCandidate(
  provider: LegalCatalogProvider,
  candidate: ProviderCandidate,
  sourceUrl: string,
): LegalCatalogMetadata | null {
  const identity = parseLexmlUrn(candidate.urn);
  if (!identity) return null;

  let explicitNumber: string | null = null;
  try {
    explicitNumber = candidate.explicitNumber ? normalizeActNumber(candidate.explicitNumber) : null;
  } catch {
    return null;
  }

  if (
    (candidate.explicitType && canonicalTypeKey(candidate.explicitType) !== canonicalTypeKey(identity.actType)) ||
    (explicitNumber && explicitNumber !== identity.actNumber) ||
    (candidate.explicitYear && candidate.explicitYear !== identity.actYear) ||
    (candidate.signingDate &&
      identity.signingDate &&
      candidate.signingDate !== identity.signingDate)
  ) {
    return null;
  }

  return {
    provider,
    urn: identity.urn,
    title: candidate.title,
    actType: identity.actType,
    actNumber: identity.actNumber,
    actYear: identity.actYear,
    signingDate: candidate.signingDate ?? identity.signingDate,
    officialUrl: officialMetadataUrl(candidate.officialUrl, identity.urn),
    sourceUrl,
    providerDocumentId: candidate.providerDocumentId,
  };
}

function matchesQuery(metadata: LegalCatalogMetadata, query: NormalizedQuery) {
  return (
    (!query.urn || metadata.urn.toLowerCase() === query.urn.toLowerCase()) &&
    canonicalTypeKey(metadata.actType) === query.actTypeKey &&
    normalizeActNumber(metadata.actNumber) === query.actNumberKey &&
    metadata.actYear === query.actYear
  );
}

function evaluateCandidates(
  provider: LegalCatalogProvider,
  candidates: ProviderCandidate[],
  query: NormalizedQuery,
  sourceUrl: string,
): ProviderOutcome {
  if (candidates.length === 0) return { kind: "not_found" };
  const metadata = candidates
    .map((candidate) => metadataFromCandidate(provider, candidate, sourceUrl))
    .filter((candidate): candidate is LegalCatalogMetadata => candidate !== null);
  if (metadata.length === 0) {
    if (candidates.some((candidate) => parseLexmlUrn(candidate.urn))) {
      return { kind: "identity_mismatch" };
    }
    throw new ProviderRequestError(provider, "invalid_payload");
  }
  const match = metadata.find((candidate) => matchesQuery(candidate, query));
  return match ? { kind: "match", metadata: match } : { kind: "identity_mismatch" };
}

function parseSruCandidates(xml: string, provider: LegalCatalogProvider) {
  if (/<!doctype\b|<!entity\b/i.test(xml)) {
    throw new ProviderRequestError(provider, "invalid_payload");
  }

  let $: CheerioAPI;
  try {
    $ = cheerio.load(xml, { xml: true });
  } catch {
    throw new ProviderRequestError(provider, "invalid_payload");
  }

  const rootElements = $.root()
    .children()
    .toArray()
    .filter((candidate) => candidate.type === "tag");
  if (rootElements.length !== 1 || localName(rootElements[0].name) !== "searchretrieveresponse") {
    throw new ProviderRequestError(provider, "invalid_payload");
  }
  const rootElement = rootElements[0];
  const prefix = rootElement.name.includes(":") ? rootElement.name.split(":", 1)[0] : null;
  const namespace = rootElement.attribs[prefix ? `xmlns:${prefix}` : "xmlns"];
  if (namespace !== SRU_NAMESPACE) throw new ProviderRequestError(provider, "invalid_payload");

  const root = $(rootElement);
  const rootApi = cheerio.load(root.toString(), { xml: true });
  const numberOfRecordsValue = firstTextByLocalNames(rootApi, ["numberOfRecords"]);
  if (numberOfRecordsValue === null || !/^\d+$/.test(numberOfRecordsValue)) {
    throw new ProviderRequestError(provider, "invalid_payload");
  }
  const numberOfRecords = Number(numberOfRecordsValue);
  if (numberOfRecords === 0) return [];

  const records = root
    .find("*")
    .toArray()
    .filter((candidate) => candidate.type === "tag" && localName(candidate.name) === "record");
  if (records.length === 0) throw new ProviderRequestError(provider, "invalid_payload");

  return records.map((record) => {
    const recordApi = cheerio.load($(record).toString(), { xml: true });
    const identifiers = allTextsByLocalNames(recordApi, ["identifier", "urn", "url"]);
    const urn = identifiers.find((identifier) => /^urn:lex:br:/i.test(identifier)) ?? "";
    const officialUrl = identifiers.find((identifier) => /^https:\/\//i.test(identifier)) ?? null;
    const signingDate = normalizeIsoDate(firstTextByLocalNames(recordApi, ["date", "issued", "dataAssinatura"]));
    const providerDocumentId =
      firstTextByLocalNames(recordApi, ["recordIdentifier", "providerDocumentId"]) ??
      identifiers.find((identifier) => !/^urn:|^https?:/i.test(identifier)) ??
      null;

    return {
      urn,
      title: firstTextByLocalNames(recordApi, ["title"]),
      signingDate,
      officialUrl,
      providerDocumentId,
    } satisfies ProviderCandidate;
  });
}

function asObject(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function getCaseInsensitive(object: Record<string, unknown>, key: string) {
  const match = Object.keys(object).find((candidate) => candidate.toLowerCase() === key.toLowerCase());
  return match ? object[match] : undefined;
}

function optionalString(object: Record<string, unknown>, key: string) {
  const value = getCaseInsensitive(object, key);
  if (typeof value === "string") return compactWhitespace(value) || null;
  if (typeof value === "number") return String(value);
  return null;
}

function urnFromDocumentUrl(value: string | null) {
  if (!value) return null;
  if (/^urn:lex:br:/i.test(value)) return value;
  try {
    const url = new URL(value);
    return url.searchParams.get("urn") ?? (/urn:lex:br:/i.test(url.pathname) ? decodeURIComponent(url.pathname.split("/").at(-1) ?? "") : null);
  } catch {
    return null;
  }
}

function parseSenateCandidates(json: string, provider: LegalCatalogProvider) {
  let payload: unknown;
  try {
    payload = JSON.parse(json);
  } catch {
    throw new ProviderRequestError(provider, "invalid_payload");
  }

  const root = asObject(payload);
  const detail = root ? asObject(getCaseInsensitive(root, "DetalheDocumento")) : null;
  const documents = detail ? asObject(getCaseInsensitive(detail, "documentos")) : null;
  const metadata = detail ? asObject(getCaseInsensitive(detail, "Metadados")) : null;
  if (!root || !detail || (!documents && !metadata)) {
    throw new ProviderRequestError(provider, "invalid_payload");
  }
  if (!documents) return [];

  const documentValue = documents ? getCaseInsensitive(documents, "documento") : undefined;
  const documentList = Array.isArray(documentValue) ? documentValue : documentValue ? [documentValue] : [];

  return documentList.map((value) => {
    const document = asObject(value);
    const identification = document ? asObject(getCaseInsensitive(document, "identificacao")) : null;
    if (!document || !identification) throw new ProviderRequestError(provider, "invalid_payload");

    const documentUrl = optionalString(identification, "urlDocumento");
    const urn = optionalString(identification, "urn") ?? urnFromDocumentUrl(documentUrl) ?? "";
    const signingDate = normalizeIsoDate(optionalString(identification, "dataassinatura"));
    const explicitYearValue = optionalString(identification, "ano");
    const explicitYear = signingDate ? Number(signingDate.slice(0, 4)) : explicitYearValue ? Number(explicitYearValue) : null;

    return {
      urn,
      title:
        optionalString(identification, "normaNome") ??
        optionalString(identification, "nome") ??
        optionalString(identification, "descricao"),
      signingDate,
      officialUrl: documentUrl,
      providerDocumentId: optionalString(document, "id"),
      explicitType: optionalString(identification, "tipo"),
      explicitNumber: optionalString(identification, "numero"),
      explicitYear: Number.isInteger(explicitYear) ? explicitYear : null,
    } satisfies ProviderCandidate;
  });
}

async function lookupSru(query: NormalizedQuery, options: ReturnType<typeof normalizeOptions>): Promise<ProviderOutcome> {
  const provider: LegalCatalogProvider = "lexml_sru";
  const response = await fetchProviderBody(provider, buildSruUrl(query), "xml", options);
  if (response.notFound) return { kind: "not_found" };
  return evaluateCandidates(provider, parseSruCandidates(response.body, provider), query, response.sourceUrl);
}

async function lookupSenate(query: NormalizedQuery, options: ReturnType<typeof normalizeOptions>): Promise<ProviderOutcome> {
  const provider: LegalCatalogProvider = "senado_open_data";
  const response = await fetchProviderBody(provider, buildSenateUrl(query), "json", options);
  if (response.notFound) return { kind: "not_found" };
  return evaluateCandidates(provider, parseSenateCandidates(response.body, provider), query, response.sourceUrl);
}

function recordOutcome(attempts: LegalCatalogAttempt[], provider: LegalCatalogProvider, outcome: ProviderOutcome) {
  if (outcome.kind !== "match") attempts.push({ provider, reason: outcome.kind, httpStatus: null });
}

/**
 * Consulta primeiro o SRU do LexML e usa os Dados Abertos do Senado como contingência.
 * A função apenas descobre e valida metadados; ela não publica nem considera revisado o texto do ato.
 */
export async function lookupLegalActMetadata(
  input: LegalActCatalogQuery,
  lookupOptions: LegalCatalogLookupOptions = {},
): Promise<LegalCatalogMetadata> {
  const query = normalizeQuery(input);
  const options = normalizeOptions(lookupOptions);
  const attempts: LegalCatalogAttempt[] = [];

  try {
    const outcome = await lookupSru(query, options);
    if (outcome.kind === "match") return outcome.metadata;
    recordOutcome(attempts, "lexml_sru", outcome);
  } catch (error) {
    attempts.push(
      error instanceof ProviderRequestError
        ? error.attempt
        : { provider: "lexml_sru", reason: "network_error", httpStatus: null },
    );
  }

  try {
    const outcome = await lookupSenate(query, options);
    if (outcome.kind === "match") return outcome.metadata;
    recordOutcome(attempts, "senado_open_data", outcome);
  } catch (error) {
    attempts.push(
      error instanceof ProviderRequestError
        ? error.attempt
        : { provider: "senado_open_data", reason: "network_error", httpStatus: null },
    );
  }

  if (attempts.some((attempt) => attempt.reason === "identity_mismatch")) {
    throw new LegalCatalogLookupError(
      "identity_mismatch",
      "Os catálogos oficiais responderam, mas nenhum registro corresponde exatamente ao tipo, número, ano e URN informados.",
      attempts,
    );
  }
  if (attempts.some((attempt) => attempt.reason === "not_found")) {
    throw new LegalCatalogLookupError("not_found", "O ato não foi localizado nos catálogos oficiais.", attempts);
  }
  throw new LegalCatalogLookupError("unavailable", "Os catálogos jurídicos oficiais estão temporariamente indisponíveis.", attempts);
}
