import { describe, expect, it } from "vitest";
import {
  CONTEST_ACCESS_OPTIONS,
  CONTEST_ANNUAL_COMPARISON,
} from "@/lib/commerce/catalog";
import { contestCartSchema } from "@/lib/commerce/order-policy";
import {
  contestRecurringPriceMatches,
  paidContestInvoicePeriod,
  validateContestSubscription,
} from "@/lib/commerce/subscription-policy";
import { subscriptionFixture } from "./fixtures/contest-subscription";

describe("assinaturas individuais mensal e anual", () => {
  it("mantém preços e economia calculados na mesma fonte", () => {
    expect(
      CONTEST_ACCESS_OPTIONS.map((p) => [p.key, p.amountCents, p.interval]),
    ).toEqual([
      ["monthly", 6700, "month"],
      ["annual", 34700, "year"],
    ]);
    expect(CONTEST_ANNUAL_COMPARISON).toEqual({
      monthlyYearCents: 80400,
      savingsCents: 45700,
      approximateDiscountPercent: 57,
      monthlyEquivalentCents: 2892,
    });
  });
  it.each([false, true])(
    "aceita o preço recorrente correto; anual=%s",
    (annual) => {
      const f = subscriptionFixture({ annual });
      expect(
        contestRecurringPriceMatches(
          f.subscription.items.data[0].price,
          f.lines[0],
          false,
        ),
      ).toBe(true);
      expect(
        paidContestInvoicePeriod(
          f.invoice,
          f.subscription,
          f.lines,
        )?.end.getTime(),
      ).toBe(f.end * 1000);
    },
  );
  it("recusa o preço de pagamento único e a periodicidade divergente", () => {
    const f = subscriptionFixture();
    const price = f.subscription.items.data[0].price;
    expect(
      contestRecurringPriceMatches(
        { ...price, recurring: null },
        f.lines[0],
        false,
      ),
    ).toBe(false);
    expect(
      contestRecurringPriceMatches(
        { ...price, recurring: { ...price.recurring!, interval: "year" } },
        f.lines[0],
        false,
      ),
    ).toBe(false);
  });
  it("recusa chaves antigas de seis/doze meses no novo carrinho", () => {
    for (const accessKey of ["6m", "12m"])
      expect(
        contestCartSchema.safeParse({
          attemptId: crypto.randomUUID(),
          items: [{ productSlug: "pc-ba-delegado-2026", accessKey }],
        }).success,
      ).toBe(false);
  });
  it("não considera fatura aberta como renovação paga", () => {
    const f = subscriptionFixture();
    f.invoice.status = "open";
    expect(
      paidContestInvoicePeriod(f.invoice, f.subscription, f.lines),
    ).toBeNull();
  });
  it.each([
    "amount",
    "customer",
    "live",
    "price",
    "period",
    "quantity",
    "proration",
  ])("recusa adulteração de %s", (kind) => {
    const f = subscriptionFixture();
    if (kind === "amount") f.invoice.amount_paid = 1;
    if (kind === "customer") f.invoice.customer = "cus_outro";
    if (kind === "live") f.invoice.livemode = true;
    if (kind === "price")
      f.invoice.lines.data[0].pricing!.price_details!.price = "price_master";
    if (kind === "period") f.invoice.lines.data[0].period.end += 86400;
    if (kind === "quantity") f.invoice.lines.data[0].quantity = 2;
    if (kind === "proration")
      f.invoice.lines.data[0].parent!.subscription_item_details!.proration = true;
    expect(() =>
      paidContestInvoicePeriod(f.invoice, f.subscription, f.lines),
    ).toThrow();
  });
  it("nunca aceita Master ou assinatura de outro usuário como concurso", () => {
    const f = subscriptionFixture();
    const input = {
      orderId: f.id,
      userPublicId: "qa-user",
      customerId: "cus_qa",
      subscriptionId: null,
      live: false,
      lines: f.lines,
    };
    expect(() =>
      validateContestSubscription(input, f.subscription),
    ).not.toThrow();
    expect(() =>
      validateContestSubscription(
        { ...input, userPublicId: "outro" },
        f.subscription,
      ),
    ).toThrow("Identidade");
    f.subscription.metadata.commerce = "master";
    expect(() => validateContestSubscription(input, f.subscription)).toThrow(
      "Identidade",
    );
  });
});
