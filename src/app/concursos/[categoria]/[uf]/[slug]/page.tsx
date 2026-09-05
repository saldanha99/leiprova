import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";

import { PublicGuideShell } from "@/components/content/public-guide-shell";
import { ContestLanding } from "@/components/contests/contest-landing";
import { PlannedContestLanding } from "@/components/contests/planned-contest-landing";
import {
  catalogContestPath,
  getCatalogContest,
  contestTitle,
} from "@/lib/commerce/catalog";
import { isCommerceOpen, isContactEnabled } from "@/lib/launch";
import { JsonLd } from "@/components/seo/json-ld";
import {
  getReviewedContestOpportunity,
  listReviewedContestOpportunities,
} from "@/lib/db/contest-opportunities";
import { listReleasedContestProducts } from "@/lib/commerce/store";
import { isDatabaseConfigured } from "@/lib/db/client";
import { getOpportunityJurisdictionBySlug } from "@/lib/opportunities/jurisdictions";
import { WEBSITE_ID, absoluteUrl } from "@/lib/seo";

type ContestOpportunityPageProps = {
  params: Promise<{ categoria: string; uf: string; slug: string }>;
};

const getPageOpportunity = cache(
  async (
    categorySlug: string,
    jurisdictionSlug: string,
    opportunitySlug: string,
  ) => {
    const jurisdiction = getOpportunityJurisdictionBySlug(jurisdictionSlug);
    if (!jurisdiction) return null;
    if (!isDatabaseConfigured()) return null;

    const opportunity = await getReviewedContestOpportunity({
      categorySlug,
      jurisdictionCode: jurisdiction.code,
      opportunitySlug,
    });

    const released = await listReleasedContestProducts();
    if (opportunity) {
      const product = released.find(
        (item) => item.opportunityPublicId === opportunity.publicId,
      );
      return { opportunity, jurisdiction, productSlug: product?.slug };
    }
    const planned = getCatalogContest(opportunitySlug);
    if (
      !planned ||
      catalogContestPath(planned) !==
        `/concursos/${categorySlug}/${jurisdictionSlug}/${opportunitySlug}`
    )
      return null;
    const product = released.find((item) => item.slug === opportunitySlug);
    if (!product) return null;
    const linked = (
      await listReviewedContestOpportunities({ categorySlug })
    ).find((item) => item.publicId === product.opportunityPublicId);
    return linked
      ? { opportunity: linked, jurisdiction, productSlug: product.slug }
      : null;
  },
);

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: ContestOpportunityPageProps): Promise<Metadata> {
  const { categoria, uf, slug } = await params;
  const result = await getPageOpportunity(categoria, uf, slug);

  if (!result) {
    const planned = getCatalogContest(slug);
    if (
      planned &&
      catalogContestPath(planned) === `/concursos/${categoria}/${uf}/${slug}`
    )
      return {
        title: `${contestTitle(planned)} — preparação de lei seca`,
        description:
          "Conheça a proposta de estudo desta edição. Produto em preparação editorial, ainda sem venda.",
        alternates: { canonical: catalogContestPath(planned) },
        robots: { index: false, follow: true },
      };
    return {
      title: "Oportunidade não encontrada",
      robots: { index: false, follow: false },
    };
  }

  const product = result.productSlug
    ? getCatalogContest(result.productSlug)
    : null;
  const path = product
    ? catalogContestPath(product)
    : `/concursos/${categoria}/${uf}/${slug}`;
  return {
    title: `${result.opportunity.title} — lei seca, método e planos`,
    description: result.opportunity.summary,
    alternates: { canonical: path },
    robots: { index: true, follow: true },
    openGraph: {
      type: "article",
      url: path,
      title: result.opportunity.title,
      description: result.opportunity.summary,
      siteName: "Editalume",
      locale: "pt_BR",
      images: [
        {
          url: "/assets/contests/editorial-study-v2.webp",
          alt: "Editalume — uma rotina de leitura, prática e revisão de lei seca",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: result.opportunity.title,
      description: result.opportunity.summary,
      images: ["/assets/contests/editorial-study-v2.webp"],
    },
  };
}

export default async function ContestOpportunityPage({
  params,
}: ContestOpportunityPageProps) {
  const { categoria, uf, slug } = await params;
  const result = await getPageOpportunity(categoria, uf, slug);
  if (!result) {
    const planned = getCatalogContest(slug);
    if (
      !planned ||
      catalogContestPath(planned) !== `/concursos/${categoria}/${uf}/${slug}`
    )
      notFound();
    return (
      <PublicGuideShell mobileActionBar>
        <PlannedContestLanding
          contest={planned}
          commerceOpen={isCommerceOpen()}
          contactOpen={isContactEnabled()}
        />
      </PublicGuideShell>
    );
  }

  const { opportunity, jurisdiction } = result;
  const product = result.productSlug
    ? getCatalogContest(result.productSlug)
    : null;
  const path = product
    ? catalogContestPath(product)
    : `/concursos/${categoria}/${uf}/${slug}`;

  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${absoluteUrl(path)}#webpage`,
        url: absoluteUrl(path),
        name: opportunity.title,
        description: opportunity.summary,
        inLanguage: "pt-BR",
        isPartOf: { "@id": WEBSITE_ID },
        datePublished: opportunity.publishedAt?.toISOString(),
        dateModified: opportunity.updatedAt.toISOString(),
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${absoluteUrl(path)}#breadcrumb`,
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Início",
            item: absoluteUrl(),
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "Concursos",
            item: absoluteUrl("/concursos"),
          },
          {
            "@type": "ListItem",
            position: 3,
            name: opportunity.categoryName,
            item: absoluteUrl(`/concursos#${opportunity.categorySlug}`),
          },
          { "@type": "ListItem", position: 4, name: opportunity.title },
        ],
      },
    ],
  };

  return (
    <PublicGuideShell mobileActionBar>
      <JsonLd data={structuredData} />
      <ContestLanding
        opportunity={opportunity}
        jurisdictionName={jurisdiction.name}
        commerceOpen={isCommerceOpen()}
        contactOpen={isContactEnabled()}
        productSlug={result.productSlug}
        productAvailable={Boolean(result.productSlug)}
      />
    </PublicGuideShell>
  );
}
