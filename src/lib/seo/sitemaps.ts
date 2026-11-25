import "server-only";

import { catalogContestPath, getCatalogContest } from "@/lib/commerce/catalog";
import { listReleasedContestProducts } from "@/lib/commerce/store";
import { isDatabaseConfigured } from "@/lib/db/client";
import { listReviewedContestOpportunities } from "@/lib/db/contest-opportunities";
import { getOpportunityJurisdictionByCode } from "@/lib/opportunities/jurisdictions";
import { absoluteUrl } from "@/lib/seo";
import { listLawSnapshots } from "@/lib/seo/legal-data";
import { readPageStates } from "@/lib/seo/page-state-db";
import { resolveLastModified } from "@/lib/seo/page-state";
import { ARTICLES_PER_SITEMAP, type SitemapUrl, chunk, latest } from "@/lib/seo/sitemap-xml";
import { resolveWaveScope, saoPauloDate, scopeLaws, seoWave, wavePace } from "@/lib/seo/wave";

/** Static pages with the date of the last commit that changed each file. */
export const STATIC_PAGES = [
  { path: "/", lastModified: "2026-10-11" },
  { path: "/como-memorizar-lei-seca", lastModified: "2026-10-11" },
  { path: "/fontes-e-atualizacao", lastModified: "2026-10-12" },
  { path: "/concursos", lastModified: "2026-10-11" },
  { path: "/concursos/calendario", lastModified: "2026-10-11" },
  { path: "/metodologia", lastModified: "2026-10-12" },
  { path: "/demo", lastModified: "2026-10-11" },
  { path: "/termos", lastModified: "2026-10-12" },
  { path: "/privacidade", lastModified: "2026-10-11" },
  { path: "/reembolso", lastModified: "2026-10-12" },
] as const;

/** Commit date of src/app/leis/page.tsx when the hub was created. */
const LAWS_HUB_DATE = "2026-11-21";

const date = (value: string) => new Date(`${value}T00:00:00-03:00`);

export type SitemapSegment = "paginas" | "concursos" | "leis" | `artigos-${number}`;

export async function staticEntries(): Promise<SitemapUrl[]> {
  const pages: SitemapUrl[] = STATIC_PAGES.map((page) => ({ url: absoluteUrl(page.path), lastModified: date(page.lastModified) }));
  if (seoWave() !== "off") pages.push({ url: absoluteUrl("/leis"), lastModified: date(LAWS_HUB_DATE) });
  return pages;
}

export async function contestEntries(): Promise<SitemapUrl[]> {
  if (!isDatabaseConfigured()) return [];
  const [opportunities, products] = await Promise.all([listReviewedContestOpportunities(), listReleasedContestProducts()]);
  const entries = opportunities.flatMap((opportunity) => {
    const jurisdiction = getOpportunityJurisdictionByCode(opportunity.jurisdictionCode);
    if (!jurisdiction) return [];
    const linked = products.filter((product) => product.opportunityPublicId === opportunity.publicId);
    if (linked.length) {
      return linked.flatMap((product) => {
        const contest = getCatalogContest(product.slug);
        return contest ? [{ url: absoluteUrl(catalogContestPath(contest)), lastModified: opportunity.updatedAt }] : [];
      });
    }
    return [
      {
        url: absoluteUrl(`/concursos/${opportunity.categorySlug}/${jurisdiction.slug}/${opportunity.slug}`),
        lastModified: opportunity.updatedAt,
      },
    ];
  });
  return [...new Map(entries.map((entry) => [entry.url, entry])).values()];
}

/** Gate-passing law and article pages that belong to the active wave. */
export async function legalEntries(): Promise<{ laws: SitemapUrl[]; articles: SitemapUrl[] }> {
  const wave = seoWave();
  if (wave === "off" || !isDatabaseConfigured()) return { laws: [], articles: [] };
  const snapshots = await listLawSnapshots();
  const states = await readPageStates();
  const scope = resolveWaveScope(scopeLaws(snapshots), wave, wavePace(), saoPauloDate(new Date()));
  const laws: SitemapUrl[] = [];
  const articles: SitemapUrl[] = [];
  for (const snapshot of snapshots) {
    if (snapshot.gate.status === "index" && scope.hasLaw(snapshot.path)) {
      laws.push({ url: absoluteUrl(snapshot.path), lastModified: resolveLastModified(states.get(snapshot.path), snapshot) });
    }
    for (const article of snapshot.articles) {
      if (article.gate.status !== "index" || !scope.hasArticle(article.path)) continue;
      articles.push({ url: absoluteUrl(article.path), lastModified: resolveLastModified(states.get(article.path), article) });
    }
  }
  return { laws, articles };
}

export async function sitemapSegments(): Promise<Map<SitemapSegment, SitemapUrl[]>> {
  const [pages, contests, legal] = await Promise.all([staticEntries(), contestEntries(), legalEntries()]);
  const segments = new Map<SitemapSegment, SitemapUrl[]>([
    ["paginas", pages],
    ["concursos", contests],
  ]);
  if (legal.laws.length) segments.set("leis", legal.laws);
  chunk(legal.articles, ARTICLES_PER_SITEMAP).forEach((part, index) => segments.set(`artigos-${index + 1}`, part));
  return segments;
}

export function segmentLastModified(entries: readonly SitemapUrl[]): Date {
  return latest(entries, date(STATIC_PAGES[0].lastModified));
}
