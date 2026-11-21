import { readFileSync } from "node:fs";

import { describe, expect, it, vi } from "vitest";

import { staleWhileRevalidate } from "@/lib/commerce/stale-while-revalidate";

describe("cache da vitrine (stale-while-revalidate)", () => {
  it("espera só na primeira leitura e serve da memória dentro do prazo", async () => {
    let clock = 0;
    const loader = vi.fn(async () => ["a"]);
    const read = staleWhileRevalidate(loader, 1000, () => clock);
    expect(await read()).toEqual(["a"]);
    clock = 999;
    expect(await read()).toEqual(["a"]);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("vencido: responde o valor antigo na hora e recalcula uma vez em segundo plano", async () => {
    let clock = 0;
    let version = 0;
    let release: () => void = () => undefined;
    const loader = vi.fn(() => new Promise<number>((resolve) => {
      version += 1;
      const current = version;
      if (current === 1) resolve(current);
      else release = () => resolve(current);
    }));
    const read = staleWhileRevalidate(loader, 1000, () => clock);
    expect(await read()).toBe(1);
    clock = 5000;
    expect(await read()).toBe(1);
    expect(await read()).toBe(1);
    expect(loader).toHaveBeenCalledTimes(2);
    release();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(await read()).toBe(2);
  });

  it("falha no recálculo mantém o último valor bom; sem valor, propaga o erro", async () => {
    let clock = 0;
    let fail = false;
    const read = staleWhileRevalidate(async () => {
      if (fail) throw new Error("db");
      return "ok";
    }, 1000, () => clock);
    expect(await read()).toBe("ok");
    fail = true;
    clock = 5000;
    expect(await read()).toBe("ok");
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(await read()).toBe("ok");
    const cold = staleWhileRevalidate(async () => { throw new Error("db"); }, 1000);
    await expect(cold()).rejects.toThrow("db");
  });

  it("invalidate força nova leitura", async () => {
    const loader = vi.fn(async () => 1);
    const read = staleWhileRevalidate(loader, 60_000);
    await read();
    read.invalidate();
    await read();
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it("a vitrine usa o cache de 5 min e a venda continua revalidando", () => {
    const store = readFileSync(new URL("../src/lib/commerce/store.ts", import.meta.url), "utf8");
    expect(store).toContain("RELEASED_PRODUCTS_CACHE_TTL_MS = 5 * 60_000");
    expect(store).toContain("staleWhileRevalidate(");
    expect(store).toContain("export async function hasSellableContestProductCoverage(");
  });
});
