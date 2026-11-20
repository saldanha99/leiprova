import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../src/lib/db/schema";
import { auditLogs, users } from "../src/lib/db/schema";
import { isPreparationMode, preparationEligibilityBlocker, type PreparationEligibility } from "../src/lib/commerce/preparation-mode";
import { parseOpportunityApprovalReviewerIdentity, requireOpportunityApprovalDatabaseUrl } from "../src/lib/opportunities/approval-command";
import { saoPauloCalendarDate } from "../src/lib/opportunities/catalog-policy";

export function parsePreparationModeArgs(argv: readonly string[]) {
  const args = argv.filter((arg) => arg !== "--");
  const apply = args.includes("--apply");
  const values = new Map<string, string>();
  for (const arg of args.filter((value) => value !== "--apply")) {
    const match = /^--(product|mode|program-confirmation)=(.+)$/u.exec(arg);
    if (!match || values.has(match[1])) throw new Error("Argumentos inválidos ou repetidos.");
    values.set(match[1], match[2].trim());
  }
  const productSlug = values.get("product") ?? "";
  const mode = values.get("mode") ?? "";
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(productSlug) || !isPreparationMode(mode) || mode === "current_notice") {
    throw new Error("Use --product=<slug> e --mode=historical_training|pre_notice.");
  }
  // Declaração específica: autonomia operacional não presume conferência do programa.
  if (values.get("program-confirmation") !== "reviewed-official-baseline") {
    throw new Error("Confirme a revisão da edição e do programa oficiais com --program-confirmation=reviewed-official-baseline.");
  }
  return { apply, productSlug, mode };
}
/** Exceções nominais do proprietário para produto já liberado. Não afrouxam a regra geral:
 * valem só para o produto, o modo e a referência listados, e só sem compra registrada. */
export const RELEASED_MODE_CHANGE_AUTHORIZATIONS: Readonly<Record<string, { mode: "historical_training" | "pre_notice"; approvalReference: string }>> = {
  // Decisão do proprietário de 19/11/2026: PC-MA Delegado (prova objetiva em 01/11/2026) vira treino histórico.
  "pc-ma-delegado-2026": { mode: "historical_training", approvalReference: "owner-decision-2026-11-19:pc-ma-delegado-historical-training" },
};

/** Retorna o motivo de bloqueio para trocar o modo, ou null se a troca é permitida. */
export function releasedModeChangeBlocker(input: {
  productSlug: string; mode: string; status: string; approvalReference: string; purchaseCount: number;
}): string | null {
  if (input.status === "draft") return null;
  const authorization = RELEASED_MODE_CHANGE_AUTHORIZATIONS[input.productSlug];
  if (input.status !== "released" || !authorization || authorization.mode !== input.mode
    || authorization.approvalReference !== input.approvalReference) {
    return "Exige produto em rascunho ligado à edição oficial revisada; ofertas já vendidas não mudam de modo.";
  }
  if (input.purchaseCount !== 0) return "Produto liberado com compra registrada não muda de modo.";
  return null;
}
class PreviewRollback extends Error {}

async function main() {
  const { apply, productSlug, mode } = parsePreparationModeArgs(process.argv.slice(2));
  const reviewer = parseOpportunityApprovalReviewerIdentity({
    ADMIN_EMAILS: process.env.ADMIN_EMAILS,
    OPPORTUNITY_APPROVAL_REFERENCE: process.env.PREPARATION_MODE_REVIEW_REFERENCE,
  });
  const client = postgres(requireOpportunityApprovalDatabaseUrl({ MIGRATION_DATABASE_URL: process.env.MIGRATION_DATABASE_URL }), { max: 1, prepare: false });
  const db = drizzle(client, { schema });
  try {
    let result: Record<string, unknown>;
    try {
      result = await db.transaction(async (transaction) => {
        await transaction.execute(sql`set local statement_timeout = '30s'`);
        const operators = await transaction.select({ id: users.id, role: users.role }).from(users)
          .where(reviewer.email ? sql`lower(${users.email}) = ${reviewer.email}` : sql`${users.role} = 'admin'`).limit(2);
        if (operators.length !== 1 || operators[0].role !== "admin") throw new Error("A decisão exige um administrador identificado.");
        await transaction.execute(sql`select public.lock_product_binding_review_product(${productSlug})`);
        const [state] = await transaction.execute<PreparationEligibility & { status: string; editorialStatus: string; opportunityId: string; purchaseCount: number }>(sql`
          select product.status, (select count(*)::int from contest_purchases purchase where purchase.product_slug = product.slug) as "purchaseCount", product.opportunity_id::text as "opportunityId",
            opportunity.editorial_status as "editorialStatus", opportunity.updated_at as "opportunityUpdatedAt",
            opportunity.lifecycle_status as "lifecycleStatus", opportunity.status_as_of::text as "statusAsOf",
            opportunity.registration_ends_at::text as "registrationEndsAt", opportunity.exam_date::text as "examDate",
            opportunity.notice_published_at::text as "noticePublishedAt"
          from contest_store_products product join contest_opportunities opportunity on opportunity.id = product.opportunity_id
          where product.slug = ${productSlug}
        `);
        if (!state || state.editorialStatus !== "reviewed") {
          throw new Error("Exige produto em rascunho ligado à edição oficial revisada; ofertas já vendidas não mudam de modo.");
        }
        const statusBlocker = releasedModeChangeBlocker({ productSlug, mode, status: state.status,
          approvalReference: reviewer.approvalReference, purchaseCount: state.purchaseCount });
        if (statusBlocker) throw new Error(statusBlocker);
        const [program] = await transaction.execute<{ ready: boolean }>(sql`select exists (
          select 1 from opportunity_requirements requirement
          join opportunity_source_documents source on source.id = requirement.source_document_id
          where requirement.opportunity_id = ${state.opportunityId}::bigint
            and requirement.editorial_status = 'reviewed' and source.status = 'approved'
            and source.opportunity_id = requirement.opportunity_id
        ) as ready`);
        if (!program?.ready) throw new Error("Sem programa de referência oficial aprovado e requisitos revisados.");
        const blocker = preparationEligibilityBlocker({ ...state, preparationMode: mode,
          preparationReviewedAt: new Date(), preparationReviewedByUserId: operators[0].id,
          preparationApprovalReference: reviewer.approvalReference,
          preparationOpportunityUpdatedAt: state.opportunityUpdatedAt,
        }, saoPauloCalendarDate());
        if (blocker) throw new Error(blocker);
        await transaction.execute(sql`update contest_store_products product
          set preparation_mode = ${mode}, preparation_reviewed_at = now(), preparation_reviewed_by_user_id = ${operators[0].id},
            preparation_approval_reference = ${reviewer.approvalReference},
            preparation_opportunity_updated_at = opportunity.updated_at, updated_at = now()
          from contest_opportunities opportunity
          where product.slug = ${productSlug} and product.status = ${state.status} and opportunity.id = product.opportunity_id`);
        await transaction.insert(auditLogs).values({ actorUserId: operators[0].id, action: "commerce.preparation_mode.reviewed",
          entityType: "contest_store_product", entityId: productSlug, metadata: {
            preparationMode: mode, opportunityId: state.opportunityId, approvalReference: reviewer.approvalReference,
            programConfirmation: "reviewed-official-baseline", legalBasis: "current_legislation", executionSource: "server_cli",
            productReleased: false, salesFlagsChanged: false,
            releasedProductModeChange: state.status === "released", purchaseCount: state.purchaseCount,
          },
        });
        const summary = { productSlug, preparationMode: mode, opportunityId: state.opportunityId, productsReleased: 0 };
        if (!apply) throw new PreviewRollback(JSON.stringify(summary));
        return summary;
      }, { isolationLevel: "serializable" });
      result = { mode: "applied", ...result };
    } catch (error) {
      if (!(error instanceof PreviewRollback)) throw error;
      result = { mode: "preview", ...JSON.parse(error.message) };
    }
    console.log(JSON.stringify(result, null, 2));
  } finally { await client.end(); }
}
if (process.argv[1]?.endsWith("review-preparation-mode.ts")) {
  void main().catch((error: unknown) => {
    console.error("Falha ao revisar o modo da preparação.", error instanceof Error ? error.message : "Erro desconhecido.");
    process.exitCode = 1;
  });
}
