import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { releaseBlockers } from "./release-contest-product";
import { approvedProductQuestionCount } from "../src/lib/commerce/minimum-course-content";
import { approvedProductQuestionExists } from "../src/lib/commerce/product-binding-query";
import { productPreviousExamRequirementMet } from "../src/lib/commerce/previous-exam-content";
import { preparationProgramReviewSatisfied } from "../src/lib/commerce/preparation-mode-query";

// Read-only report for the owner's transport. No phone, credentials, webhook,
// publication or campaign action belongs in this command.
type Product = Parameters<typeof releaseBlockers>[1] & {
  slug: string; programReviewed: boolean;
};

async function main() {
  if (process.argv.length > 3 || ![undefined, "--json"].includes(process.argv[2])) {
    throw new Error("Use --json.");
  }
  if (!process.env.DATABASE_URL) throw new Error("Banco não configurado.");
  const client = postgres(process.env.DATABASE_URL, { max: 1, prepare: false, connect_timeout: 10 });
  try {
    const report = await drizzle(client).transaction(async db => {
      await db.execute(sql`set local statement_timeout='60000'`);
      const [identity] = await db.execute<{ name: string; today: string; checkedAt: string }>(sql`
        select current_database() name,
          (now() at time zone 'America/Sao_Paulo')::date::text today,
          now()::text as "checkedAt"`);
      if (identity.name !== "leiprova") throw new Error("Banco diferente do projeto.");
      const rows = await db.execute<Product>(sql`
        select product.slug,product.status,product.preparation_mode as "preparationMode",
          product.preparation_reviewed_at as "preparationReviewedAt",
          product.preparation_reviewed_by_user_id::text as "preparationReviewedByUserId",
          product.preparation_approval_reference as "preparationApprovalReference",
          product.preparation_opportunity_updated_at as "preparationOpportunityUpdatedAt",
          opportunity.updated_at as "opportunityUpdatedAt",
          opportunity.notice_published_at::text as "noticePublishedAt",
          product.stripe_mode as "stripeMode",product.stripe_product_id as "stripeProductId",
          product.stripe_price_monthly as "monthlyPrice",product.stripe_price_annual as "annualPrice",
          product.opportunity_id::text as "opportunityId",opportunity.editorial_status as "editorialStatus",
          opportunity.lifecycle_status as "lifecycleStatus",opportunity.status_as_of::text as "statusAsOf",
          opportunity.registration_ends_at::text as "registrationEndsAt",opportunity.exam_date::text as "examDate",
          category.slug as "categorySlug",
          ${approvedProductQuestionCount(sql`product.slug`, sql`product.opportunity_id`)} as "questionCount",
          ${productPreviousExamRequirementMet(sql`product.slug`, sql`product.opportunity_id`)} as "previousExamLinked",
          ${preparationProgramReviewSatisfied(sql`product.slug`)} as "programReviewed"
        from contest_store_products product
        left join contest_opportunities opportunity on opportunity.id=product.opportunity_id
        left join contest_categories category on category.id=opportunity.category_id
        where product.status in ('draft','released') order by product.slug`);
      const products = rows.map(row => {
        const blockers = releaseBlockers(row.slug, { ...row, status: "draft" }, identity.today);
        if (!row.programReviewed) blockers.push("programa sem revisão atual");
        return { slug: row.slug, status: row.status, validQuestions: row.questionCount,
          editoriallyReady: blockers.length === 0, blockers };
      });
      const readySlugs = products.filter(p => p.status === "released" && p.editoriallyReady).map(p => p.slug);
      // One question counts once across products and requirements. Reapproval of
      // an old binding does not turn it into a newly published question today.
      const [daily] = await db.execute<{ newValidPublishedToday: number }>(sql`
        with first_publication as (
          select binding.question_id,min(greatest(audit.created_at,product.released_at)) first_at
          from audit_logs audit join contest_product_question_bindings binding
            on audit.entity_id=binding.id::text
          join contest_store_products product on product.slug=binding.product_slug
          where audit.action='editorial.product_binding.approved'
            and product.released_at is not null
          group by binding.question_id
        )
        select count(distinct binding.question_id)::int as "newValidPublishedToday"
        from first_publication first join contest_product_question_bindings binding on binding.question_id=first.question_id
        where first.first_at >= (date_trunc('day',now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo')
          and first.first_at <= now()
          and ${readySlugs.length ? sql`binding.product_slug in (${sql.join(readySlugs.map(slug => sql`${slug}`), sql`,`)})` : sql`false`}
          and ${approvedProductQuestionExists(sql`binding.product_slug`,sql`binding.question_id`,sql`binding.opportunity_id`,sql`binding.id`)}
      `);
      const queue = await db.execute<{ kind: string; status: string; count: number }>(sql`
        select kind,status,count(*)::int count from editorial_agent_work
        where status <> 'superseded' group by kind,status order by kind,status`);
      return { schemaVersion: 1, checkedAt: identity.checkedAt, calendarDate: identity.today,
        timezone: "America/Sao_Paulo", targetPerDay: 1000, targetIsCapacityGoal: true,
        newValidPublishedToday: daily.newValidPublishedToday,
        remainingToDailyTarget: Math.max(0,1000-daily.newValidPublishedToday),
        releasedEditoriallyReady: readySlugs.length, totalProducts: products.length,
        checkoutVerified: false,
        note: "Prontidão editorial não atesta checkout/pagamento; verificar oferta pública antes de anunciar. Meta não é promessa de entrega.",
        products, queue };
    }, { isolationLevel: "repeatable read", accessMode: "read only" });
    console.log(JSON.stringify(report, null, 2));
  } finally { await client.end(); }
}

void main().catch(() => {
  console.error("Relatório não concluído. Confira destino e acesso de leitura; nenhum segredo foi registrado.");
  process.exitCode = 1;
});
