import type { InternalOpportunitySourceCandidate } from "@/lib/opportunities/official-candidates";
import {
  normalizeOpportunitySourceMetadata,
  parseOfficialOpportunitySourceUrl,
  resolveOfficialOpportunityRedirect,
  type OpportunitySourceMetadata,
} from "@/lib/opportunities/source-monitor-policy";

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_REDIRECTS = 5;

export type OpportunitySourceHttpDisposition = "verified" | "head_restricted" | "failed";

export function classifyOpportunitySourceHttpStatus(
  httpStatus: number,
): OpportunitySourceHttpDisposition {
  if (httpStatus >= 200 && httpStatus < 400) return "verified";

  // A restrição do HEAD não prova que a fonte está disponível. Exceções para
  // 403/405 precisam ser declaradas por fonte e submetidas à revisão humana;
  // sem essa declaração explícita, inclusive 401/429, a aprovação é bloqueada.
  return "failed";
}

function parseContentLength(value: string | null) {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

export async function checkOpportunitySourceMetadata(
  source: InternalOpportunitySourceCandidate,
  options: Readonly<{
    fetcher?: typeof fetch;
    timeoutMs?: number;
    maxRedirects?: number;
    observedAt?: () => string;
  }> = {},
): Promise<OpportunitySourceMetadata> {
  const fetcher = options.fetcher ?? fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxRedirects = options.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
  const observedAt = options.observedAt ?? (() => new Date().toISOString());
  let registered = parseOfficialOpportunitySourceUrl(source.url, source.sourceId);
  let response: Response | null = null;

  for (let hop = 0; hop <= maxRedirects; hop += 1) {
    response = await fetcher(registered.url, {
      method: "HEAD",
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        Accept: "*/*",
        "User-Agent":
          "LeiProvaOfficialOpportunityMonitor/1.0 (+https://leiprova.2b.app.br/fontes-e-atualizacao)",
      },
    });

    if (![301, 302, 303, 307, 308].includes(response.status)) break;
    const location = response.headers.get("location");
    if (!location) throw new Error("A origem respondeu com redirecionamento sem destino.");
    if (hop === maxRedirects) {
      throw new Error("A origem excedeu o limite seguro de redirecionamentos.");
    }

    registered = resolveOfficialOpportunityRedirect(
      registered.url,
      location,
      source.sourceId,
    );
  }

  if (!response) throw new Error("A origem não retornou resposta.");

  return normalizeOpportunitySourceMetadata({
    sourceId: source.sourceId,
    url: registered.url,
    httpStatus: response.status,
    observedAt: observedAt(),
    contentType: response.headers.get("content-type"),
    contentLength: parseContentLength(response.headers.get("content-length")),
    etag: response.headers.get("etag"),
    lastModified: response.headers.get("last-modified"),
  });
}
