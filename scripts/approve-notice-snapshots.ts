import { and, eq, inArray, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "../src/lib/db/schema";
import {
  auditLogs,
  contestOpportunities,
  opportunityDocumentSnapshots,
  opportunitySourceDocuments,
  users,
} from "../src/lib/db/schema";
import {
  parseOpportunityApprovalReviewerIdentity,
  requireOpportunityApprovalDatabaseUrl,
} from "../src/lib/opportunities/approval-command";

// Aprova o PDF oficial do edital capturado pelo worker, fonte do programa, sob
// decisão registrada do proprietário — o mesmo registro de "aprovação explícita
// do proprietário" do painel /admin/motor-editais. Outra captura do mesmo edital
// pode ser marcada como substituída pela aprovada. Requisitos, questões e
// vínculos ao produto continuam com a revisão própria de cada um.
// Uso: tsx scripts/approve-notice-snapshots.ts [--apply] aprovar=<id> ... substituir=<id> ...
// Sem --apply, tudo roda numa transação desfeita ao final (prévia).

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

export type NoticeDecision = Readonly<{
  action: "approve" | "supersede";
  snapshotPublicId: string;
}>;

export function parseNoticeApprovalArgs(argv: readonly string[]) {
  const args = argv.filter((arg) => arg !== "--");
  const apply = args.includes("--apply");
  const decisions = args
    .filter((arg) => arg !== "--apply")
    .map((arg): NoticeDecision => {
      const [verb, snapshotPublicId, extra] = arg.split("=");
      const action = verb === "aprovar" ? "approve" : verb === "substituir" ? "supersede" : null;
      if (!action || extra !== undefined || !UUID.test(snapshotPublicId ?? "")) {
        throw new Error(`Decisão inválida: ${arg}. Use aprovar=<id> ou substituir=<id>.`);
      }
      return { action, snapshotPublicId };
    });
  if (!decisions.some((decision) => decision.action === "approve")) {
    throw new Error("Informe ao menos um aprovar=<id>.");
  }
  if (new Set(decisions.map((decision) => decision.snapshotPublicId)).size !== decisions.length) {
    throw new Error("A mesma captura aparece mais de uma vez no comando.");
  }
  return { apply, decisions };
}

class PreviewRollback extends Error {}

async function main() {
  const { apply, decisions } = parseNoticeApprovalArgs(process.argv.slice(2));
  const reviewer = parseOpportunityApprovalReviewerIdentity({
    ADMIN_EMAILS: process.env.ADMIN_EMAILS,
    OPPORTUNITY_APPROVAL_REFERENCE: process.env.NOTICE_APPROVAL_REFERENCE,
  });
  const client = postgres(
    requireOpportunityApprovalDatabaseUrl({ MIGRATION_DATABASE_URL: process.env.MIGRATION_DATABASE_URL }),
    { max: 1, prepare: false },
  );
  const db = drizzle(client, { schema });
  try {
    let results: Record<string, unknown>[];
    try {
      results = await db.transaction(async (transaction) => {
        const now = new Date();
        const operators = await transaction
          .select({ id: users.id, role: users.role })
          .from(users)
          .where(reviewer.email ? sql`lower(${users.email}) = ${reviewer.email}` : eq(users.role, "admin"))
          .limit(2);
        if (operators.length !== 1 || operators[0].role !== "admin") {
          throw new Error("A aprovação exige exatamente um administrador identificado.");
        }
        const operatorId = operators[0].id;

        const rows = await transaction
          .select({
            id: opportunityDocumentSnapshots.id,
            publicId: opportunityDocumentSnapshots.publicId,
            status: opportunityDocumentSnapshots.status,
            sourceHost: opportunityDocumentSnapshots.sourceHost,
            fileName: opportunityDocumentSnapshots.fileName,
            pageCount: opportunityDocumentSnapshots.pageCount,
            authorizationScope: opportunityDocumentSnapshots.authorizationScope,
            sourceStatus: opportunitySourceDocuments.status,
            opportunityId: contestOpportunities.id,
            opportunitySlug: contestOpportunities.slug,
            opportunityStatus: contestOpportunities.editorialStatus,
          })
          .from(opportunityDocumentSnapshots)
          .innerJoin(
            opportunitySourceDocuments,
            eq(opportunityDocumentSnapshots.sourceDocumentId, opportunitySourceDocuments.id),
          )
          .innerJoin(contestOpportunities, eq(opportunitySourceDocuments.opportunityId, contestOpportunities.id))
          .where(inArray(opportunityDocumentSnapshots.publicId, decisions.map((decision) => decision.snapshotPublicId)))
          .for("update", { of: opportunityDocumentSnapshots });
        const byPublicId = new Map(rows.map((row) => [row.publicId, row]));
        for (const decision of decisions) {
          const row = byPublicId.get(decision.snapshotPublicId);
          if (!row) throw new Error(`Captura inexistente: ${decision.snapshotPublicId}.`);
          if (row.status !== "pending_review") throw new Error(`Captura já decidida: ${row.publicId}.`);
          if (row.sourceStatus !== "approved" || row.opportunityStatus !== "reviewed") {
            throw new Error(`Fonte ou edital fora da revisão para ${row.publicId}.`);
          }
        }
        // Só substitui captura de um edital que recebe uma versão aprovada aqui.
        const approvedByOpportunity = new Map(
          decisions
            .filter((decision) => decision.action === "approve")
            .map((decision) => {
              const row = byPublicId.get(decision.snapshotPublicId)!;
              return [row.opportunityId, row.publicId] as const;
            }),
        );

        const summary: Record<string, unknown>[] = [];
        for (const decision of decisions) {
          const row = byPublicId.get(decision.snapshotPublicId)!;
          const approved = decision.action === "approve";
          const replacement = approvedByOpportunity.get(row.opportunityId);
          if (!approved && !replacement) {
            throw new Error(`Nenhuma versão aprovada substitui ${row.publicId} neste comando.`);
          }
          const notes = approved
            ? `Aprovado sob decisão do proprietário (${reviewer.approvalReference}): PDF oficial do edital capturado na origem (${row.sourceHost}). Requisitos, questões e vínculos seguem em revisão.`
            : `Substituído pela versão consolidada aprovada (${replacement}) sob decisão do proprietário (${reviewer.approvalReference}).`;
          const updated = await transaction
            .update(opportunityDocumentSnapshots)
            .set({
              status: approved ? "approved" : "superseded",
              approvalBasis: "owner_override",
              authorizedByUserId: operatorId,
              reviewedByUserId: operatorId,
              reviewedAt: now,
              reviewNotes: notes,
              updatedAt: now,
            })
            .where(and(
              eq(opportunityDocumentSnapshots.id, row.id),
              eq(opportunityDocumentSnapshots.status, "pending_review"),
            ))
            .returning({ id: opportunityDocumentSnapshots.id });
          if (!updated[0]) throw new Error(`A captura ${row.publicId} já foi decidida.`);
          await transaction.insert(auditLogs).values({
            actorUserId: operatorId,
            action: approved ? "editorial.notice_document.approved" : "editorial.notice_document.superseded",
            entityType: "opportunity_document_snapshot",
            entityId: row.publicId,
            metadata: {
              notes,
              approvalBasis: "owner_override",
              authorizationScope: row.authorizationScope,
              approvalReference: reviewer.approvalReference,
              executionSource: "server_cli",
              opportunitySlug: row.opportunitySlug,
            },
          });
          summary.push({
            decision: approved ? "approved" : "superseded",
            snapshotPublicId: row.publicId,
            opportunitySlug: row.opportunitySlug,
            fileName: row.fileName,
            pageCount: row.pageCount,
          });
        }
        if (!apply) throw new PreviewRollback(JSON.stringify(summary));
        return summary;
      }, { isolationLevel: "serializable" });
    } catch (error) {
      if (!(error instanceof PreviewRollback)) throw error;
      results = JSON.parse(error.message);
    }
    console.log(JSON.stringify({
      mode: apply ? "applied" : "preview",
      approvalReference: reviewer.approvalReference,
      requirementsApproved: 0,
      questionsApproved: 0,
      productsReleased: 0,
      results,
    }, null, 2));
  } finally {
    await client.end();
  }
}

// Só executa como comando; os testes importam `parseNoticeApprovalArgs` sem banco.
if (process.argv[1]?.endsWith("approve-notice-snapshots.ts")) {
  void main().catch((error: unknown) => {
    console.error("Falha na aprovação dos editais.", error instanceof Error ? error.message : "Erro desconhecido.");
    process.exitCode = 1;
  });
}
