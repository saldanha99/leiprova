import { catalogContestPath, getCatalogContest } from "./catalog";

type ReleasedProductIdentity = Readonly<{
  slug: string;
  opportunityPublicId: string;
}>;

/** Edital com um único produto liberado: a página do edital leva à página de
 * venda dele, em vez de exibir a oferta como "em preparação". Com dois ou mais
 * produtos (cargos diferentes no mesmo edital), nenhum é escolhido. */
export function singleReleasedProductPath<T extends ReleasedProductIdentity>(
  products: readonly T[],
  opportunityPublicId: string,
) {
  const linked = products.filter(
    (product) => product.opportunityPublicId === opportunityPublicId,
  );
  if (linked.length !== 1) return null;
  const catalog = getCatalogContest(linked[0].slug);
  return catalog ? catalogContestPath(catalog) : null;
}

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
