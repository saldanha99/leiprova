import { describe, expect, it } from "vitest";
import type Stripe from "stripe";
import { mkdir, mkdtemp, realpath, rm, stat, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { collectInventory, inventoryCoverage, inventoryLineItems, inventoryPrice, inventoryProduct,
  LEIPROVA_STRIPE_ACCOUNT, requireInventoryMode, resolveStripeInventoryDirectory, validateInventoryTarget } from "../src/lib/commerce/stripe-inventory";

async function* rows(ids: string[]) { for (const id of ids) yield { id }; }

describe("inventário privado Stripe somente leitura", () => {
  it("exige a conta autorizada e chave do modo selecionado", () => {
    expect(validateInventoryTarget("rk_live_fixture", "live", LEIPROVA_STRIPE_ACCOUNT).mode).toBe("live");
    expect(() => validateInventoryTarget("rk_test_fixture", "live", LEIPROVA_STRIPE_ACCOUNT)).toThrow();
    expect(() => validateInventoryTarget("rk_live_fixture", "live", "acct_other")).toThrow();
    expect(() => validateInventoryTarget("rk_live_fixture", "live")).toThrow();
    expect(() => validateInventoryTarget("rk_live_fixture", "wrong", LEIPROVA_STRIPE_ACCOUNT)).toThrow();
  });
  it("percorre páginas e não aceita truncamento silencioso", async () => {
    expect(await collectInventory(rows(["1", "2", "3"]), 3)).toHaveLength(3);
    await expect(collectInventory(rows(["1", "2", "3"]), 2)).rejects.toThrow("limite");
    await expect(collectInventory(rows([]), 0)).rejects.toThrow();
  });
  it("recusa identidade duplicada e erro ocorrido numa página tardia", async () => {
    await expect(collectInventory(rows(["1", "1"]))).rejects.toThrow("repetiu");
    async function* interrupted() { yield { id: "1" }; throw new Error("interrompido"); }
    await expect(collectInventory(interrupted())).rejects.toThrow("interrompido");
  });
  it("recusa objetos de outro modo", () => {
    expect(() => requireInventoryMode({ livemode: false }, "live")).toThrow();
    expect(() => requireInventoryMode({ livemode: true }, "live")).not.toThrow();
  });
  it("explicita exclusões e limite por coleção, sem alegar auditoria financeira completa", () => {
    expect(inventoryCoverage("test").subscriptions).toBe("excluding_test_clock_subscriptions");
    expect(inventoryCoverage("live").prices).toBe("catalog_prices_excluding_inline_prices");
    expect(inventoryCoverage("live").atomicSnapshot).toBe(false);
    expect(inventoryCoverage("live").limitPerCollection).toBe(10_000);
  });
  it.each(["valid", "base-symlink", "child-symlink"])("valida destino privado: %s", async (scenario) => {
    const temporary = await realpath(await mkdtemp(path.join(tmpdir(), "leiprova-stripe-inventory-test-")));
    try {
      await mkdir(path.join(temporary, ".local"));
      const outside = path.join(temporary, "outside");
      await mkdir(outside);
      const base = path.join(temporary, ".local", "commerce");
      if (scenario === "base-symlink") await symlink(outside, base);
      else {
        await mkdir(base);
        if (scenario === "child-symlink") await symlink(outside, path.join(base, "stripe-inventory"));
      }
      if (scenario === "valid") {
        const directory = await resolveStripeInventoryDirectory(temporary);
        expect(directory).toBe(path.join(base, "stripe-inventory"));
        expect((await stat(directory)).mode & 0o777).toBe(0o700);
      } else await expect(resolveStripeInventoryDirectory(temporary)).rejects.toThrow("redirecionada");
    } finally { await rm(temporary, { recursive: true, force: true }); }
  });
  it("não copia metadata arbitrária ou imagens potencialmente privadas", () => {
    const product = { id: "prod_1", name: "Produto", active: true, created: 1,
      metadata: { app: "leiprova", commerce: "contest_v1", slug: "exemplo", private_token: "do-not-export" },
      images: ["https://example.invalid/private?secret=example"] } as unknown as Stripe.Product;
    const value = inventoryProduct(product);
    expect(value.imageCount).toBe(1);
    expect(JSON.stringify(value)).not.toContain("secret");
    expect(JSON.stringify(value)).not.toContain("do-not-export");
  });
  it("normaliza referências de produto expandido sem copiar dados relacionados", () => {
    const price = { id: "price_1", product: { id: "prod_1", private: "not-exported" }, active: false,
      type: "recurring", currency: "brl", unit_amount: 6700, recurring: { interval: "month", interval_count: 1 },
      lookup_key: "leiprova-example" } as unknown as Stripe.Price;
    expect(inventoryPrice(price)).toMatchObject({ productId: "prod_1", active: false, amountCents: 6700 });
    expect(JSON.stringify(inventoryPrice(price))).not.toContain("not-exported");
    const lines = [{ id: "li_1", quantity: 1, price }, { id: "li_2", quantity: null, price: null }] as Stripe.LineItem[];
    expect(inventoryLineItems(lines)).toEqual([
      { id: "li_1", quantity: 1, priceId: "price_1", productId: "prod_1" },
      { id: "li_2", quantity: null, priceId: null, productId: null },
    ]);
  });
});
