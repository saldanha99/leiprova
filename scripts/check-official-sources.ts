import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import {
  auditLogs,
  examSourcePortals,
  legalActs,
  legalSourceSnapshots,
  quizBanks,
} from "../src/lib/db/schema";
import { verifyOfficialExamUrl, fetchOfficialLegalDocument } from "../src/lib/official-sources/fetch";
import { getOfficialLegalSource } from "../src/lib/official-sources/legal-registry";

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
    .select({ id: legalActs.id, slug: legalActs.slug, officialUrl: legalActs.officialUrl })
    .from(legalActs)
    .where(eq(legalActs.isActive, true));
  let checked = 0;
  let failed = 0;

  for (const act of acts) {
    const registered = getOfficialLegalSource(act.slug);
    if (!registered || registered.officialUrl !== act.officialUrl) continue;

    try {
      const snapshot = await fetchOfficialLegalDocument(registered.monitorUrl);
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
        .returning({ publicId: legalSourceSnapshots.publicId, status: legalSourceSnapshots.status });

      await db.insert(auditLogs).values({
        action: "monitor.legal_source.checked",
        entityType: "legal_source_snapshot",
        entityId: saved.publicId,
        metadata: { legalActSlug: act.slug, checksum: snapshot.checksumSha256, status: saved.status },
      });
      checked += 1;
    } catch (error) {
      failed += 1;
      console.error(`[lei:${act.slug}]`, safeError(error));
    }
    await pause();
  }

  return { checked, failed };
}

async function checkExamPortals() {
  const portals = await db
    .select({ id: examSourcePortals.id, officialUrl: examSourcePortals.officialUrl, bankSlug: quizBanks.slug })
    .from(examSourcePortals)
    .innerJoin(quizBanks, eq(examSourcePortals.quizBankId, quizBanks.id))
    .where(eq(examSourcePortals.isActive, true));
  let checked = 0;
  let failed = 0;

  for (const portal of portals) {
    try {
      const result = await verifyOfficialExamUrl(portal.bankSlug, portal.officialUrl);
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

  return { checked, failed };
}

async function main() {
  try {
    const [laws, portals] = await Promise.all([checkLaws(), checkExamPortals()]);
    console.log(JSON.stringify({ completedAt: new Date().toISOString(), laws, portals }));
    if (laws.checked + portals.checked === 0 && laws.failed + portals.failed > 0) process.exitCode = 1;
  } finally {
    await client.end();
  }
}

void main().catch((error: unknown) => {
  console.error("Falha no monitor de fontes oficiais.", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
