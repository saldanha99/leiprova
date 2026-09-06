import Stripe from "stripe";
import { describe, expect, it, vi } from "vitest";
import { CONTEST_ACCESS_OPTIONS, CONTEST_CATALOG, catalogContestPath, contestPriceLookupKey } from "@/lib/commerce/catalog";
import { contestStripeProductId, ensureContestStripeCatalog, type StripeCatalogClient } from "@/lib/commerce/stripe-contest-catalog";
import { contestStripePresentation, masterStripePresentation, STRIPE_CATALOG_STUDY_IMAGE } from "@/lib/commerce/stripe-product-presentation";

const contest = CONTEST_CATALOG[0];
const identity = { app: "leiprova", commerce: "contest_v1", slug: contest.slug };
const stableId = contestStripeProductId(contest.slug);

function productFixture(overrides: Partial<Stripe.Product> = {}): Stripe.Product {
  return { id: stableId, object: "product", active: true, livemode: true,
    metadata: { ...identity, editorial_status: "draft" }, ...contestStripePresentation(contest),
    ...overrides } as Stripe.Product;
}

function priceFixture(index = 0, overrides: Partial<Stripe.Price> = {}): Stripe.Price {
  const option = CONTEST_ACCESS_OPTIONS[index];
  return { id: `price_${option.key}`, object: "price", active: true, livemode: true,
    type: "recurring", billing_scheme: "per_unit", product: stableId,
    currency: "brl", unit_amount: option.amountCents, unit_amount_decimal: Stripe.Decimal.from(option.amountCents),
    lookup_key: contestPriceLookupKey(contest.slug, option.key), metadata: { ...identity, access_months: String(option.months) },
    custom_unit_amount: null, transform_quantity: null, tax_behavior: "unspecified",
    recurring: { interval: option.interval, interval_count: 1, usage_type: "licensed", meter: null, trial_period_days: null },
    ...overrides } as Stripe.Price;
}

function fixture() {
  const products = new Map<string, Stripe.Product>();
  const prices = new Map<string, Stripe.Price>();
  const api = {
    products: {
      retrieve: vi.fn(async (id: string) => {
        const product = products.get(id);
        if (!product) throw { code: "resource_missing", statusCode: 404 };
        return product;
      }),
      search: vi.fn(async (_params: Stripe.ProductSearchParams) => {
        void _params;
        return { data: [...products.values()].filter((product) => product.metadata.app === identity.app &&
          product.metadata.commerce === identity.commerce && product.metadata.slug === identity.slug), has_more: false };
      }),
      create: vi.fn(async (params: Stripe.ProductCreateParams, _options?: Stripe.RequestOptions) => {
        void _options;
        if (products.has(params.id!)) throw new Error("ID existente.");
        const product = productFixture({ id: params.id!, name: params.name,
          description: params.description ?? null, images: params.images ?? [], url: params.url ?? null,
          metadata: params.metadata as Stripe.Metadata });
        products.set(product.id, product);
        return product;
      }),
      update: vi.fn(async (id: string, params: Stripe.ProductUpdateParams) => {
        const product = { ...products.get(id)!, ...params } as Stripe.Product;
        products.set(id, product);
        return product;
      }),
    },
    prices: {
      retrieve: vi.fn(async (id: string, _params?: Stripe.PriceRetrieveParams) => {
        void _params;
        const price = prices.get(id);
        if (!price) throw { code: "resource_missing", statusCode: 404 };
        return price;
      }),
      list: vi.fn(async (params: Stripe.PriceListParams) => ({
        data: [...prices.values()].filter((price) => params.lookup_keys?.includes(price.lookup_key!) &&
          price.active === params.active), has_more: false,
      })),
      create: vi.fn(async (params: Stripe.PriceCreateParams, _options?: Stripe.RequestOptions) => {
        void _options;
        const existing = [...prices.values()].find((price) => price.lookup_key === params.lookup_key);
        if (existing) throw new Error("Lookup existente.");
        const price = priceFixture(params.recurring?.interval === "year" ? 1 : 0, {
          product: params.product!, lookup_key: params.lookup_key!, metadata: params.metadata as Stripe.Metadata,
        });
        prices.set(price.id, price);
        return price;
      }),
      update: vi.fn(async (id: string, params: Stripe.PriceUpdateParams) => {
        const price = { ...prices.get(id)!, ...params } as Stripe.Price;
        prices.set(id, price);
        return price;
      }),
    },
  };
  return { api, products, prices, stripe: api as unknown as StripeCatalogClient };
}

describe("apresentação do catálogo Stripe", () => {
  it("75 URLs canônicas HTTPS, imagens existentes e identidades estáveis distintas", () => {
    const ids = new Set(CONTEST_CATALOG.map((item) => contestStripeProductId(item.slug)));
    expect(ids.size).toBe(75);
    for (const item of CONTEST_CATALOG) {
      const presentation = contestStripePresentation(item);
      expect(presentation.url).toBe(`https://leiprova.2b.app.br${catalogContestPath(item)}`);
      expect(presentation.images).toEqual([STRIPE_CATALOG_STUDY_IMAGE]);
      expect(presentation.description).toContain("preparação editorial");
      expect(presentation.name).toContain(item.editionLabel);
      expect(contestStripeProductId(item.slug)).toMatch(/^leiprova_contest_[a-f0-9]{32}$/);
    }
    expect(masterStripePresentation().url).toBe("https://leiprova.2b.app.br/#planos");
  });
});

describe("sincronização identificada dos concursos", () => {
  it("cria um produto e dois preços recorrentes, incluindo apresentação e metadados", async () => {
    const f = fixture();
    const result = await ensureContestStripeCatalog(f.stripe, "live", contest);
    expect(result).toEqual({ productId: stableId, prices: [
      { key: "monthly", priceId: "price_monthly" }, { key: "annual", priceId: "price_annual" },
    ] });
    expect(f.api.products.create.mock.calls[0][0]).toMatchObject({ id: stableId, ...contestStripePresentation(contest), metadata: identity });
    expect(f.api.products.create.mock.calls[0][1]?.idempotencyKey).toBe(`contest-product:${contest.slug}:v2`);
    expect(f.api.prices.create.mock.calls.map(([params]) => [params.unit_amount, params.recurring?.interval])).toEqual([[6700, "month"], [34700, "year"]]);
    expect(f.api.products.update).not.toHaveBeenCalled();
    expect(f.api.prices.update).not.toHaveBeenCalled();
  });

  it("reexecução sem índice atualizado não duplica produto nem preços", async () => {
    const f = fixture();
    f.api.products.search.mockResolvedValue({ data: [], has_more: false });
    const first = await ensureContestStripeCatalog(f.stripe, "live", contest);
    expect(await ensureContestStripeCatalog(f.stripe, "live", contest)).toEqual(first);
    expect(f.api.products.create).toHaveBeenCalledTimes(1);
    expect(f.api.prices.create).toHaveBeenCalledTimes(2);
  });

  it("duas execuções concorrentes convergem nos mesmos IDs", async () => {
    const f = fixture();
    f.api.products.search.mockResolvedValue({ data: [], has_more: false });
    const results = await Promise.all([ensureContestStripeCatalog(f.stripe, "live", contest), ensureContestStripeCatalog(f.stripe, "live", contest)]);
    expect(results[0]).toEqual(results[1]);
    expect(f.products.size).toBe(1);
    expect(f.prices.size).toBe(2);
  });

  it("reutiliza ID aleatório antigo conhecido mesmo com índice vazio", async () => {
    const f = fixture();
    f.products.set("prod_original", productFixture({ id: "prod_original", name: "Nome antigo", metadata: { ...identity, editorial_status: "released", other: "preservar" } }));
    f.api.products.search.mockResolvedValue({ data: [], has_more: false });
    const result = await ensureContestStripeCatalog(f.stripe, "live", contest, { knownProductId: "prod_original" });
    expect(result.productId).toBe("prod_original");
    expect(f.api.products.create).not.toHaveBeenCalled();
    expect(f.products.get("prod_original")?.metadata).toEqual({ ...identity, editorial_status: "released", other: "preservar" });
    expect(f.api.products.update.mock.calls[0][1].metadata).toBeUndefined();
  });

  it("reutiliza ID antigo encontrado pela metadata sem criar ID determinístico paralelo", async () => {
    const f = fixture();
    f.products.set("prod_original", productFixture({ id: "prod_original" }));
    expect((await ensureContestStripeCatalog(f.stripe, "live", contest)).productId).toBe("prod_original");
    expect(f.api.products.create).not.toHaveBeenCalled();
  });

  it("recupera resposta perdida de criação por ID permanente", async () => {
    const f = fixture();
    f.api.products.create.mockImplementationOnce(async () => {
      f.products.set(stableId, productFixture());
      throw new Error("Resposta perdida.");
    });
    expect((await ensureContestStripeCatalog(f.stripe, "live", contest)).productId).toBe(stableId);
    expect(f.api.products.create).toHaveBeenCalledTimes(1);
  });

  it("recupera resposta perdida de preço pela lookup sem transferi-la", async () => {
    const f = fixture();
    f.api.prices.create.mockImplementationOnce(async () => {
      f.prices.set("price_monthly", priceFixture());
      throw new Error("Resposta perdida.");
    });
    await ensureContestStripeCatalog(f.stripe, "live", contest);
    expect(f.prices.size).toBe(2);
    expect(f.api.prices.create.mock.calls.every(([params]) => params.transfer_lookup_key === undefined)).toBe(true);
  });

  it("local conhecido ausente bloqueia, em vez de criar substituto", async () => {
    const f = fixture();
    await expect(ensureContestStripeCatalog(f.stripe, "live", contest, { knownProductId: "prod_missing" })).rejects.toThrow("conhecido não encontrado");
    expect(f.api.products.create).not.toHaveBeenCalled();
  });

  it("falha de permissão não vira produto inexistente", async () => {
    const f = fixture();
    f.api.products.retrieve.mockRejectedValue({ code: "permission_denied", statusCode: 403 });
    await expect(ensureContestStripeCatalog(f.stripe, "live", contest)).rejects.toMatchObject({ statusCode: 403 });
    expect(f.api.products.create).not.toHaveBeenCalled();
  });

  it.each([
    { livemode: false }, { metadata: { ...identity, app: "other" } },
    { metadata: { ...identity, slug: "outra-edicao" } }, { metadata: { ...identity, commerce: "other" } },
    { deleted: true } as unknown as Partial<Stripe.Product>,
  ])("recusa produto de modo/identidade divergente antes de atualização: %j", async (overrides) => {
    const f = fixture();
    f.products.set(stableId, productFixture(overrides));
    await expect(ensureContestStripeCatalog(f.stripe, "live", contest, { reactivate: true })).rejects.toThrow("Identidade do produto");
    expect(f.api.products.update).not.toHaveBeenCalled();
    expect(f.api.products.create).not.toHaveBeenCalled();
  });

  it("ID local e determinístico diferentes bloqueiam mesmo se busca atrasada", async () => {
    const f = fixture();
    f.products.set(stableId, productFixture());
    f.products.set("prod_original", productFixture({ id: "prod_original" }));
    f.api.products.search.mockResolvedValue({ data: [], has_more: false });
    await expect(ensureContestStripeCatalog(f.stripe, "live", contest, { knownProductId: "prod_original" })).rejects.toThrow("IDs divergentes");
    expect(f.api.products.update).not.toHaveBeenCalled();
  });

  it("busca com mais resultados ou duplicatas bloqueia sem atualizar", async () => {
    const f = fixture();
    f.api.products.search.mockResolvedValue({ data: [productFixture()], has_more: true });
    await expect(ensureContestStripeCatalog(f.stripe, "live", contest)).rejects.toThrow("duplicado");
    expect(f.api.products.update).not.toHaveBeenCalled();
  });

  it("produto arquivado exige --reactivate e preço arquivado também", async () => {
    const f = fixture();
    f.products.set(stableId, productFixture({ active: false }));
    await expect(ensureContestStripeCatalog(f.stripe, "live", contest)).rejects.toThrow("--reactivate");
    expect(f.api.products.update).not.toHaveBeenCalled();
    f.products.set(stableId, productFixture());
    f.prices.set("price_monthly", priceFixture(0, { active: false }));
    await expect(ensureContestStripeCatalog(f.stripe, "live", contest)).rejects.toThrow("--reactivate");
    expect(f.api.prices.create).not.toHaveBeenCalled();
    expect(f.api.prices.update).not.toHaveBeenCalled();
  });

  it("reativa explicitamente, mantendo os IDs e a classificação tributária", async () => {
    const f = fixture();
    f.products.set(stableId, productFixture({ active: false }));
    f.prices.set("price_monthly", priceFixture(0, { active: false, tax_behavior: "inclusive" }));
    await ensureContestStripeCatalog(f.stripe, "live", contest, { reactivate: true });
    expect(f.api.products.create).not.toHaveBeenCalled();
    expect(f.api.products.update.mock.calls[0][1].active).toBe(true);
    expect(f.api.prices.update).toHaveBeenCalledExactlyOnceWith("price_monthly", { active: true });
    expect(f.prices.get("price_monthly")?.tax_behavior).toBe("inclusive");
    expect(f.api.prices.list.mock.calls.some(([params]) => params.active === false)).toBe(true);
  });

  it("preço local compatível sem lookup vigente conserva ID e não ganha outro preço", async () => {
    const f = fixture();
    f.products.set("prod_original", productFixture({ id: "prod_original" }));
    f.prices.set("price_original", priceFixture(0, { id: "price_original", product: "prod_original", lookup_key: null, metadata: {} }));
    f.api.products.search.mockResolvedValue({ data: [], has_more: false });
    const result = await ensureContestStripeCatalog(f.stripe, "live", contest, { knownPriceIds: { monthly: "price_original" } });
    expect(result.productId).toBe("prod_original");
    expect(result.prices[0].priceId).toBe("price_original");
    expect(f.api.prices.create).toHaveBeenCalledTimes(1);
    expect(f.api.products.create).not.toHaveBeenCalled();
  });

  it("preços locais em produtos diferentes bloqueiam antes de qualquer atualização", async () => {
    const f = fixture();
    f.prices.set("price_monthly", priceFixture());
    f.prices.set("price_annual", priceFixture(1, { product: "prod_outro" }));
    await expect(ensureContestStripeCatalog(f.stripe, "live", contest, { knownPriceIds: { monthly: "price_monthly", annual: "price_annual" } })).rejects.toThrow("produtos divergentes");
    expect(f.api.products.create).not.toHaveBeenCalled();
    expect(f.api.products.update).not.toHaveBeenCalled();
  });

  it.each([
    { unit_amount: 1 }, { currency: "usd" }, { livemode: false }, { product: "prod_outro" },
    { type: "one_time" as const }, { billing_scheme: "tiered" as const },
    { unit_amount_decimal: Stripe.Decimal.from("6700.1") }, { transform_quantity: { divide_by: 2, round: "up" as const } },
    { unit_amount_decimal: Stripe.Decimal.from("6700.0000000000001") },
    { custom_unit_amount: { maximum: null, minimum: null, preset: 6700 } },
    { recurring: { ...priceFixture().recurring!, interval: "year" as const } },
    { recurring: { ...priceFixture().recurring!, interval_count: 6 } },
    { recurring: { ...priceFixture().recurring!, usage_type: "metered" as const } },
    { metadata: { ...identity, app: "other" } },
  ])("contrato fixo rejeita preço divergente mesmo com --reactivate: %j", async (overrides) => {
    const f = fixture();
    f.products.set(stableId, productFixture());
    f.prices.set("price_monthly", priceFixture(0, overrides));
    await expect(ensureContestStripeCatalog(f.stripe, "live", contest, { reactivate: true })).rejects.toThrow(/divergente/);
    expect(f.api.prices.update).not.toHaveBeenCalled();
    expect(f.api.prices.create).not.toHaveBeenCalled();
  });

  it("lookup em outro preço e ID local não são conciliados automaticamente", async () => {
    const f = fixture();
    f.products.set(stableId, productFixture());
    f.prices.set("price_original", priceFixture(0, { id: "price_original", lookup_key: null }));
    f.prices.set("price_monthly", priceFixture());
    await expect(ensureContestStripeCatalog(f.stripe, "live", contest, { knownPriceIds: { monthly: "price_original" } })).rejects.toThrow("IDs divergentes");
    expect(f.api.prices.create).not.toHaveBeenCalled();
  });

  it("duplicata entre preço ativo e arquivado é bloqueada", async () => {
    const f = fixture();
    f.products.set(stableId, productFixture());
    f.prices.set("price_monthly", priceFixture());
    f.prices.set("price_archived_duplicate", priceFixture(0, { id: "price_archived_duplicate", active: false }));
    await expect(ensureContestStripeCatalog(f.stripe, "live", contest, { reactivate: true })).rejects.toThrow("duplicado");
    expect(f.api.prices.update).not.toHaveBeenCalled();
  });

  it("opção de moeda estrangeira não é aplicada ao preço BRL contratado", async () => {
    const f = fixture();
    f.products.set(stableId, productFixture());
    f.prices.set("price_monthly", priceFixture(0, { currency_options: {
      usd: { unit_amount: 1500, unit_amount_decimal: Stripe.Decimal.from(1500), custom_unit_amount: null, tax_behavior: "unspecified" },
    } }));
    await expect(ensureContestStripeCatalog(f.stripe, "live", contest)).rejects.toThrow("divergente");
    expect(f.api.prices.create).not.toHaveBeenCalled();
  });

  it("opção BRL com valor divergente é recusada", async () => {
    const f = fixture();
    f.products.set(stableId, productFixture());
    f.prices.set("price_monthly", priceFixture(0, { currency_options: {
      brl: { unit_amount: 1, unit_amount_decimal: Stripe.Decimal.from(1), custom_unit_amount: null, tax_behavior: "unspecified" },
    } }));
    await expect(ensureContestStripeCatalog(f.stripe, "live", contest)).rejects.toThrow("divergente");
    expect(f.api.prices.create).not.toHaveBeenCalled();
  });

  it("resposta de atualização com metadata alterada é recusada", async () => {
    const f = fixture();
    f.products.set(stableId, productFixture({ name: "Antigo" }));
    f.api.products.update.mockResolvedValue(productFixture({ metadata: { ...identity, app: "other" } }));
    await expect(ensureContestStripeCatalog(f.stripe, "live", contest)).rejects.toThrow("Identidade do produto");
    expect(f.api.prices.create).not.toHaveBeenCalled();
  });

  it("resposta de atualização que não confirma a apresentação é recusada", async () => {
    const f = fixture();
    f.products.set(stableId, productFixture({ name: "Antigo" }));
    f.api.products.update.mockResolvedValue(productFixture({ name: "Antigo" }));
    await expect(ensureContestStripeCatalog(f.stripe, "live", contest)).rejects.toThrow("Apresentação do produto");
    expect(f.api.prices.create).not.toHaveBeenCalled();
  });

  it("reativação que troca lookup key na resposta é recusada", async () => {
    const f = fixture();
    f.products.set(stableId, productFixture());
    f.prices.set("price_monthly", priceFixture(0, { active: false }));
    f.api.prices.update.mockResolvedValue(priceFixture(0, { lookup_key: "another_lookup" }));
    await expect(ensureContestStripeCatalog(f.stripe, "live", contest, { reactivate: true })).rejects.toThrow("Reativação do preço");
  });
});
