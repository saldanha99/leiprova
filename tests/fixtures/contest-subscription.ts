import type Stripe from "stripe";
import type { ContestOrderLine } from "@/lib/db/schema";
import { CONTEST_SUBSCRIPTION_COMMERCE } from "@/lib/commerce/subscription-policy";

// Objetos sintéticos com apenas os campos consumidos pela integração.
export function subscriptionFixture(
  input: {
    orderId?: string;
    publicId?: string;
    customerId?: string;
    slug?: string;
    opportunityId?: number;
    annual?: boolean;
    start?: number;
  } = {},
) {
  const id = input.orderId ?? "qa-sub-order";
  const priceId = `price_${id}`;
  const customer = input.customerId ?? "cus_qa";
  const start = input.start ?? Math.floor(Date.now() / 1000);
  const end = start + (input.annual ? 365 : 30) * 86400;
  const amount = input.annual ? 34700 : 6700;
  const lines: ContestOrderLine[] = [
    {
      productSlug: input.slug ?? "qa-course",
      opportunityId: input.opportunityId ?? 1,
      accessKey: input.annual ? "annual" : "monthly",
      months: input.annual ? 12 : 1,
      amountCents: amount,
      stripePriceId: priceId,
    },
  ];
  const metadata = {
    app: "leiprova",
    commerce: CONTEST_SUBSCRIPTION_COMMERCE,
    order_id: id,
    user_public_id: input.publicId ?? "qa-user",
  };
  const subscription = {
    id: `sub_${id}`,
    customer,
    metadata,
    livemode: false,
    status: "active",
    cancel_at_period_end: false,
    latest_invoice: `in_${id}_${start}`,
    items: {
      has_more: false,
      data: [
        {
          id: `si_${id}`,
          quantity: 1,
          current_period_start: start,
          current_period_end: end,
          price: {
            id: priceId,
            active: true,
            currency: "brl",
            unit_amount: amount,
            livemode: false,
            recurring: {
              interval: input.annual ? "year" : "month",
              interval_count: 1,
              usage_type: "licensed",
            },
          },
        },
      ],
    },
  } as unknown as Stripe.Subscription;
  const invoice = {
    id: subscription.latest_invoice,
    customer,
    status: "paid",
    amount_paid: amount,
    total: amount,
    currency: "brl",
    livemode: false,
    billing_reason: "subscription_cycle",
    parent: {
      subscription_details: { subscription: subscription.id, metadata },
    },
    lines: {
      has_more: false,
      data: [
        {
          amount,
          quantity: 1,
          currency: "brl",
          pricing: { price_details: { price: priceId } },
          parent: {
            subscription_item_details: {
              subscription_item: `si_${id}`,
              proration: false,
            },
          },
          period: { start, end },
        },
      ],
    },
  } as unknown as Stripe.Invoice;
  const intent = {
    id: `pi_${id}_${start}`,
    status: "succeeded",
    amount_received: amount,
    currency: "brl",
    customer,
    livemode: false,
    latest_charge: { amount_refunded: 0, disputed: false },
  } as unknown as Stripe.PaymentIntent;
  const payments = {
    has_more: false,
    data: [
      {
        invoice: invoice.id,
        status: "paid",
        amount_paid: amount,
        currency: "brl",
        livemode: false,
        payment: { type: "payment_intent", payment_intent: intent.id },
      },
    ],
  } as Stripe.ApiList<Stripe.InvoicePayment>;
  const event = {
    id: `evt_${id}`,
    type: "invoice.paid",
    created: start,
    livemode: false,
    data: { object: invoice },
  } as unknown as Stripe.Event;
  return {
    id,
    lines,
    subscription,
    invoice,
    intent,
    payments,
    event,
    start,
    end,
    metadata,
  };
}
