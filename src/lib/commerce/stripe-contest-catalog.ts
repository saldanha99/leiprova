import { createHash } from "node:crypto";
import type Stripe from "stripe";
import { CONTEST_ACCESS_OPTIONS, contestPriceLookupKey, type CatalogContest, type ContestAccessKey } from "./catalog";
import { contestStripePresentation, type StripeProductPresentation } from "./stripe-product-presentation";

export type StripeCatalogClient = Pick<Stripe, "products" | "prices">;
export type StripeCatalogSyncOptions = {
  reactivate?: boolean;
  knownProductId?: string | null;
  knownPriceIds?: Readonly<Record<string, string | null | undefined>>;
};

export const CONTEST_STRIPE_COMMERCE = "contest_v1";

export function contestStripeProductId(slug: string) {
  // Identidade permanente, independente do índice de busca e da retenção da chave de idempotência.
  return `leiprova_contest_${createHash("sha256").update(slug).digest("hex").slice(0, 32)}`;
}

/** O Master armazena os IDs de preço localmente; deles também deriva uma identidade de produto. */
export async function knownStripeProductFromPrices(
  stripe: StripeCatalogClient,
  mode: "test" | "live",
  options: StripeCatalogSyncOptions,
) {
  const productIds = new Set<string>();
  if (options.knownProductId) productIds.add(options.knownProductId);
  for (const id of new Set(Object.values(options.knownPriceIds ?? {}).filter((value): value is string => Boolean(value)))) {
    const price = await stripe.prices.retrieve(id);
    if (price.id !== id || price.livemode !== (mode === "live")) throw new Error("Preço local conhecido de outro modo ou identidade.");
    productIds.add(typeof price.product === "string" ? price.product : price.product.id);
  }
  if (productIds.size > 1) throw new Error("Preços locais apontam para produtos divergentes; reconciliação necessária.");
  return productIds.values().next().value;
}

function isMissingResource(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error &&
    error.code === "resource_missing" && "statusCode" in error && error.statusCode === 404;
}

function validateProductIdentity(
  product: Stripe.Product | Stripe.DeletedProduct,
  id: string,
  mode: "test" | "live",
  identity: Stripe.Metadata,
  label: string,
): asserts product is Stripe.Product {
  if (product.deleted || product.id !== id || product.livemode !== (mode === "live") ||
    Object.entries(identity).some(([key, value]) => product.metadata?.[key] !== value)) {
    throw new Error(`Identidade do produto ${label} divergente.`);
  }
}

/** Só modifica apresentação/active depois de confirmar identidade, modo e ausência de duplicatas. */
export async function ensureScopedStripeProduct(
  stripe: StripeCatalogClient,
  mode: "test" | "live",
  input: {
    stableId: string;
    knownProductId?: string | null;
    identity: Stripe.Metadata;
    metadata: Stripe.Metadata;
    presentation: StripeProductPresentation;
    label: string;
    idempotencyKey: string;
    reactivate?: boolean;
  },
) {
  const candidates = new Map<string, Stripe.Product>();
  async function retrieve(id: string, required: boolean) {
    if (candidates.has(id)) return;
    try {
      const product = await stripe.products.retrieve(id);
      validateProductIdentity(product, id, mode, input.identity, input.label);
      candidates.set(id, product);
    } catch (error) {
      if (!isMissingResource(error)) throw error;
      if (required) throw new Error(`Produto ${input.label} conhecido não encontrado; reconciliação necessária.`);
    }
  }
  if (input.knownProductId) await retrieve(input.knownProductId, true);
  await retrieve(input.stableId, false);
  // Identidades são construídas pelo catálogo interno, nunca por entrada livre de formulário.
  const query = Object.entries(input.identity)
    .map(([key, value]) => {
      if (!/^[a-z0-9_]+$/.test(key) || !/^[a-z0-9_-]+$/.test(value)) {
        throw new Error("Identidade de catálogo inválida.");
      }
      return `metadata['${key}']:'${value}'`;
    }).join(" AND ");
  const found = await stripe.products.search({ query, limit: 2 });
  if (found.has_more || found.data.length > 1) throw new Error(`Produto ${input.label} duplicado.`);
  for (const candidate of found.data) {
    validateProductIdentity(candidate, candidate.id, mode, input.identity, input.label);
    await retrieve(candidate.id, true);
  }
  if (candidates.size > 1) throw new Error(`Produto ${input.label} duplicado ou com IDs divergentes.`);
  let product = candidates.values().next().value;
  if (!product) {
    try {
      product = await stripe.products.create({
        id: input.stableId,
        ...input.presentation,
        metadata: input.metadata,
      }, { idempotencyKey: input.idempotencyKey });
    } catch (error) {
      // Resposta perdida ou criação concorrente: recupera o ID exato, nunca cria outro ID.
      try {
        product = await stripe.products.retrieve(input.stableId);
      } catch {
        throw error;
      }
    }
    validateProductIdentity(product, input.stableId, mode, input.identity, input.label);
  }
  if (!product.active && !input.reactivate) {
    throw new Error(`Identidade do produto ${input.label} divergente: arquivado; --reactivate é obrigatório.`);
  }
  const matchesPresentation = (candidate: Stripe.Product) => candidate.name === input.presentation.name &&
    candidate.description === input.presentation.description && candidate.url === input.presentation.url &&
    JSON.stringify(candidate.images) === JSON.stringify(input.presentation.images);
  if (!matchesPresentation(product) || !product.active) {
    const id = product.id;
    product = await stripe.products.update(id, {
      ...input.presentation,
      ...(!product.active ? { active: true } : {}),
    });
    validateProductIdentity(product, id, mode, input.identity, input.label);
    if (!product.active) throw new Error(`Produto ${input.label} permaneceu arquivado.`);
    if (!matchesPresentation(product)) throw new Error(`Apresentação do produto ${input.label} divergente após atualização.`);
  }
  return product;
}

type RecurringPriceContract = {
  productId: string;
  lookupKey: string;
  amountCents: number;
  interval: "month" | "year";
  metadata: Stripe.Metadata;
  label: string;
  knownPriceId?: string | null;
  reactivate?: boolean;
};

function validatePriceIdentity(price: Stripe.Price, mode: "test" | "live", input: RecurringPriceContract) {
  const productId = typeof price.product === "string" ? price.product : price.product.id;
  const brlOption = price.currency_options?.brl;
  const decimalMatches = (value: Stripe.Price["unit_amount_decimal"]) =>
    value == null || new RegExp(`^${input.amountCents}(?:\\.0+)?$`).test(String(value));
  // Não muda classificação tributária. Também não aceita preço ajustável, por faixa ou quantidade transformada.
  if (price.livemode !== (mode === "live") || price.type !== "recurring" ||
    price.billing_scheme !== "per_unit" || productId !== input.productId ||
    price.currency !== "brl" || price.unit_amount !== input.amountCents ||
    !decimalMatches(price.unit_amount_decimal) ||
    price.recurring?.interval !== input.interval || price.recurring.interval_count !== 1 ||
    price.recurring.usage_type !== "licensed" || price.transform_quantity != null || price.custom_unit_amount != null ||
    (price.currency_options && Object.keys(price.currency_options).some((currency) => currency !== "brl")) ||
    (brlOption && (brlOption.unit_amount !== input.amountCents || brlOption.custom_unit_amount != null ||
      !decimalMatches(brlOption.unit_amount_decimal)))) {
    throw new Error(`Preço ${input.label} divergente.`);
  }
  // Metadados antigos ausentes não invalidam o vínculo autoritativo ao produto; conflitos nunca são aceitos.
  if (Object.entries(input.metadata).some(([key, value]) => price.metadata?.[key] !== undefined && price.metadata[key] !== value)) {
    throw new Error(`Metadados do preço ${input.label} divergentes.`);
  }
}

export async function ensureScopedRecurringStripePrice(
  stripe: StripeCatalogClient,
  mode: "test" | "live",
  input: RecurringPriceContract,
) {
  let known: Stripe.Price | undefined;
  if (input.knownPriceId) {
    known = await stripe.prices.retrieve(input.knownPriceId, { expand: ["currency_options"] });
    if (known.id !== input.knownPriceId) throw new Error(`ID do preço ${input.label} divergente.`);
    validatePriceIdentity(known, mode, input);
  }
  async function findPrice() {
    // A listagem padrão é de ativos; incluir arquivados impede criar outro preço por engano.
    const matches = await Promise.all([true, false].map((active) => stripe.prices.list({
      lookup_keys: [input.lookupKey], active, limit: 2, expand: ["data.currency_options"],
    })));
    const found = new Map<string, Stripe.Price>();
    for (const page of matches) {
      if (page.has_more || page.data.length > 1) throw new Error(`Preço ${input.label} duplicado.`);
      for (const price of page.data) {
        if (price.lookup_key !== input.lookupKey) throw new Error(`Lookup key do preço ${input.label} divergente.`);
        validatePriceIdentity(price, mode, input);
        found.set(price.id, price);
      }
    }
    if (found.size > 1 || (known && found.size && !found.has(known.id))) {
      throw new Error(`Preço ${input.label} duplicado ou com IDs divergentes.`);
    }
    return known ?? found.values().next().value;
  }
  let price = await findPrice();
  if (!price) {
    try {
      price = await stripe.prices.create({
        product: input.productId,
        currency: "brl",
        unit_amount: input.amountCents,
        recurring: { interval: input.interval, interval_count: 1, usage_type: "licensed" },
        lookup_key: input.lookupKey,
        metadata: input.metadata,
      }, { idempotencyKey: input.lookupKey });
    } catch (error) {
      // Lookup key é única. Se o provedor criou antes de perder a resposta, recupera sem transferi-la.
      price = await findPrice();
      if (!price) throw error;
    }
    if (price.lookup_key !== input.lookupKey) throw new Error(`Lookup key do preço ${input.label} divergente.`);
  }
  validatePriceIdentity(price, mode, input);
  if (!price.active) {
    if (!input.reactivate) throw new Error(`Preço ${input.label} divergente: arquivado; --reactivate é obrigatório.`);
    const id = price.id;
    const lookupKey = price.lookup_key;
    price = await stripe.prices.update(id, { active: true });
    if (price.id !== id || !price.active || price.lookup_key !== lookupKey) throw new Error(`Reativação do preço ${input.label} divergente.`);
    validatePriceIdentity(price, mode, input);
  }
  return price;
}

export async function ensureContestStripeCatalog(
  stripe: StripeCatalogClient,
  mode: "test" | "live",
  contest: CatalogContest,
  options: StripeCatalogSyncOptions = {},
) {
  const identity = { app: "leiprova", commerce: CONTEST_STRIPE_COMMERCE, slug: contest.slug };
  const knownProductId = await knownStripeProductFromPrices(stripe, mode, options);
  const product = await ensureScopedStripeProduct(stripe, mode, {
    stableId: contestStripeProductId(contest.slug),
    knownProductId,
    identity,
    metadata: { ...identity, editorial_status: "draft" },
    presentation: contestStripePresentation(contest),
    label: "de concurso",
    idempotencyKey: `contest-product:${contest.slug}:v2`,
    reactivate: options.reactivate,
  });
  const prices: { key: ContestAccessKey; priceId: string }[] = [];
  for (const option of CONTEST_ACCESS_OPTIONS) {
    const price = await ensureScopedRecurringStripePrice(stripe, mode, {
      productId: product.id,
      lookupKey: contestPriceLookupKey(contest.slug, option.key),
      amountCents: option.amountCents,
      interval: option.interval,
      metadata: { ...identity, access_months: String(option.months) },
      label: "de concurso",
      knownPriceId: options.knownPriceIds?.[option.key],
      reactivate: options.reactivate,
    });
    prices.push({ key: option.key, priceId: price.id });
  }
  return { productId: product.id, prices };
}
