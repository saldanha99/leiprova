import { and, eq, inArray, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "../src/lib/db/schema";
import { auditLogs, questions, users } from "../src/lib/db/schema";
import {
  parseOpportunityApprovalReviewerIdentity,
  requireOpportunityApprovalDatabaseUrl,
} from "../src/lib/opportunities/approval-command";

// Suspende questões com erro encontrado na conferência posterior do Maestro
// (decisão de 11/10/2026: a linha automática aprova sem conferência humana e o
// Maestro confere depois). Questão suspensa sai do treino e deixa de contar nos
// produtos; se um produto cair abaixo de 68, novas vendas fecham sozinhas.
// Uso: tsx scripts/suspend-questions.ts [--apply] --reason="..." question=<uuid> ...
// Sem --apply, tudo roda numa transação desfeita ao final (prévia).

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;

export function parseSuspendArgs(argv: readonly string[]) {
  const args = argv.filter((arg) => arg !== "--");
  const apply = args.includes("--apply");
  let reason: string | undefined;
  const ids: string[] = [];
  for (const arg of args.filter((value) => value !== "--apply")) {
    const reasonMatch = /^--reason=([\s\S]+)$/u.exec(arg);
    if (reasonMatch) {
      reason = reasonMatch[1].trim().replace(/\s+/gu, " ");
      continue;
    }
    const [verb, id, extra] = arg.split("=");
    if (verb !== "question" || extra !== undefined || !UUID.test(id ?? "")) {
      throw new Error(`Argumento inválido: ${arg}. Use question=<uuid>.`);
    }
    ids.push(id);
  }
  if (!ids.length || ids.length > 250) throw new Error("Informe de 1 a 250 question=<uuid>.");
  if (new Set(ids).size !== ids.length) throw new Error("A mesma questão aparece mais de uma vez.");
  if (!reason || reason.length < 10 || reason.length > 1500) {
    throw new Error("O motivo (--reason) precisa ter de 10 a 1.500 caracteres.");
  }
  return { apply, reason, publicIds: ids };
}

class PreviewRollback extends Error {}

async function main() {
  const { apply, reason, publicIds } = parseSuspendArgs(process.argv.slice(2));
  const reviewer = parseOpportunityApprovalReviewerIdentity({
    ADMIN_EMAILS: process.env.ADMIN_EMAILS,
    OPPORTUNITY_APPROVAL_REFERENCE: process.env.SUSPENSION_REFERENCE,
  });
  const client = postgres(
    requireOpportunityApprovalDatabaseUrl({ MIGRATION_DATABASE_URL: process.env.MIGRATION_DATABASE_URL }),
    { max: 1, prepare: false },
  );
  const db = drizzle(client, { schema });
  let output: Record<string, unknown>;
  try {
    try {
      output = await db.transaction(async (transaction) => {
        const operators = await transaction
          .select({ id: users.id, role: users.role })
          .from(users)
          .where(reviewer.email ? sql`lower(${users.email}) = ${reviewer.email}` : eq(users.role, "admin"))
          .limit(2);
        if (operators.length !== 1 || operators[0].role !== "admin") {
          throw new Error("A suspensão exige exatamente um administrador identificado.");
        }
        const updated = await transaction
          .update(questions)
          .set({ editorialStatus: "suspended", reviewNotes: reason.slice(0, 1500), updatedAt: new Date() })
          .where(and(
            inArray(questions.publicId, publicIds),
            inArray(questions.editorialStatus, ["draft", "pending_review", "reviewed"]),
          ))
          .returning({ publicId: questions.publicId });
        const missing = publicIds.filter((id) => !updated.some((row) => row.publicId === id));
        if (updated.length) {
          await transaction.insert(auditLogs).values(updated.map((row) => ({
            actorUserId: operators[0].id,
            action: "editorial.question.suspended",
            entityType: "question",
            entityId: row.publicId,
            metadata: { reason, approvalReference: reviewer.approvalReference, executionSource: "server_cli" },
          })));
        }
        const summary = { suspended: updated.map((row) => row.publicId), notFoundOrAlreadySuspended: missing };
        if (!apply) throw new PreviewRollback(JSON.stringify(summary));
        return { mode: "applied", ...summary };
      }, { isolationLevel: "serializable" });
    } catch (error) {
      if (!(error instanceof PreviewRollback)) throw error;
      output = { mode: "preview", ...JSON.parse(error.message) };
    }
    console.log(JSON.stringify(output, null, 2));
  } finally {
    await client.end();
  }
}

// Só executa como comando; os testes importam `parseSuspendArgs` sem banco.
if (process.argv[1]?.endsWith("suspend-questions.ts")) {
  void main().catch((error: unknown) => {
    console.error("Falha na suspensão.", error instanceof Error ? error.message : "Erro desconhecido.");
    process.exitCode = 1;
  });
}
