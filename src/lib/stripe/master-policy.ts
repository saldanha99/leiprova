import type Stripe from "stripe";
import { objectId, parsePositiveInteger } from "@/app/api/stripe/webhook/mapping";

export type MasterBillingIdentity = {
  attemptId: string;
  userId: number;
  userPublicId: string;
  customerId: string | null;
  subscriptionId?: string | null;
  plan: {
    slug: string;
    stripePriceId: string | null;
    amountCents: number;
    currency: string;
    billingType: string;
  };
  live: boolean;
};

export function isMasterMetadata(metadata: Stripe.Metadata | null | undefined): metadata is Stripe.Metadata {
  return Boolean(metadata?.app === "leiprova" &&
    (!metadata.commerce || metadata.commerce === "master_v2") && metadata.plan_slug);
}

export function validateMasterSubscription(identity: MasterBillingIdentity, subscription: Stripe.Subscription) {
  const metadata = subscription.metadata;
  if (!isMasterMetadata(metadata) || metadata.checkout_attempt_id !== identity.attemptId ||
    parsePositiveInteger(metadata.user_id) !== identity.userId ||
    metadata.user_public_id !== identity.userPublicId || metadata.plan_slug !== identity.plan.slug ||
    !identity.customerId || objectId(subscription.customer) !== identity.customerId ||
    (identity.subscriptionId && subscription.id !== identity.subscriptionId) ||
    subscription.livemode !== identity.live) {
    throw new Error("Identidade da assinatura Master divergente.");
  }
  const item = subscription.items.data[0];
  const price = item?.price;
  if (subscription.items.has_more || subscription.items.data.length !== 1 || item?.quantity !== 1 ||
    !identity.plan.stripePriceId || price?.id !== identity.plan.stripePriceId ||
    price.type !== "recurring" || price.billing_scheme !== "per_unit" ||
    price.currency !== identity.plan.currency || price.currency !== "brl" ||
    price.unit_amount !== identity.plan.amountCents || price.livemode !== identity.live ||
    !["month", "year"].includes(identity.plan.billingType) ||
    price.recurring?.interval !== identity.plan.billingType ||
    price.recurring.interval_count !== 1 || price.recurring.usage_type !== "licensed") {
    throw new Error("Preço ou periodicidade da assinatura Master divergente.");
  }
  return item;
}

export function paidMasterInvoicePeriod(invoice: Stripe.Invoice, subscription: Stripe.Subscription, identity: MasterBillingIdentity) {
  if (invoice.status !== "paid") return null;
  const item = validateMasterSubscription(identity, subscription);
  const line = invoice.lines.data[0];
  const discounts = invoice.total_discount_amounts ?? [];
  const discount = discounts.reduce((sum, row) => sum + row.amount, 0);
  if (invoice.id !== objectId(subscription.latest_invoice) ||
    objectId(invoice.parent?.subscription_details?.subscription) !== subscription.id ||
    objectId(invoice.customer) !== identity.customerId || invoice.livemode !== identity.live ||
    invoice.currency !== "brl" || !["subscription_create", "subscription_cycle"].includes(invoice.billing_reason ?? "") ||
    invoice.lines.has_more || invoice.lines.data.length !== 1 ||
    !line || line.quantity !== 1 || line.currency !== "brl" ||
    line.subtotal !== identity.plan.amountCents || line.amount !== identity.plan.amountCents ||
    objectId(line.pricing?.price_details?.price) !== identity.plan.stripePriceId ||
    line.parent?.subscription_item_details?.subscription_item !== item.id ||
    line.parent.subscription_item_details.proration ||
    line.period.start !== item.current_period_start || line.period.end !== item.current_period_end ||
    !Number.isSafeInteger(line.period.start) || !Number.isSafeInteger(line.period.end) ||
    line.period.start <= 0 || line.period.end <= line.period.start ||
    !Number.isFinite(new Date(line.period.end * 1000).getTime()) ||
    line.period.start > Math.floor(Date.now() / 1000)) {
    throw new Error("Fatura, item ou período da assinatura Master divergente.");
  }
  // Cupons positivos são conferidos na fatura oficial. Crédito, gratuidade e pró-rata exigem outro contrato.
  if (discounts.some((row) => !Number.isSafeInteger(row.amount) || row.amount < 0) ||
    discount >= identity.plan.amountCents || invoice.subtotal !== identity.plan.amountCents ||
    invoice.total !== identity.plan.amountCents - discount ||
    invoice.total_taxes?.some((tax) => tax.amount !== 0) || invoice.starting_balance !== 0 ||
    invoice.post_payment_credit_notes_amount !== 0 || invoice.pre_payment_credit_notes_amount !== 0 ||
    (invoice.amount_paid_off_stripe ?? 0) !== 0 || invoice.amount_due !== invoice.total ||
    invoice.amount_paid !== invoice.total || invoice.amount_remaining !== 0 || invoice.total <= 0) {
    throw new Error("Pagamento Master com valor, crédito, gratuidade ou ajuste não homologado.");
  }
  return { start: new Date(line.period.start * 1000), end: new Date(line.period.end * 1000), amountCents: invoice.total };
}

export function masterInvoicePaymentIntent(payments: Stripe.ApiList<Stripe.InvoicePayment>, invoice: Stripe.Invoice, live: boolean) {
  const payment = payments.data[0];
  const intentId = payment?.payment.type === "payment_intent" ? objectId(payment.payment.payment_intent) : null;
  if (payments.has_more || payments.data.length !== 1 || !intentId || payment.status !== "paid" ||
    objectId(payment.invoice) !== invoice.id || payment.livemode !== live ||
    payment.currency !== "brl" || payment.amount_paid !== invoice.total) {
    throw new Error("Confirmação financeira da fatura Master divergente.");
  }
  return intentId;
}

export function masterPaymentReversal(intent: Stripe.PaymentIntent, invoice: Stripe.Invoice, identity: MasterBillingIdentity) {
  const charge = typeof intent.latest_charge === "object" ? intent.latest_charge : null;
  if (intent.status !== "succeeded" || intent.amount_received !== invoice.total || intent.currency !== "brl" ||
    intent.livemode !== identity.live || objectId(intent.customer) !== identity.customerId ||
    !charge || !charge.paid || !charge.captured || charge.status !== "succeeded" ||
    charge.amount !== invoice.total || charge.currency !== "brl" || charge.livemode !== identity.live ||
    objectId(charge.customer) !== identity.customerId || objectId(charge.payment_intent) !== intent.id ||
    !Number.isSafeInteger(charge.amount_refunded) || charge.amount_refunded < 0) {
    throw new Error("Cobrança da assinatura Master divergente.");
  }
  return charge.refunded || charge.amount_refunded > 0 ? "refunded" : charge.disputed ? "disputed" : null;
}

// charge.disputed é histórico; somente a lista atual e integral resolve uma disputa encerrada.
export function masterDisputesBlockAccess(disputes: Stripe.ApiList<Stripe.Dispute>, intent: Stripe.PaymentIntent, live: boolean) {
  if (disputes.has_more || disputes.data.length === 0 || new Set(disputes.data.map((row) => row.id)).size !== disputes.data.length ||
    disputes.data.some((row) => row.livemode !== live || row.currency !== "brl" || objectId(row.payment_intent) !== intent.id ||
      objectId(row.charge) !== objectId(intent.latest_charge) || !Number.isSafeInteger(row.amount) || row.amount <= 0)) {
    throw new Error("Titularidade ou completude das disputas Master divergente.");
  }
  return disputes.data.some((row) => !["won", "warning_closed", "prevented"].includes(row.status));
}
