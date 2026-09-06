import type Stripe from "stripe";

import { PLANS, type PlanDefinition } from "../plans";
import { CONTEST_ACCESS_OPTIONS, CONTEST_CATALOG } from "./catalog";

export const MASTER_STRIPE_PRODUCT_ID = "leiprova_master_v2";
export const MASTER_STRIPE_COMMERCE = "master_v2";

type MasterCatalogClient = Pick<Stripe, "products" | "prices">;

export function masterPriceLookupKey(
  plan: Pick<PlanDefinition, "slug" | "priceCents">,
) {
  return `leiprova_master_${plan.slug}_${plan.priceCents}_v2`;
}

export function stripeCatalogSyncPreview(mode: "test" | "live") {
  return {
    mode: "dry-run",
    stripeMode: mode,
    contests: CONTEST_CATALOG.length,
    contestPrices: CONTEST_CATALOG.length * CONTEST_ACCESS_OPTIONS.length,
    contestBilling: CONTEST_ACCESS_OPTIONS.map((option) => ({
      interval: option.interval,
      amountCents: option.amountCents,
    })),
    masterProducts: 1,
    masterPrices: PLANS.length,
    totalProducts: CONTEST_CATALOG.length + 1,
    totalPrices:
      CONTEST_CATALOG.length * CONTEST_ACCESS_OPTIONS.length + PLANS.length,
    writes: false,
  };
}

function isMissingResource(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "resource_missing" &&
    "statusCode" in error &&
    error.statusCode === 404
  );
}

function validateMasterProduct(
  product: Stripe.Product | Stripe.DeletedProduct,
  mode: "test" | "live",
): asserts product is Stripe.Product {
  if (
    product.deleted ||
    !product.active ||
    product.livemode !== (mode === "live") ||
    product.metadata.app !== "leiprova" ||
    product.metadata.commerce !== MASTER_STRIPE_COMMERCE
  ) {
    throw new Error("Identidade do produto Master unificado divergente.");
  }
}

async function resolveMasterProduct(
  stripe: MasterCatalogClient,
  mode: "test" | "live",
) {
  const found = await stripe.products.search({
    query: `metadata['app']:'leiprova' AND metadata['commerce']:'${MASTER_STRIPE_COMMERCE}'`,
    limit: 2,
  });
  if (found.data.length > 1)
    throw new Error("Produto Master unificado duplicado.");

  let product: Stripe.Product | Stripe.DeletedProduct | undefined =
    found.data[0];
  if (!product) {
    try {
      // ID estável recupera criações ainda ausentes no índice de busca da Stripe.
      product = await stripe.products.retrieve(MASTER_STRIPE_PRODUCT_ID);
    } catch (error) {
      if (!isMissingResource(error)) throw error;
    }
  }
  if (!product) {
    try {
      product = await stripe.products.create(
        {
          id: MASTER_STRIPE_PRODUCT_ID,
          name: "Editalume Master · Todos os concursos liberados",
          metadata: {
            app: "leiprova",
            commerce: MASTER_STRIPE_COMMERCE,
            catalog_scope: "all_released_contests",
          },
        },
        { idempotencyKey: "leiprova-master-product:v2" },
      );
    } catch (error) {
      // Uma resposta perdida ou execução concorrente não deve criar outro produto.
      try {
        product = await stripe.products.retrieve(MASTER_STRIPE_PRODUCT_ID);
      } catch {
        throw error;
      }
    }
  }
  validateMasterProduct(product, mode);
  return product;
}

/** Não altera produtos/preços v1 nem assinaturas; o chamador preserva a guarda LIVE. */
export async function ensureMasterStripeCatalog(
  stripe: MasterCatalogClient,
  mode: "test" | "live",
) {
  const product = await resolveMasterProduct(stripe, mode);
  const result: { plan: PlanDefinition; priceId: string }[] = [];

  for (const plan of PLANS) {
    const lookup = masterPriceLookupKey(plan);
    const found = await stripe.prices.list({ lookup_keys: [lookup], limit: 2 });
    if (found.data.length > 1)
      throw new Error("Preço Master unificado duplicado.");
    const price =
      found.data[0] ??
      (await stripe.prices.create(
        {
          product: product.id,
          currency: "brl",
          unit_amount: plan.priceCents,
          recurring: { interval: plan.billingMonths === 12 ? "year" : "month" },
          lookup_key: lookup,
          metadata: {
            app: "leiprova",
            commerce: MASTER_STRIPE_COMMERCE,
            plan_slug: plan.slug,
          },
        },
        { idempotencyKey: lookup },
      ));
    const productId =
      typeof price.product === "string" ? price.product : price.product.id;
    if (
      price.livemode !== (mode === "live") ||
      !price.active ||
      price.type !== "recurring" ||
      price.billing_scheme !== "per_unit" ||
      productId !== product.id ||
      price.currency !== "brl" ||
      price.unit_amount !== plan.priceCents ||
      price.recurring?.interval !==
        (plan.billingMonths === 12 ? "year" : "month") ||
      price.recurring.interval_count !== 1 ||
      price.recurring.usage_type !== "licensed"
    ) {
      throw new Error("Preço Master unificado divergente.");
    }
    result.push({ plan, priceId: price.id });
  }
  return { productId: product.id, prices: result };
}
