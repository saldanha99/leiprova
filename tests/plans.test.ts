import { describe, expect, it } from "vitest";

import {
  PLANS,
  RETIRED_PLAN_SLUGS,
  formatBRL,
  getAnnualDiscountPercentage,
  getMonthlyEquivalentCents,
  getPlan,
} from "@/lib/plans";

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
  });

  it("calcula a equivalência mensal do ciclo anual sem alterar a cobrança total", () => {
    const monthly = getPlan("ritmo");
    const annual = getPlan("foco");

    expect(monthly?.billingMonths).toBe(1);
    expect(annual?.billingMonths).toBe(12);
    expect(monthly && getMonthlyEquivalentCents(monthly)).toBe(29700);
    expect(annual && getMonthlyEquivalentCents(annual)).toBe(7475);
    expect(annual?.priceCents).toBe(89700);
  });

  it("calcula o desconto anual a partir dos preços aprovados", () => {
    expect(getAnnualDiscountPercentage()).toBe(75);
  });

  it("formata valores em reais", () => {
    expect(formatBRL(89700)).toContain("897,00");
  });
});
