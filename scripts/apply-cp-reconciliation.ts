import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import * as schema from "../src/lib/db/schema";
import { fetchCamaraCpCorrectionEvidence } from "../src/lib/official-sources/camara-cp-correction-parser";
import { CP_CUT_REFERENCE } from "../src/lib/official-sources/cp-coordinated-cut";
import { parseOpportunityApprovalReviewerIdentity } from "../src/lib/opportunities/approval-command";
import { requireCpReconciliationPreviewDatabase } from "./preview-cp-reconciliation";
import { applyCpReconciliation } from "../src/lib/editorial/cp-reconciliation-apply";

/**
 * `fingerprint=<sha256 of a fresh preview> [--rehearse]`. Rehearse runs the whole apply
 * (locks, triggers, final checks) against the real database and always rolls back.
 */
export function parseCpReconciliationApplyArgs(args: readonly string[]) {
  const argv = args[0] === "--" ? args.slice(1) : [...args];
  const rehearse = argv.includes("--rehearse");
  const rest = argv.filter(arg => arg !== "--rehearse");
  if (rest.length !== 1 || argv.length !== rest.length + (rehearse ? 1 : 0) || !/^fingerprint=[a-f0-9]{64}$/u.test(rest[0])) {
    throw new Error("Use fingerprint=<sha256 da prévia> [--rehearse]; sem outros argumentos.");
  }
  return { fingerprint: rest[0].slice("fingerprint=".length), rehearse };
}

class RehearsalRollback extends Error {
  constructor(readonly result: unknown) { super("rehearsal rollback"); }
}

async function main() {
  const { fingerprint, rehearse } = parseCpReconciliationApplyArgs(process.argv.slice(2));
  const url = requireCpReconciliationPreviewDatabase(process.env.MIGRATION_DATABASE_URL);
  if (process.env.LEGAL_STANDING_REVIEW_REFERENCE !== CP_CUT_REFERENCE) throw new Error("Autorização permanente exata ausente.");
  const identity = parseOpportunityApprovalReviewerIdentity({ ADMIN_EMAILS: process.env.ADMIN_EMAILS, OPPORTUNITY_APPROVAL_REFERENCE: CP_CUT_REFERENCE });
  const fresh = await fetchCamaraCpCorrectionEvidence();
  const client = postgres(url, { max: 1, prepare: false, connect_timeout: 5, idle_timeout: 10 });
  const db = drizzle(client, { schema });
  try {
    const result = await db.transaction(async tx => {
      await tx.execute(sql`set local statement_timeout='30s'`);
      await tx.execute(sql`set local lock_timeout='5s'`);
      const admins = await tx.execute<{ id: number; role: string }>(
        sql`select id::int as id, role from users where ${identity.email ? sql`lower(email)=${identity.email}` : sql`role='admin'`} order by id limit 2 for share`
      );
      if (admins.length !== 1 || admins[0].role !== "admin") throw new Error("Administrador único não confirmado.");
      const applied = await applyCpReconciliation(tx, fresh, admins[0].id, fingerprint);
      if (rehearse) throw new RehearsalRollback(applied);
      return applied;
    }, { isolationLevel: "serializable" }).catch((error: unknown) => {
      if (error instanceof RehearsalRollback) return { rehearsal: true, rolledBack: true, wouldApply: error.result };
      throw error;
    });
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await client.end();
  }
}

if (process.argv[1]?.endsWith("apply-cp-reconciliation.ts")) {
  void main().catch((error: unknown) => {
    const databaseError = error instanceof Error && (error.name === "PostgresError" || "cause" in error);
    const message = error instanceof Error && !databaseError
      ? error.message.replace(/postgres(?:ql)?:\/\/\S+/giu, "[conexão removida]")
      : `Falha de banco: ${error instanceof Error ? error.message.replace(/postgres(?:ql)?:\/\/\S+/giu, "[conexão removida]") : "desconhecida"}`;
    console.error("Reconciliação CP bloqueada:", message);
    process.exitCode = 1;
  });
}
