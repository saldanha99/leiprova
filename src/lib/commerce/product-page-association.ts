import { catalogContestPath, getCatalogContest } from "./catalog";

type ReleasedProductIdentity = Readonly<{
  slug: string;
  opportunityPublicId: string;
}>;

/** Uma rota não herda a oferta de outro cargo só por compartilhar o edital. */
export function findExactProductForOpportunityPage<T extends ReleasedProductIdentity>(
  products: readonly T[],
  input: Readonly<{
    productSlug: string;
    categorySlug: string;
    jurisdictionSlug: string;
    opportunityPublicId: string;
  }>,
) {
  const catalog = getCatalogContest(input.productSlug);
  if (!catalog || catalogContestPath(catalog) !==
      `/concursos/${input.categorySlug}/${input.jurisdictionSlug}/${input.productSlug}`) return undefined;
  return products.find((product) => product.slug === input.productSlug &&
    product.opportunityPublicId === input.opportunityPublicId);
}
