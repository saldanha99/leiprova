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

  it("publica apenas os preços comerciais aprovados", () => {
    expect(getPlan("ritmo")?.priceCents).toBe(29700);
    expect(getPlan("foco")?.priceCents).toBe(89700);
    expect(getPlan("foco")?.equivalentMonthly).toBe("equivale a R$ 74,75/mês");
  });

  it("formata valores em reais", () => {
    expect(formatBRL(89700)).toContain("897,00");
  });
});
