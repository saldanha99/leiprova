import type Stripe from "stripe";
import type { ContestOrderLine } from "@/lib/db/schema";
import { objectId } from "@/app/api/stripe/webhook/mapping";
import { getContestAccessOption } from "./catalog";

export const CONTEST_SUBSCRIPTION_COMMERCE = "contest_subscription_v2";
export function isContestSubscriptionMetadata(
  metadata: Stripe.Metadata | null | undefined,
) {
  return (
    metadata?.app === "leiprova" &&
    metadata.commerce === CONTEST_SUBSCRIPTION_COMMERCE
  );
}

export function contestRecurringPriceMatches(
  price: Stripe.Price,
  line: ContestOrderLine,
  live: boolean,
  requireActive = true,
) {
  const option = getContestAccessOption(line.accessKey);
  return Boolean(
    option &&
      price.id === line.stripePriceId &&
      (!requireActive || price.active) &&
      price.currency === "brl" &&
      price.unit_amount === line.amountCents &&
      price.livemode === live &&
      price.recurring?.interval === option.interval &&
      price.recurring.interval_count === 1 &&
      price.recurring.usage_type === "licensed",
  );
}

export function validateContestSubscription(
  input: {
    orderId: string;
    userPublicId: string;
    customerId: string | null;
    subscriptionId: string | null;
    live: boolean;
    lines: ContestOrderLine[];
  },
  subscription: Stripe.Subscription,
) {
  if (
    !isContestSubscriptionMetadata(subscription.metadata) ||
    subscription.metadata.order_id !== input.orderId ||
    subscription.metadata.user_public_id !== input.userPublicId ||
    !input.customerId ||
    objectId(subscription.customer) !== input.customerId ||
    (input.subscriptionId && input.subscriptionId !== subscription.id) ||
    subscription.livemode !== input.live
  )
    throw new Error("Identidade da assinatura de concurso divergente.");
  if (
    subscription.items.has_more ||
    subscription.items.data.length !== input.lines.length ||
    new Set(input.lines.map((line) => line.stripePriceId)).size !==
      input.lines.length ||
    new Set(input.lines.map((line) => line.accessKey)).size !== 1 ||
    input.lines.some(
      (line) =>
        !subscription.items.data.some(
          (item) =>
            item.quantity === 1 &&
            contestRecurringPriceMatches(item.price, line, input.live, false),
        ),
    )
  )
    throw new Error(
      "Preço ou periodicidade da assinatura de concurso divergente.",
    );
}

export function paidContestInvoicePeriod(
  invoice: Stripe.Invoice,
  subscription: Stripe.Subscription,
  lines: ContestOrderLine[],
) {
  if (invoice.status !== "paid") return null;
  const total = lines.reduce((sum, line) => sum + line.amountCents, 0);
  if (
    objectId(invoice.parent?.subscription_details?.subscription) !==
      subscription.id ||
    objectId(invoice.customer) !== objectId(subscription.customer) ||
    invoice.livemode !== subscription.livemode ||
    invoice.currency !== "brl" ||
    invoice.amount_paid !== total ||
    invoice.total !== total ||
    !["subscription_create", "subscription_cycle"].includes(
      invoice.billing_reason ?? "",
    ) ||
    invoice.lines.has_more ||
    invoice.lines.data.length !== lines.length
  )
    throw new Error("Fatura da assinatura de concurso divergente.");
  for (const line of lines) {
    const item = subscription.items.data.find(
      (item) => item.price.id === line.stripePriceId,
    )!;
    const invoiceLine = invoice.lines.data.find(
      (row) =>
        objectId(row.pricing?.price_details?.price) === line.stripePriceId,
    );
    if (
      !invoiceLine ||
      invoiceLine.amount !== line.amountCents ||
      invoiceLine.quantity !== 1 ||
      invoiceLine.currency !== "brl" ||
      invoiceLine.parent?.subscription_item_details?.subscription_item !==
        item.id ||
      invoiceLine.parent.subscription_item_details.proration ||
      invoiceLine.period.start !== item.current_period_start ||
      invoiceLine.period.end !== item.current_period_end
    )
      throw new Error("Período ou item da fatura de concurso divergente.");
  }
  const starts = invoice.lines.data.map((line) => line.period.start);
  const ends = invoice.lines.data.map((line) => line.period.end);
  if (
    new Set(starts).size !== 1 ||
    new Set(ends).size !== 1 ||
    !Number.isSafeInteger(starts[0]) ||
    !Number.isSafeInteger(ends[0]) ||
    ends[0] <= starts[0]
  )
    throw new Error("Período da fatura de concurso inválido.");
  return { start: new Date(starts[0] * 1000), end: new Date(ends[0] * 1000) };
}
