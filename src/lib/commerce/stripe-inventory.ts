import type Stripe from "stripe";
import { chmod, mkdir, realpath } from "node:fs/promises";
import path from "node:path";

export const LEIPROVA_STRIPE_ACCOUNT = "acct_1TCQvlBkl6797u2u";
export const STRIPE_INVENTORY_LIMIT = 10_000;

export function inventoryCoverage(mode: "test" | "live") {
  return {
    atomicSnapshot: false,
    limitPerCollection: STRIPE_INVENTORY_LIMIT,
    prices: "catalog_prices_excluding_inline_prices",
    subscriptions: mode === "test" ? "excluding_test_clock_subscriptions" : "standard_live_subscriptions",
    checkoutSessions: "open_only",
    paymentLinks: "active_only",
    purpose: "catalog_retirement_review_not_complete_billing_audit",
  } as const;
}

/** Resolver o destino antes da rede; não seguir pastas privadas redirecionadas. */
export async function resolveStripeInventoryDirectory(projectDirectory: string) {
  const project = await realpath(projectDirectory);
  const expected = path.join(project, ".local", "commerce");
  if (await realpath(expected) !== expected) throw new Error("Base privada redirecionada.");
  const directory = path.join(expected, "stripe-inventory");
  await mkdir(directory, { mode: 0o700, recursive: true });
  if (await realpath(directory) !== directory) throw new Error("Pasta de inventário redirecionada.");
  await chmod(directory, 0o700);
  return directory;
}

/** Uma leitura incompleta nunca deve produzir um recibo de inventário completo. */
export async function collectInventory<T extends { id: string }>(
  source: AsyncIterable<T>,
  limit = STRIPE_INVENTORY_LIMIT,
): Promise<T[]> {
  if (!Number.isInteger(limit) || limit < 1 || limit > STRIPE_INVENTORY_LIMIT)
    throw new Error("Limite de inventário inválido.");
  const result: T[] = [];
  const ids = new Set<string>();
  for await (const value of source) {
    if (result.length >= limit) throw new Error("Inventário excedeu o limite; nada foi certificado.");
    if (ids.has(value.id)) throw new Error("Página repetiu identidade; refaça o inventário.");
    ids.add(value.id);
    result.push(value);
  }
  return result;
}

export function validateInventoryTarget(key: string, mode: string, expectedAccount?: string) {
  if (mode !== "test" && mode !== "live") throw new Error("Modo de inventário inválido.");
  if (!new RegExp(`^(sk|rk)_${mode}_`).test(key)) throw new Error("Chave ausente ou de outro modo.");
  if (expectedAccount !== LEIPROVA_STRIPE_ACCOUNT) throw new Error("Declare a conta 2timeWeb autorizada.");
  return { mode, expectedAccount };
}

export function requireInventoryMode(value: { livemode: boolean }, mode: "test" | "live") {
  if (value.livemode !== (mode === "live")) throw new Error("Objeto de outro modo no inventário.");
}

/** Não persiste metadata arbitrária, e-mail, cliente, descrição de cobrança ou URL de sessão. */
export function inventoryProduct(product: Stripe.Product) {
  return {
    id: product.id,
    name: product.name,
    active: product.active,
    created: product.created,
    app: product.metadata.app ?? null,
    commerce: product.metadata.commerce ?? null,
    slug: product.metadata.slug ?? null,
    imageCount: product.images.length,
  };
}

export function inventoryPrice(price: Stripe.Price) {
  return {
    id: price.id,
    productId: typeof price.product === "string" ? price.product : price.product.id,
    active: price.active,
    type: price.type,
    currency: price.currency,
    amountCents: price.unit_amount,
    interval: price.recurring?.interval ?? null,
    intervalCount: price.recurring?.interval_count ?? null,
    lookupKey: price.lookup_key,
  };
}

export function inventoryLineItems(lines: readonly Stripe.LineItem[]) {
  return lines.map((line) => ({
    id: line.id,
    quantity: line.quantity,
    priceId: line.price?.id ?? null,
    productId: line.price
      ? typeof line.price.product === "string" ? line.price.product : line.price.product.id
      : null,
  }));
}
