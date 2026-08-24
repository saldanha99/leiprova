import { describe, expect, it } from "vitest";

import { PLANS, RETIRED_PLAN_SLUGS, formatBRL, getPlan } from "@/lib/plans";

describe("plans", () => {
  it("usa slugs e variáveis Stripe únicas", () => {
    expect(new Set(PLANS.map((plan) => plan.slug)).size).toBe(PLANS.length);
    expect(new Set(PLANS.map((plan) => plan.stripePriceEnv)).size).toBe(PLANS.length);
  });

  it("não aceita um plano arbitrário enviado pelo navegador", () => {
    expect(getPlan("foco")?.name).toBe("Foco Anual");
    expect(getPlan("plano-inventado")).toBeNull();
  });

  it("mantém o plano vitalício retirado do catálogo e do checkout", () => {
    expect(PLANS).toHaveLength(2);
    expect(PLANS.map((plan) => plan.slug)).toEqual(["ritmo", "foco"]);
    expect(PLANS.some((plan) => plan.stripePriceEnv.includes("FUNDADOR"))).toBe(false);
    expect(RETIRED_PLAN_SLUGS).toContain("fundador");
    expect(getPlan("fundador")).toBeNull();
  });

  it("formata valores em reais", () => {
    expect(formatBRL(49700)).toContain("497,00");
  });
});
