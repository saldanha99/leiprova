import { readFileSync } from "node:fs";

import { afterEach, describe, expect, it, vi } from "vitest";

import { isCommerceOpen, isMasterCommerceOpen } from "@/lib/launch";
import {
  getMasterCheckoutAvailability,
  isContestCheckoutEnabled,
  isMasterCheckoutEnabled,
} from "@/lib/stripe";

const read = (path: string) => readFileSync(path, "utf8");

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Master fechado com a venda por concurso aberta (decisão de 28/09/2026)", () => {
  it("exige chave própria além do checkout geral", () => {
    vi.stubEnv("CHECKOUT_ENABLED", "true");
    vi.stubEnv("CONTEST_CHECKOUT_ENABLED", "true");
    vi.stubEnv("MASTER_CHECKOUT_ENABLED", "false");

    expect(isContestCheckoutEnabled()).toBe(true);
    expect(isMasterCheckoutEnabled()).toBe(false);
    expect(getMasterCheckoutAvailability({ stripePriceEnv: "STRIPE_PRICE_FOCO" })).toEqual({
      available: false,
      reason: "disabled",
    });

    vi.stubEnv("MASTER_CHECKOUT_ENABLED", "true");
    expect(isMasterCheckoutEnabled()).toBe(true);
    vi.stubEnv("CHECKOUT_ENABLED", "false");
    expect(isMasterCheckoutEnabled()).toBe(false);
  });

  it("mantém as ofertas do Master como prévia enquanto a jornada por concurso abre", () => {
    vi.stubEnv("REGISTRATION_ENABLED", "true");
    vi.stubEnv("CHECKOUT_ENABLED", "true");
    vi.stubEnv("TRANSACTIONAL_EMAIL_ENABLED", "true");
    vi.stubEnv("MASTER_CHECKOUT_ENABLED", "");

    expect(isCommerceOpen()).toBe(true);
    expect(isMasterCommerceOpen()).toBe(false);
    vi.stubEnv("MASTER_CHECKOUT_ENABLED", "true");
    expect(isMasterCommerceOpen()).toBe(true);
  });

  it("aplica a chave do Master em todas as entradas de compra do Master", () => {
    for (const path of [
      "src/app/checkout/[slug]/page.tsx",
      "src/app/api/stripe/checkout/route.ts",
      "src/app/actions/auth.ts",
    ]) {
      const source = read(path);
      expect(source).toContain("getMasterCheckoutAvailability(plan)");
      expect(source).not.toMatch(/\bgetCheckoutAvailability\(plan\)/u);
    }
    expect(read("src/app/page.tsx")).toContain("const commerceOpen = isMasterCommerceOpen();");
    expect(read("src/app/(auth)/cadastro/page.tsx")).toContain(
      "isMasterCheckoutEnabled() ? getPlan(params.plano) : null",
    );
    expect(read("src/components/checkout/contest-cart.tsx")).toContain("{masterOpen && (");
    expect(read("src/components/contests/contest-pricing.tsx")).toContain(
      "contestPlanCta(plan, masterOpen, contactOpen)",
    );
    expect(read("src/app/concursos/[categoria]/[uf]/[slug]/page.tsx").match(/masterOpen=\{isMasterCommerceOpen\(\)\}/gu)).toHaveLength(2);
  });
});

describe("prova anterior na venda por concurso", () => {
  it("exige o link oficial aprovado em vez da prova licenciada importada", () => {
    const store = read("src/lib/commerce/store.ts");
    expect(store.match(/approvedProductPreviousExamReferenceExists\(/gu)).toHaveLength(3);
    expect(store).not.toContain("licensedPreviousExamContentSatisfied");
    // A cobertura do período pago continua chegando até a checagem do link.
    expect(store).toContain("sql`${coverageEndsAt.toISOString()}::timestamptz`,\n        ),");
  });

  it("só libera questões da prova anterior com licença, pela entrega", () => {
    const entitlement = read("src/lib/study/entitlement.ts");
    expect(entitlement).toContain("licensedPreviousExamContentSatisfied(");
    expect(entitlement).toContain("approvedProductPreviousExamQuestionExists(");
  });
});
