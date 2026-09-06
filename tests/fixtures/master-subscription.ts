import type Stripe from "stripe";
import type { MasterBillingIdentity } from "@/lib/stripe/master-policy";

// Objetos sintéticos: nenhum identificador, usuário ou pagamento externo é consultado.
export function masterSubscriptionFixture(annual = false) {
  const start = Math.floor(Date.now() / 1000) - 60;
  const end = start + (annual ? 365 : 30) * 86400;
  const amount = annual ? 89700 : 29700;
  const identity: MasterBillingIdentity = {
    attemptId: "qa_master_attempt", userId: 17, userPublicId: "qa_master_public",
    customerId: "cus_master_qa", subscriptionId: "sub_master_qa", live: false,
    plan: { slug: annual ? "foco" : "ritmo", stripePriceId: "price_master_qa", amountCents: amount, currency: "brl", billingType: annual ? "year" : "month" },
  };
  const metadata = {
    app: "leiprova", user_id: String(identity.userId), user_public_id: identity.userPublicId,
    checkout_attempt_id: identity.attemptId, plan_slug: identity.plan.slug,
  };
  const subscription = {
    id: identity.subscriptionId, object: "subscription", customer: identity.customerId, metadata,
    status: "active", livemode: false, latest_invoice: "in_master_qa", cancel_at_period_end: false,
    items: { object: "list", has_more: false, data: [{
      id: "si_master_qa", quantity: 1, current_period_start: start, current_period_end: end,
      price: { id: identity.plan.stripePriceId, object: "price", type: "recurring", billing_scheme: "per_unit",
        currency: "brl", unit_amount: amount, livemode: false, active: true,
        recurring: { interval: identity.plan.billingType, interval_count: 1, usage_type: "licensed" } },
    }] },
  } as unknown as Stripe.Subscription;
  const invoice = {
    id: "in_master_qa", object: "invoice", customer: identity.customerId, livemode: false, currency: "brl",
    status: "paid", billing_reason: "subscription_create", parent: { type: "subscription_details",
      subscription_details: { subscription: subscription.id, metadata } },
    subtotal: amount, total: amount, amount_due: amount, amount_paid: amount, amount_remaining: 0,
    starting_balance: 0, post_payment_credit_notes_amount: 0, pre_payment_credit_notes_amount: 0,
    amount_paid_off_stripe: 0, total_discount_amounts: [], total_taxes: [],
    lines: { object: "list", has_more: false, data: [{ id: "il_master_qa", quantity: 1,
      amount, subtotal: amount, currency: "brl", period: { start, end },
      pricing: { type: "price_details", price_details: { price: identity.plan.stripePriceId } },
      parent: { type: "subscription_item_details", subscription_item_details: { subscription_item: "si_master_qa", proration: false } },
    }] },
  } as unknown as Stripe.Invoice;
  const payments = {
    object: "list", has_more: false, data: [{ id: "inpay_master_qa", object: "invoice_payment",
      invoice: invoice.id, livemode: false, currency: "brl", amount_paid: amount, status: "paid",
      payment: { type: "payment_intent", payment_intent: "pi_master_qa" } }],
  } as Stripe.ApiList<Stripe.InvoicePayment>;
  const intent = {
    id: "pi_master_qa", object: "payment_intent", customer: identity.customerId, livemode: false,
    status: "succeeded", amount_received: amount, currency: "brl",
    latest_charge: { id: "ch_master_qa", object: "charge", customer: identity.customerId, livemode: false,
      payment_intent: "pi_master_qa", paid: true, captured: true, status: "succeeded", amount, currency: "brl",
      refunded: false, amount_refunded: 0, disputed: false },
  } as unknown as Stripe.PaymentIntent;
  return { identity, subscription, invoice, payments, intent, start, end, amount };
}
