import "server-only";
import { cache } from "react";
import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import {
  contestStoreProducts,
  contestOpportunities,
} from "@/lib/db/schema";
import { listReviewedContestOpportunities } from "@/lib/db/contest-opportunities";
import { getCatalogContest } from "./catalog";
import { minimumCourseContentSatisfied } from "./minimum-course-content";
import { licensedPreviousExamContentSatisfied } from "./previous-exam-content";

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
          licensedPreviousExamContentSatisfied(
            contestStoreProducts.slug,
            contestStoreProducts.opportunityId,
          ),
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

type StoreQueryExecutor = Pick<ReturnType<typeof getDb>, "select">;

/** Revalidação pontual usada imediatamente antes de criar uma cobrança e antes
 * de conceder cada período pago. `coverageEndsAt` é o fim real do acesso, não a
 * data em que a consulta foi executada. */
export async function hasSellableContestProductCoverage(
  productSlug: string,
  opportunityId: number,
  coverageEndsAt: Date,
  executor: StoreQueryExecutor = getDb(),
) {
  const [row] = await executor
    .select({ slug: contestStoreProducts.slug })
    .from(contestStoreProducts)
    .where(
      and(
        eq(contestStoreProducts.slug, productSlug),
        eq(contestStoreProducts.opportunityId, opportunityId),
        eq(contestStoreProducts.status, "released"),
        sql`${contestStoreProducts.releasedAt} is not null`,
        sql`${contestStoreProducts.releasedByUserId} is not null`,
        minimumCourseContentSatisfied(
          contestStoreProducts.slug,
          contestStoreProducts.opportunityId,
        ),
        licensedPreviousExamContentSatisfied(
          contestStoreProducts.slug,
          contestStoreProducts.opportunityId,
          sql`${coverageEndsAt.toISOString()}::timestamptz`,
          true,
        ),
      ),
    )
    .limit(1);
  return Boolean(row);
}

export type MasterCatalogCoverageStatus = {
  releasedCount: number;
  readyCount: number;
};

/** O Master só pode ser contratado quando há ao menos um produto liberado e
 * todos os produtos que ele promete cobrem integralmente o período contratado. */
export async function getMasterCatalogCoverageStatus(
  coverageEndsAt: Date,
  executor: StoreQueryExecutor = getDb(),
): Promise<MasterCatalogCoverageStatus> {
  const [row] = await executor
    .select({
      releasedCount: sql<number>`count(*)::integer`.mapWith(Number),
      readyCount: sql<number>`count(*) filter (where
        ${contestStoreProducts.opportunityId} is not null
        and ${contestStoreProducts.releasedAt} is not null
        and ${contestStoreProducts.releasedByUserId} is not null
        and ${minimumCourseContentSatisfied(
          contestStoreProducts.slug,
          contestStoreProducts.opportunityId,
        )}
        and ${licensedPreviousExamContentSatisfied(
          contestStoreProducts.slug,
          contestStoreProducts.opportunityId,
          sql`${coverageEndsAt.toISOString()}::timestamptz`,
          true,
        )}
      )::integer`.mapWith(Number),
    })
    .from(contestStoreProducts)
    .where(eq(contestStoreProducts.status, "released"));

  return {
    releasedCount: row?.releasedCount ?? 0,
    readyCount: row?.readyCount ?? 0,
  };
}

export function isMasterCatalogCoverageReady(
  status: MasterCatalogCoverageStatus,
) {
  return status.releasedCount > 0 && status.readyCount === status.releasedCount;
}
