import { and, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "../src/lib/db/schema";
import {
  auditLogs,
  contestProductExamReferences,
  contestProductPreviousExamWaivers,
  contestStoreProducts,
  users,
} from "../src/lib/db/schema";
import {
  parseOpportunityApprovalReviewerIdentity,
  requireOpportunityApprovalDatabaseUrl,
} from "../src/lib/opportunities/approval-command";

// Registra a dispensa de prova anterior de um produto, por decisão do
// proprietário, quando o órgão não tem prova anterior em fonte oficial. O motivo
// aparece na página do concurso. Não libera o produto: as 68 questões revisadas e
// os demais requisitos da venda continuam exigidos.
// Uso: tsx scripts/waive-previous-exam.ts [--apply] --product=<slug> --reason="..."
// Sem --apply, tudo roda numa transação desfeita ao final (prévia).

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

export function parseWaiverArgs(argv: readonly string[]) {
  const args = argv.filter((arg) => arg !== "--");
  const apply = args.includes("--apply");
  let productSlug: string | undefined;
  let reason: string | undefined;
  for (const arg of args.filter((value) => value !== "--apply")) {
    const match = /^--(product|reason)=([\s\S]+)$/u.exec(arg);
    if (!match) throw new Error(`Argumento inválido: ${arg}.`);
    if (match[1] === "product") productSlug = match[2].trim();
    else reason = match[2].trim().replace(/\s+/gu, " ");
  }
  if (!productSlug || !SLUG.test(productSlug)) throw new Error("Use --product=<slug do produto>.");
  if (!reason || reason.length < 20 || reason.length > 1000) {
    throw new Error("O motivo (--reason) precisa ter de 20 a 1.000 caracteres; ele aparece para o aluno.");
  }
  return { apply, productSlug, reason };
}

class PreviewRollback extends Error {}

async function main() {
  const { apply, productSlug, reason } = parseWaiverArgs(process.argv.slice(2));
  const reviewer = parseOpportunityApprovalReviewerIdentity({
    ADMIN_EMAILS: process.env.ADMIN_EMAILS,
    OPPORTUNITY_APPROVAL_REFERENCE: process.env.PREVIOUS_EXAM_WAIVER_REFERENCE,
  });
  const client = postgres(
    requireOpportunityApprovalDatabaseUrl({ MIGRATION_DATABASE_URL: process.env.MIGRATION_DATABASE_URL }),
    { max: 1, prepare: false },
  );
  const db = drizzle(client, { schema });
  try {
    let result: Record<string, unknown>;
    try {
      result = await db.transaction(async (transaction) => {
        const operators = await transaction
          .select({ id: users.id, role: users.role })
          .from(users)
          .where(reviewer.email ? sql`lower(${users.email}) = ${reviewer.email}` : eq(users.role, "admin"))
          .limit(2);
        if (operators.length !== 1 || operators[0].role !== "admin") {
          throw new Error("A dispensa exige exatamente um administrador identificado.");
        }
        const [product] = await transaction
          .select({ slug: contestStoreProducts.slug, opportunityId: contestStoreProducts.opportunityId })
          .from(contestStoreProducts)
          .where(eq(contestStoreProducts.slug, productSlug))
          .for("update");
        if (!product?.opportunityId) throw new Error(`Produto inexistente ou sem edital oficial: ${productSlug}.`);
        const [approved] = await transaction
          .select({ id: contestProductExamReferences.id })
          .from(contestProductExamReferences)
          .where(and(
            eq(contestProductExamReferences.productSlug, productSlug),
            eq(contestProductExamReferences.status, "approved"),
          ))
          .limit(1);
        if (approved) throw new Error(`O produto ${productSlug} já tem prova anterior aprovada; a dispensa não se aplica.`);

        const inserted = await transaction
          .insert(contestProductPreviousExamWaivers)
          .values({
            productSlug,
            reason,
            approvalReference: reviewer.approvalReference,
            decidedByUserId: operators[0].id,
          })
          .onConflictDoNothing({ target: contestProductPreviousExamWaivers.productSlug })
          .returning({ productSlug: contestProductPreviousExamWaivers.productSlug });
        if (!inserted[0]) throw new Error(`O produto ${productSlug} já tem dispensa registrada.`);
        await transaction.insert(auditLogs).values({
          actorUserId: operators[0].id,
          action: "commerce.previous_exam.waived",
          entityType: "contest_store_product",
          entityId: productSlug,
          metadata: {
            reason,
            approvalReference: reviewer.approvalReference,
            executionSource: "server_cli",
            productReleased: false,
          },
        });
        const summary = { productSlug, reason, approvalReference: reviewer.approvalReference };
        if (!apply) throw new PreviewRollback(JSON.stringify(summary));
        return summary;
      }, { isolationLevel: "serializable" });
      result = { mode: "applied", ...result };
    } catch (error) {
      if (!(error instanceof PreviewRollback)) throw error;
      result = { mode: "preview", ...JSON.parse(error.message) };
    }
    console.log(JSON.stringify({ ...result, productsReleased: 0 }, null, 2));
  } finally {
    await client.end();
  }
}

// Só executa como comando; os testes importam `parseWaiverArgs` sem banco.
if (process.argv[1]?.endsWith("waive-previous-exam.ts")) {
  void main().catch((error: unknown) => {
    console.error("Falha ao registrar a dispensa.", error instanceof Error ? error.message : "Erro desconhecido.");
    process.exitCode = 1;
  });
}
