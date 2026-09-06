import { createHash } from "node:crypto";
import { z } from "zod";
import { LEIPROVA_STRIPE_ACCOUNT } from "./stripe-inventory";

const productSchema = z.object({ id: z.string().min(1), name: z.string().min(1), active: z.boolean() });
const priceSchema = z.object({ id: z.string().min(1), productId: z.string().min(1), active: z.boolean() });
const uiSchema = z.object({
  accountId: z.literal(LEIPROVA_STRIPE_ACCOUNT), observedOn: z.literal("2026-09-06"),
  counts: z.object({ products: z.literal(23), active: z.literal(19), archived: z.literal(4) }),
  products: z.array(productSchema).length(23),
});
const apiSchema = z.object({
  schemaVersion: z.literal(1), accountId: z.literal(LEIPROVA_STRIPE_ACCOUNT), stripeMode: z.literal("live"),
  readOnly: z.literal(true), remoteWrites: z.literal(false), atomicSnapshot: z.literal(false),
  completedAt: z.string().datetime(),
  coverage: z.object({ prices: z.literal("catalog_prices_excluding_inline_prices"),
    subscriptions: z.literal("standard_live_subscriptions"), paymentLinks: z.literal("active_only"), checkoutSessions: z.literal("open_only") }),
  products: z.array(productSchema).max(10_000), prices: z.array(priceSchema).max(20_000),
  paymentLinks: z.array(z.unknown()).max(10_000), checkoutSessions: z.array(z.unknown()).max(10_000),
  subscriptionReferences: z.array(z.object({ status: z.string(), productIds: z.array(z.string()) })).max(10_000),
});

function uniqueIds(rows: readonly { id: string }[]) {
  if (new Set(rows.map((row) => row.id)).size !== rows.length) throw new Error("Inventário contém IDs duplicados.");
}

export type StripeRetirementPlan = {
  accountId: string; mode: "live"; fingerprint: string;
  products: { id: string; name: string; prices: z.infer<typeof priceSchema>[] }[];
  preservedProductIds: string[]; excludedOtherProducts: number; existingSubscriptionReferences: number;
};

/** Núcleo interno testável com hash de fixture sintética; o CLI usa somente a fachada de hash fixo. */
export function createStripeRetirementOperator(authorizedUiSha256: string) {
  if (!/^[a-f0-9]{64}$/.test(authorizedUiSha256)) throw new Error("Hash de autorização inválido.");

function verifyAuthorizedUiBytes(text: string) {
  if (createHash("sha256").update(text).digest("hex") !== authorizedUiSha256)
    throw new Error("Snapshot UI difere daquele cujo escopo foi autorizado.");
}

function buildStripeRetirementPlan(uiText: string, apiInput: unknown, now = Date.now()): StripeRetirementPlan {
  verifyAuthorizedUiBytes(uiText);
  const ui = uiSchema.parse(JSON.parse(uiText));
  const api = apiSchema.parse(apiInput);
  uniqueIds(ui.products); uniqueIds(api.products); uniqueIds(api.prices);
  const age = now - Date.parse(api.completedAt);
  if (age < -60_000 || age > 24 * 60 * 60_000) throw new Error("Recapture o inventário API; limite de idade é 24 horas.");
  if (api.paymentLinks.length || api.checkoutSessions.length)
    throw new Error("Há Payment Links ativos ou Checkout Sessions abertas; resolver manualmente antes de arquivar.");
  // Identidades saem exclusivamente dos bytes UI autenticados, nunca do inventário API.
  const approvedProducts = ui.products.filter((product) => product.active);
  const preservedProducts = ui.products.filter((product) => !product.active);
  if (approvedProducts.length !== 19 || preservedProducts.length !== 4)
    throw new Error("Snapshot autorizado não contém a distribuição 19/4 esperada.");
  const activeIds = new Set(approvedProducts.map((product) => product.id));
  const preservedIds = new Set(preservedProducts.map((product) => product.id));
  const products = approvedProducts.map((approved) => {
    const id = approved.id;
    const captured = api.products.find((product) => product.id === id);
    if (!captured || captured.name !== approved.name) throw new Error("Produto autorizado ausente ou renomeado; recapture e revise o escopo.");
    return { id, name: approved.name, prices: api.prices.filter((price) => price.productId === id) };
  });
  // Os quatro já arquivados e qualquer produto novo ficam fora de todas as ações.
  const fingerprint = createHash("sha256").update(JSON.stringify({
    ui: authorizedUiSha256, products: products.map((product) => ({
      id: product.id, name: product.name, prices: product.prices.map((price) => price.id).sort(),
    })),
  })).digest("hex");
  return { accountId: LEIPROVA_STRIPE_ACCOUNT, mode: "live" as const, fingerprint, products,
    preservedProductIds: [...preservedIds],
    excludedOtherProducts: api.products.filter((product) => !activeIds.has(product.id) && !preservedIds.has(product.id)).length,
    existingSubscriptionReferences: api.subscriptionReferences.filter((subscription) =>
      subscription.productIds.some((id) => activeIds.has(id))).length,
  };
}

/** Arquiva apenas active=false; não cancela assinaturas nem muda cobranças/entitlements. */
async function retireStripeCatalog(
  uiText: string, apiInput: unknown, client: StripeRetirementClient,
  record: (event: RetirementEvent) => Promise<void>,
  now = Date.now(),
) {
  // Reautenticar bytes e reconstruir o plano em toda execução/retomada. Não aceitar plano arbitrário.
  const plan = buildStripeRetirementPlan(uiText, apiInput, now);
  if (await client.accountId() !== LEIPROVA_STRIPE_ACCOUNT) throw new Error("Conta Stripe divergente.");
  const checkCommerce = async () => {
    if (await client.hasActiveLinksOrOpenSessions()) throw new Error("Checkout aberto ou link ativo; resolução manual necessária.");
  };
  const checkProduct = async (product: StripeRetirementPlan["products"][number]) => {
    const current = await client.product(product.id);
    if (current.id !== product.id || !current.livemode || current.deleted || current.name !== product.name)
      throw new Error("Produto mudou de identidade, modo ou nome.");
    return current;
  };
  const checkPrice = async (id: string, productId: string) => {
    const current = await client.price(id);
    if (current.id !== id || current.productId !== productId || !current.livemode)
      throw new Error("Preço pertence a outro produto ou modo.");
    return current;
  };
  const checkPriceSet = async (product: StripeRetirementPlan["products"][number]) => {
    const prices = await client.productPrices(product.id);
    uniqueIds(prices);
    if (prices.length !== product.prices.length || prices.some((price) => price.productId !== product.id ||
      !price.livemode || !product.prices.some((expected) => expected.id === price.id)))
      throw new Error("Lista de preços mudou; recapture o inventário antes de continuar.");
  };
  await checkCommerce();
  // Conferir todos antes da primeira escrita, e repetir a leitura imediatamente por recurso.
  for (const product of plan.products) {
    await checkProduct(product); await checkPriceSet(product);
    for (const price of product.prices) await checkPrice(price.id, product.id);
  }
  for (const product of plan.products) {
    await checkPriceSet(product);
    for (const price of product.prices) {
      await checkCommerce(); await checkProduct(product);
      const current = await checkPrice(price.id, product.id);
      const event = { kind: "price" as const, id: price.id, productId: product.id };
      if (!current.active) { await record({ ...event, event: "already_archived" }); continue; }
      // Registro durável antes da chamada permite investigar interrupção/resposta incerta.
      await record({ ...event, event: "intent" });
      await client.archivePrice(price.id, `editalume-retire-${plan.fingerprint}-${price.id}`);
      if ((await checkPrice(price.id, product.id)).active) throw new Error("Arquivamento do preço não confirmado.");
      await record({ ...event, event: "confirmed" });
    }
    await checkCommerce(); await checkPriceSet(product);
    const current = await checkProduct(product);
    const event = { kind: "product" as const, id: product.id, productId: product.id };
    if (!current.active) { await record({ ...event, event: "already_archived" }); continue; }
    await record({ ...event, event: "intent" });
    await client.archiveProduct(product.id, `editalume-retire-${plan.fingerprint}-${product.id}`);
    if ((await checkProduct(product)).active) throw new Error("Arquivamento do produto não confirmado.");
    await record({ ...event, event: "confirmed" });
  }
}

return { verifyAuthorizedUiBytes, buildStripeRetirementPlan, retireStripeCatalog };
}

type LiveProduct = { id: string; name: string; active: boolean; livemode: boolean; deleted?: boolean };
type LivePrice = { id: string; productId: string; active: boolean; livemode: boolean };
export type StripeRetirementClient = {
  accountId: () => Promise<string>;
  hasActiveLinksOrOpenSessions: () => Promise<boolean>;
  product: (id: string) => Promise<LiveProduct>;
  price: (id: string) => Promise<LivePrice>;
  productPrices: (id: string) => Promise<LivePrice[]>;
  archiveProduct: (id: string, idempotencyKey: string) => Promise<void>;
  archivePrice: (id: string, idempotencyKey: string) => Promise<void>;
};
export type RetirementEvent = {
  event: "intent" | "confirmed" | "already_archived";
  kind: "product" | "price"; id: string; productId: string;
};
