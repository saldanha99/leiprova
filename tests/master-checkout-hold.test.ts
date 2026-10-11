import { readFileSync } from "node:fs";

import { afterEach, describe, expect, it, vi } from "vitest";

const storeMock = vi.hoisted(() => ({ listReleasedContestProducts: vi.fn() }));
vi.mock("@/lib/commerce/store", () => storeMock);

import {
  getMasterCheckoutAvailability,
  isMasterCheckoutEnabled,
  isMasterCommerceOpen,
  masterOpensWithReleasedContests,
} from "@/lib/commerce/master-gate";
import { isCommerceOpen } from "@/lib/launch";
import { isContestCheckoutEnabled, masterCheckoutMode } from "@/lib/stripe";

const read = (path: string) => readFileSync(path, "utf8");
const released = (count: number) => Array.from({ length: count }, (_, index) => ({ slug: `concurso-${index}` }));

afterEach(() => {
  vi.unstubAllEnvs();
  storeMock.listReleasedContestProducts.mockReset();
});

describe("Master fechado com a venda por concurso aberta (decisão de 28/09/2026)", () => {
  it("exige chave própria além do checkout geral", async () => {
    vi.stubEnv("CHECKOUT_ENABLED", "true");
    vi.stubEnv("CONTEST_CHECKOUT_ENABLED", "true");
    vi.stubEnv("MASTER_CHECKOUT_ENABLED", "false");

    expect(isContestCheckoutEnabled()).toBe(true);
    expect(await isMasterCheckoutEnabled()).toBe(false);
    expect(await getMasterCheckoutAvailability({ stripePriceEnv: "STRIPE_PRICE_FOCO" })).toEqual({
      available: false,
      reason: "disabled",
    });

    vi.stubEnv("MASTER_CHECKOUT_ENABLED", "true");
    expect(await isMasterCheckoutEnabled()).toBe(true);
    vi.stubEnv("CHECKOUT_ENABLED", "false");
    expect(masterCheckoutMode()).toBe("closed");
    expect(await isMasterCheckoutEnabled()).toBe(false);
    // A chave fixa não consulta o catálogo.
    expect(storeMock.listReleasedContestProducts).not.toHaveBeenCalled();
  });

  it("mantém as ofertas do Master como prévia enquanto a jornada por concurso abre", async () => {
    vi.stubEnv("REGISTRATION_ENABLED", "true");
    vi.stubEnv("CHECKOUT_ENABLED", "true");
    vi.stubEnv("TRANSACTIONAL_EMAIL_ENABLED", "true");
    vi.stubEnv("MASTER_CHECKOUT_ENABLED", "");

    expect(isCommerceOpen()).toBe(true);
    expect(await isMasterCommerceOpen()).toBe(false);
    vi.stubEnv("MASTER_CHECKOUT_ENABLED", "true");
    expect(await isMasterCommerceOpen()).toBe(true);
  });

  it("aplica a chave do Master em todas as entradas de compra do Master", () => {
    for (const path of [
      "src/app/checkout/[slug]/page.tsx",
      "src/app/api/stripe/checkout/route.ts",
      "src/app/actions/auth.ts",
    ]) {
      const source = read(path);
      expect(source).toContain("await getMasterCheckoutAvailability(plan)");
      expect(source).not.toMatch(/\bgetCheckoutAvailability\(plan\)/u);
    }
    expect(read("src/app/page.tsx")).toContain("const commerceOpen = await isMasterCommerceOpen();");
    expect(read("src/app/(auth)/cadastro/page.tsx")).toContain(
      "(await isMasterCheckoutEnabled()) ? getPlan(params.plano) : null",
    );
    expect(read("src/app/checkout/concurso/[slug]/page.tsx")).toContain(
      "masterOpen={await isMasterCheckoutEnabled()}",
    );
    expect(read("src/components/checkout/contest-cart.tsx")).toContain("{masterOpen && (");
    expect(read("src/components/contests/contest-pricing.tsx")).toContain(
      "contestPlanCta(plan, masterOpen, contactOpen)",
    );
    const contestPage = read("src/app/concursos/[categoria]/[uf]/[slug]/page.tsx");
    expect(contestPage).toContain("const masterOpen = await isMasterCommerceOpen();");
    expect(contestPage.match(/masterOpen=\{masterOpen\}/gu)).toHaveLength(2);
  });
});

describe("Master automático com 3 concursos à venda (decisão de 11/10/2026)", () => {
  it("abre a partir do terceiro concurso liberado", () => {
    expect(masterOpensWithReleasedContests(0)).toBe(false);
    expect(masterOpensWithReleasedContests(2)).toBe(false);
    expect(masterOpensWithReleasedContests(3)).toBe(true);
    expect(masterOpensWithReleasedContests(12)).toBe(true);
  });

  it("conta os concursos à venda só no modo automático", async () => {
    vi.stubEnv("REGISTRATION_ENABLED", "true");
    vi.stubEnv("CHECKOUT_ENABLED", "true");
    vi.stubEnv("TRANSACTIONAL_EMAIL_ENABLED", "true");
    vi.stubEnv("MASTER_CHECKOUT_ENABLED", " Auto ");
    expect(masterCheckoutMode()).toBe("auto");

    storeMock.listReleasedContestProducts.mockResolvedValue(released(2));
    expect(await isMasterCommerceOpen()).toBe(false);
    expect(await getMasterCheckoutAvailability({ stripePriceEnv: "STRIPE_PRICE_FOCO" })).toEqual({
      available: false,
      reason: "disabled",
    });

    storeMock.listReleasedContestProducts.mockResolvedValue(released(3));
    expect(await isMasterCheckoutEnabled()).toBe(true);
    expect(await isMasterCommerceOpen()).toBe(true);
  });

  it("falha fechado quando o catálogo não pode ser lido ou o checkout está fechado", async () => {
    vi.stubEnv("CHECKOUT_ENABLED", "true");
    vi.stubEnv("MASTER_CHECKOUT_ENABLED", "auto");
    storeMock.listReleasedContestProducts.mockRejectedValue(new Error("banco indisponível"));
    expect(await isMasterCheckoutEnabled()).toBe(false);

    storeMock.listReleasedContestProducts.mockReset();
    storeMock.listReleasedContestProducts.mockResolvedValue(released(5));
    vi.stubEnv("CHECKOUT_ENABLED", "false");
    expect(await isMasterCheckoutEnabled()).toBe(false);
    expect(storeMock.listReleasedContestProducts).not.toHaveBeenCalled();
  });
});

describe("prova anterior na venda por concurso", () => {
  it("exige o link oficial aprovado em vez da prova licenciada importada", () => {
    const store = read("src/lib/commerce/store.ts");
    // Prova anterior aprovada ou dispensa registrada (decisão de 11/10/2026).
    expect(store.match(/productPreviousExamRequirementMet\(/gu)).toHaveLength(3);
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
