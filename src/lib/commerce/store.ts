import "server-only";
import { cache } from "react";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import {
  contestStoreProducts,
  contestOpportunities,
} from "@/lib/db/schema";
import { listReviewedContestOpportunities } from "@/lib/db/contest-opportunities";
import { getCatalogContest } from "./catalog";
import { minimumCourseContentSatisfied } from "./minimum-course-content";

export const listReleasedContestProducts = cache(
  async function listReleasedContestProducts() {
    // Página revisada + liberação explícita + pelo menos 68 questões válidas por produto.
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
          minimumCourseContentSatisfied(contestStoreProducts.slug, contestStoreProducts.opportunityId),
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
