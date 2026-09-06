import { randomUUID } from "node:crypto";

import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { discoveryPortalPolicy } from "../src/lib/editorial/discovery-policy";

import {
  auditLogs,
  examSourcePortals,
  legalActs,
  legalSourceSnapshots,
  legalTextSnapshots,
  quizBanks,
} from "../src/lib/db/schema";
import {
  fetchOfficialConsolidatedLegalText,
  fetchOfficialLegalDocument,
  verifyOfficialExamUrl,
} from "../src/lib/official-sources/fetch";
import {
  LegalCatalogLookupError,
  lookupLegalActMetadata,
} from "../src/lib/official-sources/lexml-catalog";
import {
  officialSourceMonitorHasHardFailures,
  resolveOfficialLegalSource,
} from "../src/lib/official-sources/monitor-policy";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("Defina DATABASE_URL antes de executar o monitor.");

const client = postgres(databaseUrl, { max: 1, prepare: false });
const db = drizzle(client);
const pause = () => new Promise((resolve) => setTimeout(resolve, 400));

function safeError(error: unknown) {
  const cause = error instanceof Error && "cause" in error ? error.cause : error;
  if (cause && typeof cause === "object") {
    const record = cause as { code?: unknown; message?: unknown; name?: unknown };
    return JSON.stringify({
      name: typeof record.name === "string" ? record.name : "Error",
      code: typeof record.code === "string" ? record.code : undefined,
      message: typeof record.message === "string" ? record.message.slice(0, 300) : "Falha sem detalhe seguro.",
    });
  }
  return "Falha sem detalhe seguro.";
}

async function checkLaws() {
  const acts = await db
    .select({ id: legalActs.id, slug: legalActs.slug, urn: legalActs.urn, officialUrl: legalActs.officialUrl })
    .from(legalActs)
    .where(eq(legalActs.isActive, true));
  let checked = 0;
  let failed = 0;
  let catalogUnavailable = 0;
  let corpusCaptured = 0;
  let corpusUnchanged = 0;
  let corpusDeferred = 0;
  let corpusWarnings = 0;

  for (const act of acts) {
    const resolution = resolveOfficialLegalSource(act.slug, act.officialUrl);
    if (!resolution.matched) {
      failed += 1;
      console.error(`[lei:${act.slug}] configuração sem correspondência exata (${resolution.reason}).`);
      await pause();
      continue;
    }
    const registered = resolution.source;

    try {
      if (act.urn !== registered.lexmlUrn) {
        throw new Error(`A URN persistida diverge do registro oficial esperado para ${act.slug}.`);
      }

      const [snapshot, catalogResult] = await Promise.all([
        fetchOfficialLegalDocument(registered.monitorUrl),
        lookupLegalActMetadata(
          {
            urn: registered.lexmlUrn,
            type: registered.actType,
            ...(registered.actNumber === null ? {} : { number: registered.actNumber }),
            year: registered.actYear,
          },
          { timeoutMs: 15_000 },
        ).then(
          (metadata) => ({ status: "verified" as const, metadata }),
          (error: unknown) => {
            if (error instanceof LegalCatalogLookupError && error.code === "unavailable") {
              return { status: "unavailable" as const, error };
            }
            throw error;
          },
        ),
      ]);
      if (catalogResult.status === "verified" && catalogResult.metadata.urn !== registered.lexmlUrn) {
        throw new Error(`O catálogo jurídico retornou uma URN divergente para ${act.slug}.`);
      }
      if (catalogResult.status === "unavailable") {
        catalogUnavailable += 1;
        console.warn(`[lexml:${act.slug}] catálogo temporariamente indisponível; mantida a última identidade validada.`);
      }

      const [saved] = await db
        .insert(legalSourceSnapshots)
        .values({
          publicId: randomUUID(),
          legalActId: act.id,
          ...snapshot,
          status: "pending_review",
          lastSeenAt: snapshot.fetchedAt,
        })
        .onConflictDoUpdate({
          target: [legalSourceSnapshots.legalActId, legalSourceSnapshots.checksumSha256],
          set: { lastSeenAt: snapshot.fetchedAt, httpStatus: snapshot.httpStatus },
        })
        .returning({
          id: legalSourceSnapshots.id,
          publicId: legalSourceSnapshots.publicId,
          status: legalSourceSnapshots.status,
        });

      await db.insert(auditLogs).values({
        action: "monitor.legal_source.checked",
        entityType: "legal_source_snapshot",
        entityId: saved.publicId,
        metadata: {
          legalActSlug: act.slug,
          checksum: snapshot.checksumSha256,
          status: saved.status,
          lexmlUrn: registered.lexmlUrn,
          legalCatalogStatus: catalogResult.status,
          legalCatalogProvider:
            catalogResult.status === "verified" ? catalogResult.metadata.provider : null,
        },
      });
      checked += 1;

      if (saved.status !== "approved") {
        corpusDeferred += 1;
      } else {
        try {
          const captured = await fetchOfficialConsolidatedLegalText(registered.monitorUrl);
          const [inserted] = await db
            .insert(legalTextSnapshots)
            .values({
              publicId: randomUUID(),
              legalActId: act.id,
              monitorSnapshotId: saved.id,
              ...captured,
              status: "pending_review",
              lastSeenAt: captured.fetchedAt,
            })
            .onConflictDoNothing({
              target: [legalTextSnapshots.legalActId, legalTextSnapshots.checksumSha256],
            })
            .returning({ publicId: legalTextSnapshots.publicId });

          if (inserted) {
            corpusCaptured += 1;
            await db.insert(auditLogs).values({
              action: "automation.legal_text.captured",
              entityType: "legal_text_snapshot",
              entityId: inserted.publicId,
              metadata: {
                legalActSlug: act.slug,
                checksum: captured.checksumSha256,
                articleCount: captured.articleCount,
                parserVersion: captured.parserVersion,
                status: "pending_review",
              },
            });
          } else {
            corpusUnchanged += 1;
            await db
              .update(legalTextSnapshots)
              .set({ lastSeenAt: captured.fetchedAt, updatedAt: captured.fetchedAt })
              .where(
                and(
                  eq(legalTextSnapshots.legalActId, act.id),
                  eq(legalTextSnapshots.checksumSha256, captured.checksumSha256),
                ),
              );
          }
        } catch (error) {
          corpusWarnings += 1;
          console.warn(`[corpus:${act.slug}]`, safeError(error));
        }
      }
    } catch (error) {
      failed += 1;
      console.error(`[lei:${act.slug}]`, safeError(error));
    }
    await pause();
  }

  return {
    checked,
    failed,
    catalogUnavailable,
    corpus: {
      captured: corpusCaptured,
      unchanged: corpusUnchanged,
      deferred: corpusDeferred,
      warnings: corpusWarnings,
    },
  };
}

async function checkExamPortals() {
  const portals = await db
    .select({ id: examSourcePortals.id, officialUrl: examSourcePortals.officialUrl, bankSlug: quizBanks.slug })
    .from(examSourcePortals)
    .innerJoin(quizBanks, eq(examSourcePortals.quizBankId, quizBanks.id))
    .where(eq(examSourcePortals.isActive, true));
  let checked = 0;
  let failed = 0;
  let policyBlocked = 0;

  for (const portal of portals) {
    try {
      const policy=discoveryPortalPolicy(portal.bankSlug,portal.officialUrl);
      if(policy.blocked) {
        policyBlocked++;
        await db.update(examSourcePortals).set({lastHttpStatus:null,lastError:policy.blocked,
          lastCheckedAt:new Date(),updatedAt:new Date()}).where(eq(examSourcePortals.id,portal.id));
        continue;
      }
      const result = await verifyOfficialExamUrl(portal.bankSlug, policy.urls[0]);
      await db
        .update(examSourcePortals)
        .set({
          lastHttpStatus: result.httpStatus,
          lastPageTitle: result.pageTitle,
          lastFinalUrl: result.finalUrl,
          lastError: null,
          lastCheckedAt: result.checkedAt,
          updatedAt: result.checkedAt,
        })
        .where(eq(examSourcePortals.id, portal.id));
      checked += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro desconhecido";
      await db
        .update(examSourcePortals)
        .set({ lastError: message, lastCheckedAt: new Date(), updatedAt: new Date() })
        .where(eq(examSourcePortals.id, portal.id));
      failed += 1;
      console.error(`[banca:${portal.bankSlug}]`, message);
    }
    await pause();
  }

  return { checked, failed, policyBlocked };
}

async function main() {
  try {
    const [laws, portals] = await Promise.all([checkLaws(), checkExamPortals()]);
    const summary = { completedAt: new Date().toISOString(), laws, portals };
    await db.insert(auditLogs).values({action:"monitor.legal.completed",entityType:"legal_monitor",metadata:summary});
    console.log(JSON.stringify(summary));
    if (officialSourceMonitorHasHardFailures(laws, portals)) process.exitCode = 1;
  } finally {
    await client.end();
  }
}

void main().catch((error: unknown) => {
  console.error("Falha no monitor de fontes oficiais.", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
