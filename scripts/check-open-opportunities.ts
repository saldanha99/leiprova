import { OFFICIAL_OPPORTUNITY_CANDIDATES } from "../src/lib/opportunities/official-candidates";
import {
  checkOpportunitySourceMetadata,
  classifyOpportunitySourceHttpStatus,
} from "../src/lib/opportunities/source-metadata-check";

function safeError(error: unknown) {
  return error instanceof Error ? error.message.slice(0, 300) : "Falha sem detalhe seguro.";
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
      const observation = await checkOpportunitySourceMetadata(source);
      observations.push(observation);
      const disposition = classifyOpportunitySourceHttpStatus(observation.httpStatus);
      if (disposition === "head_restricted") {
        warnings.push({
          sourceId: source.sourceId,
          url: source.url,
          warning: `A origem respondeu HTTP ${observation.httpStatus} ao método HEAD.`,
        });
      } else if (disposition === "failed") {
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
