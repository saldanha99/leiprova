import type { MetadataRoute } from "next";

import { isDatabaseConfigured } from "@/lib/db/client";
import { listReviewedContestOpportunities } from "@/lib/db/contest-opportunities";
import { getOpportunityJurisdictionByCode } from "@/lib/opportunities/jurisdictions";
import { absoluteUrl } from "@/lib/seo";
import { listReleasedContestProducts } from "@/lib/commerce/store";
import { catalogContestPath, getCatalogContest } from "@/lib/commerce/catalog";

const PUBLIC_PAGES = [
  { path: "/", lastModified: "2026-08-17", changeFrequency: "weekly", priority: 1 },
  {
    path: "/como-memorizar-lei-seca",
    lastModified: "2026-08-17",
    changeFrequency: "monthly",
    priority: 0.9,
  },
  {
    path: "/fontes-e-atualizacao",
    lastModified: "2026-08-17",
    changeFrequency: "monthly",
    priority: 0.9,
  },
  {
    path: "/concursos",
    lastModified: "2026-09-01",
    changeFrequency: "weekly",
    priority: 0.9,
  },
  {
    path: "/metodologia",
    lastModified: "2026-09-01",
    changeFrequency: "monthly",
    priority: 0.8,
  },
  { path: "/demo", lastModified: "2026-08-17", changeFrequency: "monthly", priority: 0.8 },
  { path: "/termos", lastModified: "2026-08-16", changeFrequency: "yearly", priority: 0.2 },
  { path: "/privacidade", lastModified: "2026-08-16", changeFrequency: "yearly", priority: 0.2 },
  { path: "/reembolso", lastModified: "2026-08-16", changeFrequency: "yearly", priority: 0.2 },
] as const;

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries = PUBLIC_PAGES.map((page) => ({
    url: absoluteUrl(page.path),
    lastModified: new Date(`${page.lastModified}T00:00:00-03:00`),
    changeFrequency: page.changeFrequency,
    priority: page.priority,
  }));

  if (!isDatabaseConfigured()) return staticEntries;

  const [opportunities,products] = await Promise.all([listReviewedContestOpportunities(),listReleasedContestProducts()]);
  const opportunityEntries = opportunities.flatMap((opportunity) => {
    const jurisdiction = getOpportunityJurisdictionByCode(opportunity.jurisdictionCode);
    if (!jurisdiction) return [];
    const linkedProducts=products.filter(product=>product.opportunityPublicId===opportunity.publicId);
    if(linkedProducts.length)return linkedProducts.flatMap(product=>{
      const contest=getCatalogContest(product.slug);
      return contest?[{url:absoluteUrl(catalogContestPath(contest)),lastModified:opportunity.updatedAt,changeFrequency:"weekly" as const,priority:0.8}]:[];
    });

    return [
      {
        url: absoluteUrl(
          `/concursos/${opportunity.categorySlug}/${jurisdiction.slug}/${opportunity.slug}`,
        ),
        lastModified: opportunity.updatedAt,
        changeFrequency: "weekly" as const,
        priority: 0.8,
      },
    ];
  });

  return [...staticEntries, ...opportunityEntries];
}
