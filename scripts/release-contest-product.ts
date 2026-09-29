import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "../src/lib/db/schema";
import { auditLogs, users } from "../src/lib/db/schema";
import { getCatalogContest } from "../src/lib/commerce/catalog";
import {
  approvedProductQuestionCount,
  MINIMUM_COURSE_QUESTION_COUNT,
} from "../src/lib/commerce/minimum-course-content";
import { approvedProductPreviousExamReferenceExists } from "../src/lib/commerce/previous-exam-content";
import {
  parseOpportunityApprovalReviewerIdentity,
  requireOpportunityApprovalDatabaseUrl,
} from "../src/lib/opportunities/approval-command";
import {
  isOpportunityFreshForPublicCatalog,
  saoPauloCalendarDate,
} from "../src/lib/opportunities/catalog-policy";

// Liberação comercial de um produto por decisão auditada do proprietário.
// Uso: tsx scripts/release-contest-product.ts [--apply] produto ...
// Sem --apply, tudo roda numa transação desfeita ao final (prévia). Liberar não
// abre vendas: as chaves de cadastro e checkout continuam decidindo isso.

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

class PreviewRollback extends Error {}

type ProductState = {
  status: string;
  stripeMode: string;
  stripeProductId: string | null;
  monthlyPrice: string | null;
  annualPrice: string | null;
  opportunityId: string | null;
  editorialStatus: string | null;
  lifecycleStatus: string | null;
  statusAsOf: string | null;
  registrationEndsAt: string | null;
  examDate: string | null;
  categorySlug: string | null;
  questionCount: number;
  previousExamLinked: boolean;
};

function parseArgs(argv: readonly string[]) {
  const args = argv.filter((arg) => arg !== "--");
  const apply = args.includes("--apply");
  const slugs = args.filter((arg) => arg !== "--apply");
  if (!slugs.length || slugs.some((slug) => !SLUG.test(slug))) {
    throw new Error("Informe ao menos um produto válido.");
  }
  return { apply, slugs };
}

/** Cada motivo impede a liberação; lista vazia significa produto apto à venda. */
export function releaseBlockers(slug: string, state: ProductState, todayIso: string) {
  const blockers: string[] = [];
  if (state.status !== "draft") blockers.push(`status atual ${state.status}`);
  if (!state.opportunityId || state.editorialStatus !== "reviewed") {
    blockers.push("sem edital oficial revisado");
  } else if (
    !isOpportunityFreshForPublicCatalog(
      {
        lifecycleStatus: state.lifecycleStatus ?? "",
        statusAsOf: state.statusAsOf ?? "",
        registrationEndsAt: state.registrationEndsAt,
        examDate: state.examDate,
      },
      todayIso,
    )
  ) {
    blockers.push("edital fora do catálogo público (fase ou data vencida)");
  }
  if (getCatalogContest(slug)?.categorySlug !== state.categorySlug) {
    blockers.push("categoria do catálogo diferente da do edital");
  }
  if (state.questionCount < MINIMUM_COURSE_QUESTION_COUNT) {
    blockers.push(`${state.questionCount} de ${MINIMUM_COURSE_QUESTION_COUNT} questões aprovadas`);
  }
  if (!state.previousExamLinked) blockers.push("sem prova anterior oficial aprovada");
  if (
    state.stripeMode !== "live" ||
    !state.stripeProductId ||
    !state.monthlyPrice ||
    !state.annualPrice
  ) {
    blockers.push("produto e preços LIVE da Stripe incompletos");
  }
  return blockers;
}

async function main() {
  const { apply, slugs } = parseArgs(process.argv.slice(2));
  const reviewer = parseOpportunityApprovalReviewerIdentity({
    ADMIN_EMAILS: process.env.ADMIN_EMAILS,
    OPPORTUNITY_APPROVAL_REFERENCE: process.env.PRODUCT_RELEASE_REFERENCE?.trim(),
  });
  const client = postgres(
    requireOpportunityApprovalDatabaseUrl({ MIGRATION_DATABASE_URL: process.env.MIGRATION_DATABASE_URL }),
    { max: 1, prepare: false },
  );
  const db = drizzle(client, { schema });
  const results: Record<string, unknown>[] = [];
  try {
    for (const slug of slugs) {
      try {
        const result = await db.transaction(async (transaction) => {
          const todayIso = saoPauloCalendarDate();
          const operators = await transaction
            .select({ id: users.id, role: users.role })
            .from(users)
            .where(reviewer.email ? sql`lower(${users.email}) = ${reviewer.email}` : sql`${users.role} = 'admin'`)
            .limit(2);
          if (operators.length !== 1 || operators[0].role !== "admin") {
            throw new Error("A liberação exige exatamente um administrador identificado.");
          }
          await transaction.execute(sql`select public.lock_product_binding_review_product(${slug})`);
          const [state] = await transaction.execute<ProductState>(sql`
            select product.status,
              product.stripe_mode as "stripeMode",
              product.stripe_product_id as "stripeProductId",
              product.stripe_price_monthly as "monthlyPrice",
              product.stripe_price_annual as "annualPrice",
              product.opportunity_id::text as "opportunityId",
              opportunity.editorial_status as "editorialStatus",
              opportunity.lifecycle_status as "lifecycleStatus",
              opportunity.status_as_of::text as "statusAsOf",
              opportunity.registration_ends_at::text as "registrationEndsAt",
              opportunity.exam_date::text as "examDate",
              category.slug as "categorySlug",
              ${approvedProductQuestionCount(sql`product.slug`, sql`product.opportunity_id`)} as "questionCount",
              ${approvedProductPreviousExamReferenceExists(sql`product.slug`, sql`product.opportunity_id`)} as "previousExamLinked"
            from contest_store_products product
            left join contest_opportunities opportunity on opportunity.id = product.opportunity_id
            left join contest_categories category on category.id = opportunity.category_id
            where product.slug = ${slug}
          `);
          if (!state) throw new Error(`Produto inexistente: ${slug}.`);
          const blockers = releaseBlockers(slug, state, todayIso);
          if (blockers.length) {
            return { productSlug: slug, released: false, blockers };
          }

          const updated = await transaction.execute<{ slug: string }>(sql`
            update contest_store_products
            set status = 'released', released_at = now(),
              released_by_user_id = ${operators[0].id}, updated_at = now()
            where slug = ${slug} and status = 'draft'
            returning slug
          `);
          if (!updated.length) throw new Error(`O produto ${slug} mudou durante a liberação.`);
          await transaction.insert(auditLogs).values({
            actorUserId: operators[0].id,
            action: "commerce.product.released",
            entityType: "contest_store_product",
            entityId: slug,
            metadata: {
              approvalReference: reviewer.approvalReference,
              questionCount: state.questionCount,
              previousExam: "official_link",
              stripeMode: state.stripeMode,
              executionSource: "server_cli",
            },
          });
          const summary = { productSlug: slug, released: true, questionCount: state.questionCount };
          if (!apply) throw new PreviewRollback(JSON.stringify(summary));
          return summary;
        }, { isolationLevel: "serializable" });
        results.push({ mode: result.released ? "applied" : "blocked", ...result });
      } catch (error) {
        if (!(error instanceof PreviewRollback)) throw error;
        results.push({ mode: "preview", ...JSON.parse(error.message) });
      }
    }
    console.log(JSON.stringify({
      approvalReference: reviewer.approvalReference,
      salesFlagsChanged: false,
      results,
    }, null, 2));
  } finally {
    await client.end();
  }
}

// Só executa como comando; os testes importam `releaseBlockers` sem banco.
if (process.argv[1]?.endsWith("release-contest-product.ts")) {
  void main().catch((error: unknown) => {
    console.error("Falha na liberação do produto.", error instanceof Error ? error.message : "Erro desconhecido.");
    process.exitCode = 1;
  });
}
