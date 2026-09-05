import "server-only";
import { cache } from "react";
import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import {
  contestStoreProducts,
  contestOpportunities,
  questionOpportunities,
  questions,
} from "@/lib/db/schema";
import { listReviewedContestOpportunities } from "@/lib/db/contest-opportunities";
import { getCatalogContest } from "./catalog";

export const listReleasedContestProducts = cache(
  async function listReleasedContestProducts() {
    // Página revisada + liberação comercial explícita + questões revisadas.
    const publicOpportunities = await listReviewedContestOpportunities();
    const publicById = new Map(
      publicOpportunities.map((item) => [item.publicId, item]),
    );
    const rows = await getDb()
      .select({
        product: contestStoreProducts,
        opportunityPublicId: contestOpportunities.publicId,
      })
      .from(contestStoreProducts)
      .innerJoin(
        contestOpportunities,
        eq(contestStoreProducts.opportunityId, contestOpportunities.id),
      )
      .where(
        and(
          eq(contestStoreProducts.status, "released"),
          sql`exists (
      select 1 from ${questionOpportunities}
      join ${questions} on ${questions.id} = ${questionOpportunities.questionId}
      where ${questionOpportunities.opportunityId} = ${contestStoreProducts.opportunityId}
      and ${questions.editorialStatus} = 'reviewed'
    )`,
        ),
      );
    return rows
      .filter((row) => {
        const opportunity = publicById.get(row.opportunityPublicId);
        const catalog = getCatalogContest(row.product.slug);
        return (
          opportunity &&
          catalog &&
          opportunity.categorySlug === catalog.categorySlug
        );
      })
      .map((row) => ({
        ...row.product,
        opportunityPublicId: row.opportunityPublicId,
      }));
  },
);
