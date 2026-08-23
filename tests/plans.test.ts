import { describe, expect, it } from "vitest";

import { PLANS, formatBRL, getPlan } from "@/lib/plans";

describe("plans", () => {
  it("usa slugs e variáveis Stripe únicas", () => {
    expect(new Set(PLANS.map((plan) => plan.slug)).size).toBe(PLANS.length);
    expect(new Set(PLANS.map((plan) => plan.stripePriceEnv)).size).toBe(PLANS.length);
  });

  it("não aceita um plano arbitrário enviado pelo navegador", () => {
    expect(getPlan("foco")?.mode).toBe("subscription");
    expect(getPlan("plano-inventado")).toBeNull();
  });

  it("formata valores em reais", () => {
    expect(formatBRL(49700)).toContain("497,00");
  });
});
