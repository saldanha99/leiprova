import { readFileSync } from "node:fs";

import Stripe from "stripe";
import { describe, expect, it } from "vitest";

import { checkoutPaymentMethodTypes } from "@/lib/stripe";

describe("formas de pagamento do checkout", () => {
  it("padrão continua só cartão", () => {
    expect(checkoutPaymentMethodTypes(undefined)).toEqual(["card"]);
    expect(checkoutPaymentMethodTypes("")).toEqual(["card"]);
  });

  it("liga Pix junto do cartão e ignora valores desconhecidos", () => {
    expect(checkoutPaymentMethodTypes("card,pix")).toEqual(["card", "pix"]);
    expect(checkoutPaymentMethodTypes(" PIX , card ,pix")).toEqual(["pix", "card"]);
    expect(checkoutPaymentMethodTypes("boleto,bitcoin")).toEqual(["card"]);
  });

  it("as duas rotas de assinatura usam a mesma configuração", () => {
    for (const route of ["checkout", "contest-checkout"]) {
      const source = readFileSync(new URL(`../src/app/api/stripe/${route}/route.ts`, import.meta.url), "utf8");
      expect(source).toContain("payment_method_types: checkoutPaymentMethodTypes()");
    }
  });
});

// Opcional: confirma na Stripe em MODO DE TESTE que a assinatura aceita Pix + cartão.
const testKey = process.env.STRIPE_TEST_SECRET_KEY;
describe.skipIf(!testKey?.startsWith("sk_test_"))("Stripe modo de teste", () => {
  it("cria sessão de assinatura (Elements) com cartão e Pix", async () => {
    const stripe = new Stripe(testKey!, { apiVersion: "2026-07-29.dahlia" });
    const product = await stripe.products.create({ name: "QA teste automático (apagar)" });
    const price = await stripe.prices.create({ currency: "brl", unit_amount: 29_700, recurring: { interval: "month" },
      product: product.id });
    try {
      const session = await stripe.checkout.sessions.create({
        ui_mode: "elements", mode: "subscription", line_items: [{ price: price.id, quantity: 1 }],
        payment_method_types: checkoutPaymentMethodTypes("card,pix"), return_url: "https://example.invalid/retorno",
        locale: "pt-BR",
      });
      expect(session.livemode).toBe(false);
      expect(session.payment_method_types).toEqual(["card", "pix"]);
      await stripe.checkout.sessions.expire(session.id);
    } finally {
      await stripe.prices.update(price.id, { active: false });
      await stripe.products.update(product.id, { active: false });
    }
  });
});
