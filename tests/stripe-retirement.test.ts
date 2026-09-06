import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { retireStripeCatalog as retireAuthorizedCatalog, verifyAuthorizedUiBytes,
  type RetirementEvent, type StripeRetirementClient } from "@/lib/commerce/stripe-retirement";
import { createStripeRetirementOperator } from "@/lib/commerce/stripe-retirement-core";
import { LEIPROVA_STRIPE_ACCOUNT } from "@/lib/commerce/stripe-inventory";

const AUTHORIZED_ACTIVE_PRODUCT_IDS = Array.from({ length: 19 }, (_, index) => `prod_synthetic_old_${index}`);
const PRESERVED_ARCHIVED_PRODUCT_IDS = Array.from({ length: 4 }, (_, index) => `prod_synthetic_archived_${index}`);

function fixture() {
  const now = Date.parse("2026-09-06T20:00:00Z");
  const ui = { accountId: LEIPROVA_STRIPE_ACCOUNT, observedOn: "2026-09-06", counts: { products: 23, active: 19, archived: 4 },
    products: [...AUTHORIZED_ACTIVE_PRODUCT_IDS.map((id) => ({ id, name: `Nome sintético ${id}`, active: true })),
      ...PRESERVED_ARCHIVED_PRODUCT_IDS.map((id) => ({ id, name: `Nome sintético ${id}`, active: false }))] };
  const prices = AUTHORIZED_ACTIVE_PRODUCT_IDS.map((id, index) => ({ id: `price_fixture${index}`, productId: id, active: true }));
  const api = { schemaVersion: 1, accountId: LEIPROVA_STRIPE_ACCOUNT, stripeMode: "live", readOnly: true, remoteWrites: false,
    atomicSnapshot: false, completedAt: new Date(now).toISOString(), coverage: { prices: "catalog_prices_excluding_inline_prices",
      subscriptions: "standard_live_subscriptions", paymentLinks: "active_only", checkoutSessions: "open_only" },
    products: [...ui.products.map((product) => ({ ...product })), { id: "prod_NEW_EDITALUME", name: "Novo produto", active: true }],
    prices: [...prices, { id: "price_new", productId: "prod_NEW_EDITALUME", active: true },
      { id: "price_preserved", productId: PRESERVED_ARCHIVED_PRODUCT_IDS[0], active: true }],
    paymentLinks: [] as unknown[], checkoutSessions: [] as unknown[], subscriptionReferences: [] };
  const uiText = JSON.stringify(ui);
  // Hash apenas da fixture sintética; não há override na fachada de produção nem no CLI.
  const operator = createStripeRetirementOperator(createHash("sha256").update(uiText).digest("hex"));
  const plan = operator.buildStripeRetirementPlan(uiText, api, now);
  const products = new Map<string, { id: string; name: string; active: boolean; livemode: boolean }>(
    ui.products.map((product) => [product.id, { ...product, livemode: true }]));
  const remotePrices = new Map(prices.map((price) => [price.id, { ...price, livemode: true }]));
  const events: RetirementEvent[] = [];
  const record = vi.fn(async (event: RetirementEvent) => { events.push(event); });
  const client = {
    accountId: vi.fn(async () => LEIPROVA_STRIPE_ACCOUNT),
    hasActiveLinksOrOpenSessions: vi.fn(async () => false),
    product: vi.fn(async (id: string) => ({ ...products.get(id)! })),
    price: vi.fn(async (id: string) => ({ ...remotePrices.get(id)! })),
    productPrices: vi.fn(async (id: string) => [...remotePrices.values()].filter((price) => price.productId === id)),
    archiveProduct: vi.fn(async (id: string) => { products.get(id)!.active = false; }),
    archivePrice: vi.fn(async (id: string) => { remotePrices.get(id)!.active = false; }),
  } satisfies StripeRetirementClient;
  const run = (writer = record) => operator.retireStripeCatalog(uiText, api, client, writer, now);
  return { now, ui, uiText, api, plan, products, remotePrices, events, record, client, run, operator };
}

describe("arquivamento limitado aos 19 produtos autorizados", () => {
  it("exclui os quatro já arquivados e todos os produtos novos, inclusive seus preços", () => {
    const { plan } = fixture();
    expect(plan.products.map((product) => product.id)).toEqual(AUTHORIZED_ACTIVE_PRODUCT_IDS);
    expect(plan.preservedProductIds).toEqual(PRESERVED_ARCHIVED_PRODUCT_IDS);
    expect(plan.excludedOtherProducts).toBe(1);
    expect(plan.products.flatMap((product) => product.prices).map((price) => price.id)).not.toContain("price_new");
    expect(plan.products.flatMap((product) => product.prices).map((price) => price.id)).not.toContain("price_preserved");
  });
  it("recusa bytes de UI não autorizados", () => { expect(() => verifyAuthorizedUiBytes("{}")).toThrow("Snapshot UI"); });
  it.each(["ui-account", "api-account", "test", "stale", "future", "ui-id", "name", "missing", "duplicate", "links", "sessions"])("recusa inventário impróprio: %s", (scenario) => {
    const { ui, api, now, operator } = fixture();
    if (scenario === "ui-account") ui.accountId = "acct_other";
    if (scenario === "api-account") api.accountId = "acct_other";
    if (scenario === "test") api.stripeMode = "test";
    if (scenario === "stale") api.completedAt = new Date(now - 25 * 60 * 60_000).toISOString();
    if (scenario === "future") api.completedAt = new Date(now + 5 * 60_000).toISOString();
    if (scenario === "ui-id") ui.products[0].id = "prod_other" as typeof ui.products[number]["id"];
    if (scenario === "name") api.products[0].name = "Nome mudou";
    if (scenario === "missing") api.products.shift();
    if (scenario === "duplicate") api.prices.push(api.prices[0]);
    if (scenario === "links") api.paymentLinks.push({ id: "plink_fixture" });
    if (scenario === "sessions") api.checkoutSessions.push({ id: "cs_fixture" });
    expect(() => operator.buildStripeRetirementPlan(JSON.stringify(ui), api, now)).toThrow();
  });
  it("arquiva somente o escopo, com intent durável antes de cada escrita e releitura depois", async () => {
    const { client, record, events, run } = fixture();
    await run();
    expect(client.archiveProduct).toHaveBeenCalledTimes(19);
    expect(client.archivePrice).toHaveBeenCalledTimes(19);
    expect(events).toHaveLength(76);
    for (let index = 0; index < events.length; index += 2) {
      expect(events[index].event).toBe("intent"); expect(events[index + 1].event).toBe("confirmed");
      expect(events[index].id).toBe(events[index + 1].id);
    }
    expect(record.mock.invocationCallOrder[0]).toBeLessThan(client.archivePrice.mock.invocationCallOrder[0]);
    expect(client.price.mock.calls.length).toBeGreaterThan(19 * 2);
  });
  it.each(["account", "links", "product-mode", "price-owner", "new-price"])("divergência remota bloqueia antes da primeira escrita: %s", async (scenario) => {
    const { client, products, remotePrices, run } = fixture();
    if (scenario === "account") client.accountId.mockResolvedValue("acct_other");
    if (scenario === "links") client.hasActiveLinksOrOpenSessions.mockResolvedValue(true);
    if (scenario === "product-mode") products.get(AUTHORIZED_ACTIVE_PRODUCT_IDS[18])!.livemode = false;
    if (scenario === "price-owner") remotePrices.get("price_fixture18")!.productId = "prod_other" as typeof AUTHORIZED_ACTIVE_PRODUCT_IDS[number];
    if (scenario === "new-price") remotePrices.set("price_extra", { id: "price_extra", productId: AUTHORIZED_ACTIVE_PRODUCT_IDS[18], active: true, livemode: true });
    await expect(run()).rejects.toThrow();
    expect(client.archiveProduct).not.toHaveBeenCalled(); expect(client.archivePrice).not.toHaveBeenCalled();
  });
  it("falha de recibo impede a mutação", async () => {
    const { client, record, run } = fixture();
    record.mockRejectedValue(new Error("disk"));
    await expect(run()).rejects.toThrow("disk");
    expect(client.archivePrice).not.toHaveBeenCalled(); expect(client.archiveProduct).not.toHaveBeenCalled();
  });
  it("retoma resposta incerta por releitura, sem repetir arquivamento já efetivo", async () => {
    const { client, remotePrices, events, run } = fixture();
    client.archivePrice.mockImplementationOnce(async (id) => { remotePrices.get(id)!.active = false; throw new Error("network"); });
    await expect(run()).rejects.toThrow("network");
    expect(events).toEqual([{ event: "intent", kind: "price", id: "price_fixture0", productId: AUTHORIZED_ACTIVE_PRODUCT_IDS[0] }]);
    await run();
    expect(events.some((event) => event.id === "price_fixture0" && event.event === "already_archived")).toBe(true);
    expect(client.archivePrice.mock.calls.filter(([id]) => id === "price_fixture0")).toHaveLength(1);
  });
  it("bloqueia checkout surgido depois do preflight", async () => {
    const { client, run } = fixture();
    client.hasActiveLinksOrOpenSessions.mockResolvedValueOnce(false).mockResolvedValue(true);
    await expect(run()).rejects.toThrow("Checkout");
    expect(client.archivePrice).not.toHaveBeenCalled(); expect(client.archiveProduct).not.toHaveBeenCalled();
  });
  it("falha se a API não confirmar active=false", async () => {
    const { client, events, run } = fixture();
    client.archivePrice.mockImplementation(async () => {});
    await expect(run()).rejects.toThrow("não confirmado");
    expect(events.every((event) => event.event !== "confirmed")).toBe(true);
  });
  it("fachada live reautentica os bytes e não aceita snapshot sintético nem plano arbitrário", async () => {
    const { uiText, api, plan, client, record } = fixture();
    await expect(retireAuthorizedCatalog(uiText, api, client, record)).rejects.toThrow("Snapshot UI");
    await expect(retireAuthorizedCatalog(JSON.stringify(plan), api, client, record)).rejects.toThrow("Snapshot UI");
    expect(client.accountId).not.toHaveBeenCalled();
    expect(client.archiveProduct).not.toHaveBeenCalled(); expect(client.archivePrice).not.toHaveBeenCalled();
  });
  it("plano retornado não amplia execução: a função reconstrói escopo dos bytes autenticados", async () => {
    const { plan, run, client } = fixture();
    plan.products.push({ id: "prod_unapproved", name: "Intruso", prices: [] });
    await run();
    expect(client.archiveProduct.mock.calls.some(([id]) => id === "prod_unapproved")).toBe(false);
    expect(client.archiveProduct).toHaveBeenCalledTimes(19);
  });
  it("operador não contém exclusão nem mutações em checkout ou faturamento", () => {
    const source = readFileSync(new URL("../scripts/retire-stripe-catalog.ts", import.meta.url), "utf8");
    expect(source).not.toMatch(/stripe\.(?:subscriptions|refunds|charges|customers|invoices)\./);
    expect(source).not.toMatch(/stripe\.[\w.]+\.(?:del|delete|cancel|expire|create)\(/);
    expect(source).toContain("stripe.products.update(id, { active: false }, { idempotencyKey })");
    expect(source).toContain("stripe.prices.update(id, { active: false }, { idempotencyKey })");
    expect(source).toContain('if (!args.includes("--apply"))');
    expect(source).toContain("await receipt.sync()");
    expect(source).toContain("0o600");
  });
});
