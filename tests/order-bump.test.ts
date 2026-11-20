import { describe, expect, it } from "vitest";

import { orderBumpApplies, readOrderBumpConfig } from "@/lib/commerce/order-bump";

const valid = JSON.stringify({
  kind: "second_contest",
  headline: "Leve um segundo concurso da mesma carreira",
  priceCents: 1000,
  stripePriceId: "price_TEST12345678",
});

describe("order bump configurável", () => {
  it("desligado por padrão e com configuração inválida", () => {
    expect(readOrderBumpConfig(undefined)).toBeNull();
    expect(readOrderBumpConfig("")).toBeNull();
    expect(readOrderBumpConfig("{nao-json")).toBeNull();
    expect(readOrderBumpConfig(JSON.stringify({ kind: "second_contest", headline: "curto", priceCents: 0, stripePriceId: "x" }))).toBeNull();
  });

  it("lê a configuração válida sem inventar valores", () => {
    expect(readOrderBumpConfig(valid)).toMatchObject({ kind: "second_contest", priceCents: 1000, stripePriceId: "price_TEST12345678" });
  });

  it("só aparece quando faz sentido para o carrinho", () => {
    const config = readOrderBumpConfig(valid);
    expect(orderBumpApplies(config, { contestCount: 1, hasMaster: false, maxContests: 3 })).toBe(true);
    expect(orderBumpApplies(config, { contestCount: 3, hasMaster: false, maxContests: 3 })).toBe(false);
    expect(orderBumpApplies(config, { contestCount: 1, hasMaster: true, maxContests: 3 })).toBe(false);
    expect(orderBumpApplies(null, { contestCount: 1, hasMaster: false, maxContests: 3 })).toBe(false);
  });
});
