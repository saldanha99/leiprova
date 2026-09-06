import { PLANS, type PlanDefinition } from "../plans";
import { CONTEST_ACCESS_OPTIONS, CONTEST_CATALOG } from "./catalog";
import { ensureScopedRecurringStripePrice, ensureScopedStripeProduct, knownStripeProductFromPrices, type StripeCatalogClient, type StripeCatalogSyncOptions } from "./stripe-contest-catalog";
import { masterStripePresentation } from "./stripe-product-presentation";

export const MASTER_STRIPE_PRODUCT_ID = "leiprova_master_v2";
export const MASTER_STRIPE_COMMERCE = "master_v2";

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

/** Não altera produtos/preços v1 nem assinaturas; o chamador preserva a guarda LIVE. */
export async function ensureMasterStripeCatalog(
  stripe: StripeCatalogClient,
  mode: "test" | "live",
  options: StripeCatalogSyncOptions = {},
) {
  const identity = { app: "leiprova", commerce: MASTER_STRIPE_COMMERCE };
  const knownProductId = await knownStripeProductFromPrices(stripe, mode, options);
  const product = await ensureScopedStripeProduct(stripe, mode, {
    stableId: MASTER_STRIPE_PRODUCT_ID,
    knownProductId,
    identity,
    metadata: { ...identity, catalog_scope: "all_released_contests" },
    presentation: masterStripePresentation(),
    label: "Master unificado",
    idempotencyKey: "leiprova-master-product:v3",
    reactivate: options.reactivate,
  });
  const result: { plan: PlanDefinition; priceId: string }[] = [];

  for (const plan of PLANS) {
    const price = await ensureScopedRecurringStripePrice(stripe, mode, {
      productId: product.id,
      lookupKey: masterPriceLookupKey(plan),
      amountCents: plan.priceCents,
      interval: plan.billingMonths === 12 ? "year" : "month",
      metadata: { ...identity, plan_slug: plan.slug },
      label: "Master unificado",
      knownPriceId: options.knownPriceIds?.[plan.slug],
      reactivate: options.reactivate,
    });
    result.push({ plan, priceId: price.id });
  }
  return { productId: product.id, prices: result };
}
