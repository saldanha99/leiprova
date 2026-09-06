import type Stripe from "stripe";
import { describe, expect, it } from "vitest";
import { isMasterMetadata, masterInvoicePaymentIntent, masterPaymentReversal, paidMasterInvoicePeriod, validateMasterSubscription } from "@/lib/stripe/master-policy";
import { masterSubscriptionFixture } from "./fixtures/master-subscription";

type Fixture = ReturnType<typeof masterSubscriptionFixture>;
function period(f: Fixture) { return paidMasterInvoicePeriod(f.invoice, f.subscription, f.identity); }
function charge(f: Fixture) { return f.intent.latest_charge as Stripe.Charge; }

describe("política Master isolada — ainda não integrada ao webhook", () => {
  it.each([false, true])("aceita período pago finito e plano exato; anual=%s", (annual) => {
    const f = masterSubscriptionFixture(annual);
    expect(period(f)).toEqual({ start: new Date(f.start * 1000), end: new Date(f.end * 1000), amountCents: f.amount });
    expect(masterInvoicePaymentIntent(f.payments, f.invoice, false)).toBe(f.intent.id);
    expect(masterPaymentReversal(f.intent, f.invoice, f.identity)).toBeNull();
  });
  it("aceita marcador histórico Master sem confundir com compra de concurso", () => {
    const f = masterSubscriptionFixture();
    expect(isMasterMetadata(f.subscription.metadata)).toBe(true);
    expect(isMasterMetadata({ ...f.subscription.metadata, commerce: "master_v2" })).toBe(true);
    expect(isMasterMetadata({ ...f.subscription.metadata, commerce: "contest_v2" })).toBe(false);
    expect(isMasterMetadata({ ...f.subscription.metadata, app: "outro" })).toBe(false);
    expect(isMasterMetadata({ app: "leiprova" })).toBe(false);
  });
  it.each<[string, (f: Fixture) => void]>([
    ["customer", (f) => { f.subscription.customer = "cus_other"; }],
    ["customer não persistido", (f) => { f.identity.customerId = null; }],
    ["usuário numérico", (f) => { f.subscription.metadata.user_id = "18"; }],
    ["usuário público", (f) => { f.subscription.metadata.user_public_id = "other"; }],
    ["tentativa", (f) => { f.subscription.metadata.checkout_attempt_id = "other"; }],
    ["plano", (f) => { f.subscription.metadata.plan_slug = "other"; }],
    ["assinatura", (f) => { f.subscription.id = "sub_other"; }],
    ["modo", (f) => { f.subscription.livemode = true; }],
    ["preço", (f) => { f.subscription.items.data[0].price.id = "price_other"; }],
    ["quantidade", (f) => { f.subscription.items.data[0].quantity = 2; }],
    ["multi-item", (f) => { f.subscription.items.data.push(f.subscription.items.data[0]); }],
    ["lista incompleta", (f) => { f.subscription.items.has_more = true; }],
    ["valor", (f) => { f.subscription.items.data[0].price.unit_amount = 1; }],
    ["moeda", (f) => { f.subscription.items.data[0].price.currency = "usd"; }],
    ["intervalo", (f) => { f.subscription.items.data[0].price.recurring!.interval = "year"; }],
    ["semestral", (f) => { f.subscription.items.data[0].price.recurring!.interval_count = 6; }],
    ["uso medido", (f) => { f.subscription.items.data[0].price.recurring!.usage_type = "metered"; }],
  ])("rejeita divergência de %s", (_name, mutate) => {
    const f = masterSubscriptionFixture(); mutate(f);
    expect(() => validateMasterSubscription(f.identity, f.subscription)).toThrow();
  });
  it("preço arquivado não invalida cobrança histórica íntegra", () => {
    const f = masterSubscriptionFixture();
    f.subscription.items.data[0].price.active = false;
    expect(period(f)?.amountCents).toBe(f.amount);
  });
  it("fatura ainda não paga não fornece período de acesso", () => {
    const f = masterSubscriptionFixture(); f.invoice.status = "open";
    expect(period(f)).toBeNull();
  });
  it.each<[string, (f: Fixture) => void]>([
    ["fatura antiga", (f) => { f.invoice.id = "in_old"; }],
    ["outro customer", (f) => { f.invoice.customer = "cus_other"; }],
    ["outra assinatura", (f) => { f.invoice.parent!.subscription_details!.subscription = "sub_other"; }],
    ["outro item", (f) => { f.invoice.lines.data[0].parent!.subscription_item_details!.subscription_item = "si_other"; }],
    ["outro preço", (f) => { f.invoice.lines.data[0].pricing!.price_details!.price = "price_other"; }],
    ["final divergente", (f) => { f.invoice.lines.data[0].period.end += 1; }],
    ["fim indefinido", (f) => { f.invoice.lines.data[0].period.end = f.subscription.items.data[0].current_period_end = NaN; }],
    ["período vazio", (f) => { f.invoice.lines.data[0].period.end = f.subscription.items.data[0].current_period_end = f.start; }],
    ["período futuro", (f) => { f.invoice.lines.data[0].period.start = f.subscription.items.data[0].current_period_start = f.end - 10; }],
    ["data fora do limite JS", (f) => { f.invoice.lines.data[0].period.end = f.subscription.items.data[0].current_period_end = 9e12; }],
    ["pró-rata", (f) => { f.invoice.lines.data[0].parent!.subscription_item_details!.proration = true; }],
    ["upgrade no meio do ciclo", (f) => { f.invoice.billing_reason = "subscription_update"; }],
    ["crédito anterior", (f) => { f.invoice.starting_balance = -100; }],
    ["nota de crédito posterior", (f) => { f.invoice.post_payment_credit_notes_amount = 100; }],
    ["nota de crédito anterior", (f) => { f.invoice.pre_payment_credit_notes_amount = 100; }],
    ["pagamento fora da Stripe", (f) => { f.invoice.amount_paid_off_stripe = f.amount; }],
    ["pagamento parcial", (f) => { f.invoice.amount_paid -= 100; }],
    ["diferença pendente", (f) => { f.invoice.amount_remaining = 100; }],
    ["total divergente", (f) => { f.invoice.total -= 100; }],
  ])("não homologa %s", (_name, mutate) => {
    const f = masterSubscriptionFixture(); mutate(f);
    expect(() => period(f)).toThrow();
  });
  it("confere cupom parcial positivo pela fatura oficial", () => {
    const f = masterSubscriptionFixture();
    f.invoice.total_discount_amounts = [{ amount: 1000, discount: "di_qa" }];
    f.invoice.total = f.invoice.amount_due = f.invoice.amount_paid = f.amount - 1000;
    expect(period(f)?.amountCents).toBe(f.amount - 1000);
  });
  it("bloqueia gratuidade de 100% até homologação própria", () => {
    const f = masterSubscriptionFixture();
    f.invoice.total_discount_amounts = [{ amount: f.amount, discount: "di_qa" }];
    f.invoice.total = f.invoice.amount_due = f.invoice.amount_paid = 0;
    expect(() => period(f)).toThrow(/gratuidade/);
  });
  it.each<[string, (f: Fixture) => void]>([
    ["várias liquidações", (f) => { f.payments.data.push(f.payments.data[0]); }],
    ["mais páginas", (f) => { f.payments.has_more = true; }],
    ["outra fatura", (f) => { f.payments.data[0].invoice = "in_other"; }],
    ["valor parcial", (f) => { f.payments.data[0].amount_paid = 1; }],
    ["modo distinto", (f) => { f.payments.data[0].livemode = true; }],
    ["pagamento ainda aberto", (f) => { f.payments.data[0].status = "open"; }],
  ])("confirmação financeira rejeita %s", (_name, mutate) => {
    const f = masterSubscriptionFixture(); mutate(f);
    expect(() => masterInvoicePaymentIntent(f.payments, f.invoice, false)).toThrow();
  });
  it.each([1, 29700])("identifica estorno parcial/total: %i", (amount) => {
    const f = masterSubscriptionFixture(); charge(f).amount_refunded = amount;
    expect(masterPaymentReversal(f.intent, f.invoice, f.identity)).toBe("refunded");
  });
  it("identifica contestação", () => {
    const f = masterSubscriptionFixture(); charge(f).disputed = true;
    expect(masterPaymentReversal(f.intent, f.invoice, f.identity)).toBe("disputed");
  });
  it.each<[string, (f: Fixture) => void]>([
    ["intent incompleto", (f) => { f.intent.status = "requires_action"; }],
    ["intent de outro customer", (f) => { f.intent.customer = "cus_other"; }],
    ["intent de outro modo", (f) => { f.intent.livemode = true; }],
    ["cobrança não expandida", (f) => { f.intent.latest_charge = "ch_master_qa"; }],
    ["cobrança de outra compra", (f) => { charge(f).payment_intent = "pi_other"; }],
    ["cobrança de outro customer", (f) => { charge(f).customer = "cus_other"; }],
    ["cobrança de outro modo", (f) => { charge(f).livemode = true; }],
    ["cobrança não capturada", (f) => { charge(f).captured = false; }],
    ["cobrança parcial", (f) => { charge(f).amount = 1; }],
  ])("não confunde %s com compra confirmada", (_name, mutate) => {
    const f = masterSubscriptionFixture(); mutate(f);
    expect(() => masterPaymentReversal(f.intent, f.invoice, f.identity)).toThrow();
  });
});
