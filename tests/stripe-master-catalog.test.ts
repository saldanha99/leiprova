import type Stripe from "stripe";
import { describe, expect, it, vi } from "vitest";

import {
  CONTEST_ACCESS_OPTIONS,
  CONTEST_CATALOG,
  contestPriceLookupKey,
} from "@/lib/commerce/catalog";
import { PLANS } from "@/lib/plans";
import {
  ensureMasterStripeCatalog,
  MASTER_STRIPE_COMMERCE,
  MASTER_STRIPE_PRODUCT_ID,
  masterPriceLookupKey,
  stripeCatalogSyncPreview,
} from "@/lib/commerce/stripe-master-catalog";

function productFixture(overrides: Partial<Stripe.Product> = {}) {
  return {
    id: MASTER_STRIPE_PRODUCT_ID,
    object: "product",
    active: true,
    livemode: true,
    name: "Master antigo",
    description: null,
    url: null,
    images: [],
    metadata: { app: "leiprova", commerce: MASTER_STRIPE_COMMERCE },
    ...overrides,
  } as Stripe.Product;
}

function priceFixture(index = 0, overrides: Partial<Stripe.Price> = {}) {
  const plan = PLANS[index];
  return {
    id: `price_master_${plan.slug}`,
    object: "price",
    active: true,
    livemode: true,
    type: "recurring",
    billing_scheme: "per_unit",
    product: MASTER_STRIPE_PRODUCT_ID,
    unit_amount: plan.priceCents,
    currency: "brl",
    lookup_key: masterPriceLookupKey(plan),
    recurring: {
      interval: plan.billingMonths === 12 ? "year" : "month",
      interval_count: 1,
      usage_type: "licensed",
      meter: null,
      trial_period_days: null,
    },
    ...overrides,
  } as Stripe.Price;
}

function fixture() {
  const products = new Map<string, Stripe.Product>();
  const prices = new Map<string, Stripe.Price>();
  const api = {
    products: {
      search: vi.fn(async () => ({
        data: [...products.values()].filter(
          (item) => item.metadata.commerce === MASTER_STRIPE_COMMERCE,
        ),
      })),
      retrieve: vi.fn(async (id: string) => {
        const product = products.get(id);
        if (!product) throw { code: "resource_missing", statusCode: 404 };
        return product;
      }),
      create: vi.fn(
        async (
          params: Stripe.ProductCreateParams,
          _options?: Stripe.RequestOptions,
        ) => {
          void _options;
          if (products.has(params.id!)) throw new Error("ID já existe.");
          const product = productFixture({
            id: params.id!,
            name: params.name,
            description: params.description ?? null,
            url: params.url ?? null,
            images: params.images ?? [],
            metadata: params.metadata as Stripe.Metadata,
          });
          products.set(product.id, product);
          return product;
        },
      ),
      update: vi.fn(async (id: string, params: Stripe.ProductUpdateParams) => {
        const product = { ...products.get(id)!, ...params } as Stripe.Product;
        products.set(id, product);
        return product;
      }),
    },
    prices: {
      list: vi.fn(async (params: Stripe.PriceListParams) => ({
        data: [...prices.values()].filter((item) =>
          params.lookup_keys?.includes(item.lookup_key!) && item.active === params.active,
        ),
      })),
      create: vi.fn(
        async (
          params: Stripe.PriceCreateParams,
          _options?: Stripe.RequestOptions,
        ) => {
          void _options;
          const existing = [...prices.values()].find(
            (item) => item.lookup_key === params.lookup_key,
          );
          if (existing) return existing;
          const price = priceFixture(
            params.recurring?.interval === "year" ? 1 : 0,
            {
              product: params.product!,
              lookup_key: params.lookup_key!,
            },
          );
          prices.set(price.id, price);
          return price;
        },
      ),
      retrieve: vi.fn(async (id: string) => {
        const price = prices.get(id);
        if (!price) throw { code: "resource_missing", statusCode: 404 };
        return price;
      }),
      update: vi.fn(async (id: string, params: Stripe.PriceUpdateParams) => {
        const price = { ...prices.get(id)!, ...params } as Stripe.Price;
        prices.set(id, price);
        return price;
      }),
    },
  };
  return {
    api,
    products,
    prices,
    stripe: api as unknown as Pick<Stripe, "products" | "prices">,
  };
}

describe("catálogo Stripe Master único", () => {
  it("planeja 75 concursos + um Master, com 152 preços distintos e nenhuma escrita", () => {
    expect(stripeCatalogSyncPreview("live")).toEqual({
      mode: "dry-run",
      stripeMode: "live",
      contests: 75,
      contestPrices: 150,
      contestBilling: [
        { interval: "month", amountCents: 6700 },
        { interval: "year", amountCents: 34700 },
      ],
      masterProducts: 1,
      masterPrices: 2,
      totalProducts: 76,
      totalPrices: 152,
      writes: false,
    });
    const keys = [
      ...CONTEST_CATALOG.flatMap((contest) =>
        CONTEST_ACCESS_OPTIONS.map((option) =>
          contestPriceLookupKey(contest.slug, option.key),
        ),
      ),
      ...PLANS.map(masterPriceLookupKey),
    ];
    expect(new Set(keys).size).toBe(152);
    expect(stripeCatalogSyncPreview("test").stripeMode).toBe("test");
  });

  it("cria um único produto com 297 mensal e 897 anual, sem mudar os slugs/env legados", async () => {
    const f = fixture();
    const result = await ensureMasterStripeCatalog(f.stripe, "live");
    expect(f.api.products.create).toHaveBeenCalledTimes(1);
    expect(f.api.prices.create).toHaveBeenCalledTimes(2);
    expect(result.productId).toBe(MASTER_STRIPE_PRODUCT_ID);
    expect(
      result.prices.map(({ plan }) => [plan.slug, plan.stripePriceEnv]),
    ).toEqual([
      ["ritmo", "STRIPE_PRICE_RITMO"],
      ["foco", "STRIPE_PRICE_FOCO"],
    ]);
    expect(
      f.api.prices.create.mock.calls.map(([params]) => [
        params.product,
        params.unit_amount,
        params.recurring?.interval,
      ]),
    ).toEqual([
      [MASTER_STRIPE_PRODUCT_ID, 29700, "month"],
      [MASTER_STRIPE_PRODUCT_ID, 89700, "year"],
    ]);
    expect(f.api.products.create.mock.calls[0][1]?.idempotencyKey).toBe(
      "leiprova-master-product:v3",
    );
    expect(
      f.api.prices.create.mock.calls.map(
        ([, options]) => options?.idempotencyKey,
      ),
    ).toEqual(PLANS.map(masterPriceLookupKey));
  });

  it("reexecução reaproveita o produto e os dois preços sem novas criações", async () => {
    const f = fixture();
    const first = await ensureMasterStripeCatalog(f.stripe, "live");
    expect(await ensureMasterStripeCatalog(f.stripe, "live")).toEqual(first);
    expect(f.api.products.create).toHaveBeenCalledTimes(1);
    expect(f.api.prices.create).toHaveBeenCalledTimes(2);
  });

  it("índice de busca atrasado não duplica produto mesmo em nova execução", async () => {
    const f = fixture();
    f.api.products.search.mockResolvedValue({ data: [] });
    await ensureMasterStripeCatalog(f.stripe, "live");
    await ensureMasterStripeCatalog(f.stripe, "live");
    expect(f.api.products.create).toHaveBeenCalledTimes(1);
    expect(f.api.prices.create).toHaveBeenCalledTimes(2);
  });

  it("execuções concorrentes convergem no mesmo produto e nos mesmos preços", async () => {
    const f = fixture();
    f.api.products.search.mockResolvedValue({ data: [] });
    const results = await Promise.all([
      ensureMasterStripeCatalog(f.stripe, "live"),
      ensureMasterStripeCatalog(f.stripe, "live"),
    ]);
    expect(results[0]).toEqual(results[1]);
    expect(f.products.size).toBe(1);
    expect(f.prices.size).toBe(2);
    expect(
      new Set(
        f.api.prices.create.mock.calls.map(
          ([, options]) => options?.idempotencyKey,
        ),
      ).size,
    ).toBe(2);
  });

  it("recupera resposta perdida na criação pelo ID exato", async () => {
    const f = fixture();
    f.api.products.create.mockImplementationOnce(async () => {
      f.products.set(MASTER_STRIPE_PRODUCT_ID, productFixture());
      throw new Error("Resposta interrompida depois da criação.");
    });
    await expect(
      ensureMasterStripeCatalog(f.stripe, "live"),
    ).resolves.toMatchObject({ productId: MASTER_STRIPE_PRODUCT_ID });
    expect(f.api.products.create).toHaveBeenCalledTimes(1);
    expect(f.products.size).toBe(1);
  });

  it("retoma após falha parcial sem recriar o preço mensal já persistido", async () => {
    const f = fixture();
    f.products.set(MASTER_STRIPE_PRODUCT_ID, productFixture());
    const monthly = priceFixture();
    f.prices.set(monthly.id, monthly);
    await ensureMasterStripeCatalog(f.stripe, "live");
    expect(f.api.products.create).not.toHaveBeenCalled();
    expect(f.api.prices.create).toHaveBeenCalledTimes(1);
    expect(f.api.prices.create.mock.calls[0][0].recurring?.interval).toBe(
      "year",
    );
  });

  it("preserva produtos/preços Master v1 e não transfere suas lookup keys", async () => {
    const f = fixture();
    const legacyProduct = productFixture({
      id: "prod_master_ritmo_v1",
      metadata: { app: "leiprova", plan_slug: "ritmo" },
    });
    const legacyPrice = priceFixture(0, {
      id: "price_legacy",
      product: legacyProduct.id,
      lookup_key: "leiprova_master_ritmo_29700_v1",
    });
    f.products.set(legacyProduct.id, legacyProduct);
    f.prices.set(legacyPrice.id, legacyPrice);
    await ensureMasterStripeCatalog(f.stripe, "live");
    expect(f.products.get(legacyProduct.id)).toEqual(legacyProduct);
    expect(f.prices.get(legacyPrice.id)).toEqual(legacyPrice);
    expect(
      f.api.prices.create.mock.calls.every(
        ([params]) => params.transfer_lookup_key === undefined,
      ),
    ).toBe(true);
    expect(f.products.size).toBe(2);
    expect(f.prices.size).toBe(3);
  });

  it.each([
    { unit_amount: 1 },
    { currency: "usd" },
    { livemode: false },
    { active: false },
    { product: "prod_outro" },
    { type: "one_time" as const },
    { billing_scheme: "tiered" as const },
    { recurring: { ...priceFixture().recurring!, interval: "year" as const } },
    { recurring: { ...priceFixture().recurring!, interval_count: 6 } },
    {
      recurring: {
        ...priceFixture().recurring!,
        usage_type: "metered" as const,
      },
    },
  ])("recusa preço divergente sem sobrescrevê-lo: %j", async (overrides) => {
    const f = fixture();
    f.products.set(MASTER_STRIPE_PRODUCT_ID, productFixture());
    const price = priceFixture(0, overrides);
    f.prices.set(price.id, price);
    await expect(ensureMasterStripeCatalog(f.stripe, "live")).rejects.toThrow(
      "Preço Master unificado divergente",
    );
    expect(f.api.products.create).not.toHaveBeenCalled();
    expect(f.api.prices.create).not.toHaveBeenCalled();
    expect(f.prices.get(price.id)).toEqual(price);
  });

  it.each([
    { active: false },
    { livemode: false },
    { metadata: { app: "outro", commerce: MASTER_STRIPE_COMMERCE } },
  ])(
    "recusa produto arquivado, de outro modo ou de outra aplicação: %j",
    async (overrides) => {
      const f = fixture();
      f.products.set(MASTER_STRIPE_PRODUCT_ID, productFixture(overrides));
      await expect(ensureMasterStripeCatalog(f.stripe, "live")).rejects.toThrow(
        "Identidade do produto Master unificado divergente",
      );
      expect(f.api.products.create).not.toHaveBeenCalled();
      expect(f.api.prices.create).not.toHaveBeenCalled();
    },
  );

  it("não interpreta ausência de permissão como ausência de produto", async () => {
    const f = fixture();
    f.api.products.retrieve.mockRejectedValue({
      code: "permission_denied",
      statusCode: 403,
    });
    await expect(
      ensureMasterStripeCatalog(f.stripe, "live"),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(f.api.products.create).not.toHaveBeenCalled();
  });

  it("interrompe quando encontra dois produtos Master unificados", async () => {
    const f = fixture();
    f.products.set("one", productFixture({ id: "one" }));
    f.products.set("two", productFixture({ id: "two" }));
    await expect(ensureMasterStripeCatalog(f.stripe, "live")).rejects.toThrow(
      "Produto Master unificado duplicado",
    );
    expect(f.api.products.create).not.toHaveBeenCalled();
    expect(f.api.prices.create).not.toHaveBeenCalled();
  });

  it("interrompe quando uma lookup key retorna preços duplicados", async () => {
    const f = fixture();
    f.products.set(MASTER_STRIPE_PRODUCT_ID, productFixture());
    f.api.prices.list.mockResolvedValue({
      data: [priceFixture(), priceFixture(0, { id: "price_duplicate" })],
    });
    await expect(ensureMasterStripeCatalog(f.stripe, "live")).rejects.toThrow(
      "Preço Master unificado duplicado",
    );
    expect(f.api.prices.create).not.toHaveBeenCalled();
  });

  it("reativação exige opção explícita e conserva IDs e preços do Master", async () => {
    const f = fixture();
    f.products.set(MASTER_STRIPE_PRODUCT_ID, productFixture({ active: false }));
    for (let index = 0; index < 2; index += 1) {
      const price = priceFixture(index, { active: false });
      f.prices.set(price.id, price);
    }
    const result = await ensureMasterStripeCatalog(f.stripe, "live", { reactivate: true });
    expect(result.productId).toBe(MASTER_STRIPE_PRODUCT_ID);
    expect(f.api.products.create).not.toHaveBeenCalled();
    expect(f.api.prices.create).not.toHaveBeenCalled();
    expect(f.api.products.update).toHaveBeenCalledTimes(1);
    expect(f.api.prices.update).toHaveBeenCalledTimes(2);
    expect(f.api.prices.update.mock.calls.every(([, params]) => JSON.stringify(params) === '{"active":true}')).toBe(true);
  });

  it("atualiza apenas a apresentação do Master validado, com fotografia e escopo honesto", async () => {
    const f = fixture();
    f.products.set(MASTER_STRIPE_PRODUCT_ID, productFixture());
    await ensureMasterStripeCatalog(f.stripe, "live");
    const params = f.api.products.update.mock.calls[0][1];
    expect(params.description).toContain("preparação editorial");
    expect(params.url).toBe("https://leiprova.2b.app.br/#planos");
    expect(params.images).toEqual(["https://leiprova.2b.app.br/assets/contests/editorial-study-v2.webp"]);
    expect(params.metadata).toBeUndefined();
    expect(params.active).toBeUndefined();
  });

  it("conflito entre ID determinístico e produto da busca bloqueia antes de atualizar", async () => {
    const f = fixture();
    f.products.set(MASTER_STRIPE_PRODUCT_ID, productFixture());
    f.products.set("prod_other_master", productFixture({ id: "prod_other_master" }));
    f.api.products.search.mockResolvedValue({ data: [f.products.get("prod_other_master")!] });
    await expect(ensureMasterStripeCatalog(f.stripe, "live")).rejects.toThrow("IDs divergentes");
    expect(f.api.products.update).not.toHaveBeenCalled();
    expect(f.api.products.create).not.toHaveBeenCalled();
  });

  it("Master deriva produto antigo dos preços locais quando a busca está atrasada", async () => {
    const f = fixture();
    f.products.set("prod_original_master", productFixture({ id: "prod_original_master" }));
    f.prices.set("price_master_ritmo", priceFixture(0, { product: "prod_original_master" }));
    f.prices.set("price_master_foco", priceFixture(1, { product: "prod_original_master" }));
    f.api.products.search.mockResolvedValue({ data: [] });
    const result = await ensureMasterStripeCatalog(f.stripe, "live", {
      knownPriceIds: { ritmo: "price_master_ritmo", foco: "price_master_foco" },
    });
    expect(result.productId).toBe("prod_original_master");
    expect(f.api.products.create).not.toHaveBeenCalled();
    expect(f.api.prices.create).not.toHaveBeenCalled();
  });
});
