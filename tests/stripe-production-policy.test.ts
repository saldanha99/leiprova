import { describe, expect, it } from "vitest";
import {
  expectedStripeMode,
  stripeCredentialsMatchMode,
  validateStripeSyncTarget,
} from "@/lib/commerce/stripe-mode-policy";

describe("separação Stripe teste/produção", () => {
  it("produção exige live por padrão", () => {
    expect(expectedStripeMode({ NODE_ENV: "production" })).toBe("live");
    expect(
      stripeCredentialsMatchMode(
        { NODE_ENV: "production" },
        "sk_test_example",
        "pk_test_example",
      ),
    ).toBe(false);
  });
  it("homologação aceita teste explicitamente", () => {
    expect(
      stripeCredentialsMatchMode(
        {
          NODE_ENV: "production",
          STRIPE_PAYMENTS_MODE: "test",
          APP_URL: "https://staging.example.invalid",
        },
        "rk_test_example",
        "pk_test_example",
      ),
    ).toBe(true);
  });
  it("domínio público recusa teste mesmo explicitamente", () => {
    expect(
      expectedStripeMode({
        APP_URL: "https://leiprova.2b.app.br",
        STRIPE_PAYMENTS_MODE: "test",
      }),
    ).toBeNull();
    expect(
      expectedStripeMode({
        NEXT_PUBLIC_APP_URL: "https://leiprova.2b.app.br",
        STRIPE_PAYMENTS_MODE: "test",
      }),
    ).toBeNull();
  });
  it("recusa mistura de chaves, modo inválido e URL inválida", () => {
    expect(
      stripeCredentialsMatchMode(
        { STRIPE_PAYMENTS_MODE: "live" },
        "rk_live_example",
        "pk_test_example",
      ),
    ).toBe(false);
    expect(
      stripeCredentialsMatchMode(
        { STRIPE_PAYMENTS_MODE: "invalid" },
        "rk_test_example",
      ),
    ).toBe(false);
    expect(expectedStripeMode({ APP_URL: "invalid" })).toBeNull();
    expect(
      stripeCredentialsMatchMode(
        { STRIPE_PAYMENTS_MODE: "live" },
        "rk_live_example",
        "pk_live_example",
      ),
    ).toBe(true);
  });
  const live = {
    mode: "live",
    secretKey: "rk_live_example",
    environment: "production",
    databaseUrl: "postgres://owner:example@db:5432/leiprova",
    expectedAccount: "acct_expected",
    appUrl: "https://leiprova.2b.app.br",
  };
  it("sincronização live requer conta e destino explícitos", () => {
    expect(validateStripeSyncTarget(live).mode).toBe("live");
    for (const missing of [
      "environment",
      "databaseUrl",
      "expectedAccount",
      "appUrl",
    ] as const)
      expect(() =>
        validateStripeSyncTarget({ ...live, [missing]: undefined }),
      ).toThrow();
  });
  it("recusa segredo test em live e banco de outro projeto", () => {
    expect(() =>
      validateStripeSyncTarget({ ...live, secretKey: "sk_test_example" }),
    ).toThrow();
    expect(() =>
      validateStripeSyncTarget({
        ...live,
        databaseUrl: "postgres://owner:example@db/outro-projeto",
      }),
    ).toThrow();
    expect(() =>
      validateStripeSyncTarget({ ...live, mode: "invalid" }),
    ).toThrow();
  });
  it("simulação de teste nunca aceita ambiente production", () => {
    expect(() =>
      validateStripeSyncTarget({
        ...live,
        mode: "test",
        secretKey: "sk_test_example",
      }),
    ).toThrow();
    expect(() =>
      validateStripeSyncTarget({
        ...live,
        mode: "test",
        secretKey: "sk_test_example",
        environment: "staging",
      }),
    ).toThrow();
    expect(
      validateStripeSyncTarget({
        ...live,
        mode: "test",
        secretKey: "sk_test_example",
        environment: "staging",
        databaseUrl: "postgres://owner:example@db/leiprova_staging",
      }).mode,
    ).toBe("test");
  });
});
