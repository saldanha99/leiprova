import { OFFICIAL_OPPORTUNITY_CANDIDATES } from "../src/lib/opportunities/official-candidates";
import {
  normalizeOpportunitySourceMetadata,
  parseOfficialOpportunitySourceUrl,
  resolveOfficialOpportunityRedirect,
} from "../src/lib/opportunities/source-monitor-policy";

const timeoutMs = 15_000;
const maxRedirects = 5;

function parseContentLength(value: string | null) {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

function safeError(error: unknown) {
  return error instanceof Error ? error.message.slice(0, 300) : "Falha sem detalhe seguro.";
}

async function checkSource(source: (typeof OFFICIAL_OPPORTUNITY_CANDIDATES)[number]["officialSources"][number]) {
  let registered = parseOfficialOpportunitySourceUrl(source.url, source.sourceId);
  let response: Response | null = null;

  for (let hop = 0; hop <= maxRedirects; hop += 1) {
    response = await fetch(registered.url, {
      method: "HEAD",
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        Accept: "*/*",
        "User-Agent": "LeiProvaOfficialOpportunityMonitor/1.0 (+https://leiprova.2b.app.br/fontes-e-atualizacao)",
      },
    });

    if (![301, 302, 303, 307, 308].includes(response.status)) break;
    const location = response.headers.get("location");
    if (!location) throw new Error("A origem respondeu com redirecionamento sem destino.");
    if (hop === maxRedirects) throw new Error("A origem excedeu o limite seguro de redirecionamentos.");

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
    observedAt: new Date().toISOString(),
    contentType: response.headers.get("content-type"),
    contentLength: parseContentLength(response.headers.get("content-length")),
    etag: response.headers.get("etag"),
    lastModified: response.headers.get("last-modified"),
  });
}

async function main() {
  const uniqueSources = [
    ...new Map(
      OFFICIAL_OPPORTUNITY_CANDIDATES.flatMap((candidate) => candidate.officialSources).map(
        (source) => [`${source.sourceId}:${source.url}`, source] as const,
      ),
    ).values(),
  ];
  const observations = [];
  const warnings = [];
  const failures = [];

  for (const source of uniqueSources) {
    try {
      const observation = await checkSource(source);
      observations.push(observation);
      if ([401, 403, 405, 429].includes(observation.httpStatus)) {
        warnings.push({
          sourceId: source.sourceId,
          url: source.url,
          warning: `A origem respondeu HTTP ${observation.httpStatus} ao método HEAD.`,
        });
      } else if (observation.httpStatus >= 400) {
        failures.push({
          sourceId: source.sourceId,
          url: source.url,
          error: `A origem respondeu HTTP ${observation.httpStatus}.`,
        });
      }
    } catch (error) {
      failures.push({ sourceId: source.sourceId, url: source.url, error: safeError(error) });
    }
  }

  console.log(
    JSON.stringify(
      {
        completedAt: new Date().toISOString(),
        policy: "metadata_only",
        sourceContentStored: false,
        candidates: OFFICIAL_OPPORTUNITY_CANDIDATES.length,
        checked: observations.length,
        warnings: warnings.length,
        failed: failures.length,
        observations,
        warningDetails: warnings,
        failures,
      },
      null,
      2,
    ),
  );

  if (failures.length) process.exitCode = 1;
}

void main().catch((error: unknown) => {
  console.error("Falha no monitor de oportunidades oficiais.", safeError(error));
  process.exitCode = 1;
});
