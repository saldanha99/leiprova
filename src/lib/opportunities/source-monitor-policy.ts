export const OFFICIAL_OPPORTUNITY_SOURCE_POLICIES = [
  {
    id: "enfam",
    publisher: "Escola Nacional de Formação e Aperfeiçoamento de Magistrados",
    allowedHosts: ["enfam.jus.br", "www.enfam.jus.br"],
    allowedPathPrefixes: ["/enam/", "/publicado-o-edital-"],
  },
  {
    id: "cnj",
    publisher: "Conselho Nacional de Justiça",
    allowedHosts: ["cnj.jus.br", "www.cnj.jus.br"],
    allowedPathPrefixes: ["/programas-e-acoes/enac/", "/4o-exame-nacional-dos-cartorios-"],
  },
  {
    id: "fgv-conhecimento",
    publisher: "FGV Conhecimento",
    allowedHosts: ["conhecimento.fgv.br"],
    allowedPathPrefixes: ["/concursos/", "/exames/"],
  },
  {
    id: "governo-bahia",
    publisher: "Governo do Estado da Bahia",
    allowedHosts: ["ba.gov.br", "www.ba.gov.br"],
    allowedPathPrefixes: ["/policiacivil/", "/ssp/"],
  },
  {
    id: "policia-civil-maranhao",
    publisher: "Polícia Civil do Estado do Maranhão",
    allowedHosts: ["policiacivil.ma.gov.br", "www.policiacivil.ma.gov.br"],
    allowedPathPrefixes: ["/"],
  },
  {
    id: "ssp-maranhao",
    publisher: "Secretaria de Estado da Segurança Pública do Maranhão",
    allowedHosts: ["ssp.ma.gov.br", "www.ssp.ma.gov.br"],
    allowedPathPrefixes: ["/editais-seletivos-concursos/policia-civil/"],
  },
  {
    id: "policia-civil-parana",
    publisher: "Polícia Civil do Estado do Paraná",
    allowedHosts: ["policiacivil.pr.gov.br", "www.policiacivil.pr.gov.br"],
    allowedPathPrefixes: ["/Noticia/", "/Pagina/"],
  },
  {
    id: "prefeitura-manaus",
    publisher: "Prefeitura de Manaus",
    allowedHosts: ["manaus.am.gov.br", "www.manaus.am.gov.br"],
    allowedPathPrefixes: ["/noticia/", "/pgm/"],
  },
  {
    id: "fcc-concursos",
    publisher: "Fundação Carlos Chagas",
    allowedHosts: ["concursosfcc.com.br", "www.concursosfcc.com.br"],
    allowedPathPrefixes: ["/concursos/"],
  },
] as const;

export type OfficialOpportunitySourcePolicy =
  (typeof OFFICIAL_OPPORTUNITY_SOURCE_POLICIES)[number];
export type OfficialOpportunitySourceId = OfficialOpportunitySourcePolicy["id"];

export type ValidatedOfficialOpportunityUrl = Readonly<{
  sourceId: OfficialOpportunitySourceId;
  publisher: string;
  hostname: string;
  url: string;
}>;

export type OpportunitySourceMetadata = Readonly<{
  sourceId: OfficialOpportunitySourceId;
  publisher: string;
  url: string;
  hostname: string;
  requestMethod: "HEAD";
  httpStatus: number;
  observedAt: string;
  contentType: string | null;
  contentLength: number | null;
  etag: string | null;
  lastModified: string | null;
  sourcePolicy: "metadata_only";
  sourceContentStored: false;
}>;

const METADATA_INPUT_KEYS = new Set([
  "sourceId",
  "url",
  "httpStatus",
  "observedAt",
  "contentType",
  "contentLength",
  "etag",
  "lastModified",
]);

const ISO_INSTANT_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === "object" && input !== null && !Array.isArray(input);
}

function normalizeOptionalMetadataText(value: unknown, field: string) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") throw new Error(`${field} precisa ser texto.`);

  const normalized = value.trim();
  if (!normalized || normalized.length > 1_000) {
    throw new Error(`${field} possui tamanho inválido.`);
  }
  return normalized;
}

function normalizeObservedAt(value: unknown) {
  if (typeof value !== "string" || !ISO_INSTANT_PATTERN.test(value)) {
    throw new Error("observedAt precisa ser um instante ISO válido com fuso horário.");
  }

  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) throw new Error("observedAt precisa ser um instante ISO válido.");
  if (timestamp > Date.now() + 5 * 60 * 1_000) {
    throw new Error("observedAt não pode estar no futuro.");
  }

  return new Date(timestamp).toISOString();
}

export function getOfficialOpportunitySourcePolicy(sourceId: string) {
  return (
    OFFICIAL_OPPORTUNITY_SOURCE_POLICIES.find((policy) => policy.id === sourceId) ?? null
  );
}

function urlMatchesPolicy(url: URL, policy: OfficialOpportunitySourcePolicy) {
  const hostname = url.hostname.toLowerCase();
  return (
    (policy.allowedHosts as readonly string[]).includes(hostname) &&
    policy.allowedPathPrefixes.some((prefix) => url.pathname.startsWith(prefix))
  );
}

/**
 * Pure allowlist validation. It does not perform network access and intentionally
 * returns no page body or document bytes.
 */
export function parseOfficialOpportunitySourceUrl(
  input: string,
  expectedSourceId?: OfficialOpportunitySourceId,
): ValidatedOfficialOpportunityUrl {
  if (typeof input !== "string") throw new Error("Informe uma URL oficial válida.");

  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    throw new Error("Informe uma URL oficial válida.");
  }

  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.port ||
    !url.hostname
  ) {
    throw new Error(
      "A fonte precisa usar HTTPS público, porta padrão e não pode conter credenciais.",
    );
  }

  const policy = expectedSourceId
    ? getOfficialOpportunitySourcePolicy(expectedSourceId)
    : OFFICIAL_OPPORTUNITY_SOURCE_POLICIES.find((candidate) =>
        urlMatchesPolicy(url, candidate),
      );

  if (!policy || !urlMatchesPolicy(url, policy)) {
    throw new Error("A URL não pertence a uma origem oficial permitida para oportunidades.");
  }

  url.hash = "";
  return Object.freeze({
    sourceId: policy.id,
    publisher: policy.publisher,
    hostname: url.hostname.toLowerCase(),
    url: url.toString(),
  });
}

export function isOfficialOpportunitySourceUrl(
  input: string,
  expectedSourceId?: OfficialOpportunitySourceId,
) {
  try {
    parseOfficialOpportunitySourceUrl(input, expectedSourceId);
    return true;
  } catch {
    return false;
  }
}

export function resolveOfficialOpportunityRedirect(
  currentUrl: string,
  location: string,
  expectedSourceId: OfficialOpportunitySourceId,
) {
  const current = parseOfficialOpportunitySourceUrl(currentUrl, expectedSourceId);
  const redirected = new URL(location, current.url);
  return parseOfficialOpportunitySourceUrl(redirected.toString(), expectedSourceId);
}

/**
 * Accepts only response metadata from a HEAD check. Unknown keys are rejected so
 * callers cannot accidentally pass HTML, PDF bytes or any other source content.
 */
export function normalizeOpportunitySourceMetadata(input: unknown): OpportunitySourceMetadata {
  if (!isRecord(input)) throw new Error("Metadados da fonte inválidos.");

  const unknownKey = Object.keys(input).find((key) => !METADATA_INPUT_KEYS.has(key));
  if (unknownKey) {
    throw new Error(`O campo ${unknownKey} não é permitido em uma observação metadata-only.`);
  }

  if (typeof input.sourceId !== "string") throw new Error("sourceId é obrigatório.");
  const policy = getOfficialOpportunitySourcePolicy(input.sourceId);
  if (!policy) throw new Error("sourceId não pertence ao registro oficial.");
  if (typeof input.url !== "string") throw new Error("url é obrigatória.");

  const officialUrl = parseOfficialOpportunitySourceUrl(input.url, policy.id);
  if (!Number.isInteger(input.httpStatus) || Number(input.httpStatus) < 100 || Number(input.httpStatus) > 599) {
    throw new Error("httpStatus precisa estar entre 100 e 599.");
  }

  const contentLength = input.contentLength ?? null;
  if (
    contentLength !== null &&
    (!Number.isSafeInteger(contentLength) || Number(contentLength) < 0)
  ) {
    throw new Error("contentLength precisa ser um inteiro não negativo.");
  }

  return Object.freeze({
    ...officialUrl,
    requestMethod: "HEAD",
    httpStatus: Number(input.httpStatus),
    observedAt: normalizeObservedAt(input.observedAt),
    contentType: normalizeOptionalMetadataText(input.contentType, "contentType"),
    contentLength: contentLength === null ? null : Number(contentLength),
    etag: normalizeOptionalMetadataText(input.etag, "etag"),
    lastModified: normalizeOptionalMetadataText(input.lastModified, "lastModified"),
    sourcePolicy: "metadata_only",
    sourceContentStored: false,
  });
}
