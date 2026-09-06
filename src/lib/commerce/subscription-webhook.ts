import "server-only";
import { eq, sql } from "drizzle-orm";
import type Stripe from "stripe";
import {
  contestOrders,
  contestPurchases,
  contestBillingInvoices,
  users,
} from "@/lib/db/schema";
import { getStripeClient } from "@/lib/stripe";
import { objectId } from "@/app/api/stripe/webhook/mapping";
import {
  isContestSubscriptionMetadata,
  paidContestInvoicePeriod,
  validateContestSubscription,
} from "./subscription-policy";
import { readDuringCommerceTransaction, withCommerceTransaction, type CommerceTransaction } from "./webhook-transaction";
import { enqueuePurchaseDelivery } from "./purchase-delivery";

const requestOptions: Stripe.RequestOptions = { timeout: 8_000, maxNetworkRetries: 1 };

// A data do evento nunca estende acesso. O período vem da fatura paga e da Stripe atual.
export async function reconcileContestSubscription(
  subscriptionId: string,
  orderId: string,
  transaction?: CommerceTransaction,
) {
  await withCommerceTransaction(transaction, async (tx) => {
    await tx.execute(sql`set local idle_in_transaction_session_timeout = '60s'`);
    await tx.execute(sql`set local lock_timeout = '8s'`);
    await tx.execute(
      sql`select id from ${contestOrders} where id=${orderId} for update`,
    );
    const [row] = await tx
      .select({ order: contestOrders, userPublicId: users.publicId })
      .from(contestOrders)
      .innerJoin(users, eq(contestOrders.userId, users.id))
      .where(eq(contestOrders.id, orderId));
    if (!row) throw new Error("Assinatura de concurso sem pedido local.");
    const { order } = row;
    const stripe = getStripeClient();
    // Busca feita sob o lock: eventos antigos e concorrentes veem o estado atual.
    const subscription = await readDuringCommerceTransaction(tx, () =>
      stripe.subscriptions.retrieve(subscriptionId, {}, requestOptions));
    validateContestSubscription(
      {
        orderId,
        userPublicId: row.userPublicId,
        customerId: order.stripeCustomerId,
        subscriptionId: order.stripeSubscriptionId,
        live: order.stripeMode === "live",
        lines: order.lines,
      },
      subscription,
    );
    await tx
      .update(contestOrders)
      .set({
        stripeSubscriptionId: subscription.id,
        subscriptionStatus: subscription.status,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        updatedAt: new Date(),
      })
      .where(eq(contestOrders.id, orderId));
    if (
      ["canceled", "unpaid", "paused", "incomplete_expired"].includes(
        subscription.status,
      )
    ) {
      await tx
        .update(contestPurchases)
        .set({ status: "revoked", updatedAt: new Date() })
        .where(eq(contestPurchases.orderId, orderId));
      return;
    }
    // Falha de renovação não amplia a vigência já paga nem cria acesso inicial.
    if (subscription.status !== "active") return;
    const invoiceId = objectId(subscription.latest_invoice);
    if (!invoiceId) return;
    const invoice = await readDuringCommerceTransaction(tx, () =>
      stripe.invoices.retrieve(invoiceId, {}, requestOptions));
    const period = paidContestInvoicePeriod(invoice, subscription, order.lines);
    if (!period) return;
    if (order.paidThrough && period.end < order.paidThrough) return;
    const payments = await readDuringCommerceTransaction(tx, () => stripe.invoicePayments.list({
      invoice: invoice.id,
      status: "paid",
      limit: 10,
    }, requestOptions));
    const payment = payments.data[0];
    const intentId =
      payment?.payment.type === "payment_intent"
        ? objectId(payment.payment.payment_intent)
        : null;
    if (
      payments.has_more ||
      payments.data.length !== 1 ||
      !intentId ||
      payment.amount_paid !== order.amountCents ||
      payment.currency !== "brl" ||
      payment.livemode !== subscription.livemode ||
      objectId(payment.invoice) !== invoice.id
    )
      throw new Error(
        "Confirmação financeira da fatura de concurso divergente.",
      );
    const intent = await readDuringCommerceTransaction(tx, () => stripe.paymentIntents.retrieve(intentId, {
      expand: ["latest_charge"],
    }, requestOptions));
    const charge =
      typeof intent.latest_charge === "object" ? intent.latest_charge : null;
    if (
      intent.status !== "succeeded" ||
      intent.amount_received !== order.amountCents ||
      intent.currency !== "brl" ||
      intent.livemode !== subscription.livemode ||
      objectId(intent.customer) !== order.stripeCustomerId ||
      !charge
    )
      throw new Error("Pagamento da assinatura de concurso divergente.");
    const reversal =
      charge.amount_refunded > 0
        ? "refunded"
        : charge.disputed
          ? "disputed"
          : null;
    await tx
      .insert(contestBillingInvoices)
      .values({
        invoiceId: invoice.id,
        orderId,
        paymentIntentId: intentId,
        periodStart: period.start,
        periodEnd: period.end,
        status: reversal ?? "paid",
      })
      .onConflictDoNothing();
    const [stored] = await tx
      .select()
      .from(contestBillingInvoices)
      .where(eq(contestBillingInvoices.invoiceId, invoice.id));
    if (
      !stored ||
      stored.orderId !== orderId ||
      stored.paymentIntentId !== intentId
    )
      throw new Error("Identidade da fatura local divergente.");
    if (reversal || stored.status !== "paid") {
      const status = reversal ?? stored.status;
      await tx
        .update(contestBillingInvoices)
        .set({ status, updatedAt: new Date() })
        .where(eq(contestBillingInvoices.invoiceId, invoice.id));
      await tx
        .update(contestOrders)
        .set({ status, updatedAt: new Date() })
        .where(eq(contestOrders.id, orderId));
      await tx
        .update(contestPurchases)
        .set({ status: "revoked", updatedAt: new Date() })
        .where(eq(contestPurchases.orderId, orderId));
      return;
    }
    await tx
      .update(contestOrders)
      .set({ status: "paid", paidThrough: period.end, updatedAt: new Date() })
      .where(eq(contestOrders.id, orderId));
    for (const line of order.lines) {
      await tx
        .insert(contestPurchases)
        .values({
          orderId,
          userId: order.userId,
          productSlug: line.productSlug,
          opportunityId: line.opportunityId,
          accessStartsAt: period.start,
          accessEndsAt: period.end,
          status: "active",
        })
        .onConflictDoUpdate({
          target: [contestPurchases.orderId, contestPurchases.productSlug],
          set: {
            accessStartsAt: period.start,
            accessEndsAt: period.end,
            status: "active",
            updatedAt: new Date(),
          },
        });
      await enqueuePurchaseDelivery(tx, {
        userId: order.userId,
        scope: "contest",
        purchaseId: order.id,
        productSlug: line.productSlug,
      });
    }
  });
}

async function processRecurringReversal(event: Stripe.Event, transaction: CommerceTransaction) {
  if (
    event.type !== "charge.refunded" &&
    event.type !== "charge.dispute.created"
  )
    return false;
  const intentId = objectId(event.data.object.payment_intent);
  if (!intentId) return false;
  const [invoice] = await transaction
    .select()
    .from(contestBillingInvoices)
    .where(eq(contestBillingInvoices.paymentIntentId, intentId));
  if (!invoice) return false;
  await withCommerceTransaction(transaction, async (tx) => {
    await tx.execute(
      sql`select id from ${contestOrders} where id=${invoice.orderId} for update`,
    );
    const [order] = await tx
      .select()
      .from(contestOrders)
      .where(eq(contestOrders.id, invoice.orderId));
    if (!order || event.livemode !== (order.stripeMode === "live"))
      throw new Error("Modo do reembolso divergente.");
    const status = event.type === "charge.refunded" ? "refunded" : "disputed";
    await tx
      .update(contestBillingInvoices)
      .set({ status, updatedAt: new Date() })
      .where(eq(contestBillingInvoices.invoiceId, invoice.invoiceId));
    // Um reembolso de janeiro não invalida fevereiro já pago.
    if (!order.paidThrough || invoice.periodEnd >= order.paidThrough) {
      await tx
        .update(contestOrders)
        .set({ status, updatedAt: new Date() })
        .where(eq(contestOrders.id, order.id));
      await tx
        .update(contestPurchases)
        .set({ status: "revoked", updatedAt: new Date() })
        .where(eq(contestPurchases.orderId, order.id));
    }
  });
  return true;
}

export async function processContestSubscriptionEvent(
  event: Stripe.Event,
  transaction?: CommerceTransaction,
): Promise<boolean> {
  if (event.account) return false;
  if (!transaction) return withCommerceTransaction(undefined, (tx) => processContestSubscriptionEvent(event, tx));
  if (await processRecurringReversal(event, transaction)) return true;
  if (event.type.startsWith("checkout.session.")) {
    const session = event.data.object as Stripe.Checkout.Session;
    if (!isContestSubscriptionMetadata(session.metadata)) return false;
    const orderId = session.metadata?.order_id;
    if (!orderId) throw new Error("Checkout recorrente sem pedido.");
    await withCommerceTransaction(transaction, async (tx) => {
      await tx.execute(
        sql`select id from ${contestOrders} where id=${orderId} for update`,
      );
      const [row] = await tx
        .select({ order: contestOrders, publicId: users.publicId })
        .from(contestOrders)
        .innerJoin(users, eq(contestOrders.userId, users.id))
        .where(eq(contestOrders.id, orderId));
      if (
        !row ||
        row.publicId !== session.client_reference_id ||
        row.publicId !== session.metadata?.user_public_id ||
        session.mode !== "subscription" ||
        session.livemode !== (row.order.stripeMode === "live") ||
        (row.order.stripeSessionId &&
          row.order.stripeSessionId !== session.id) ||
        (session.customer &&
          objectId(session.customer) !== row.order.stripeCustomerId) ||
        (session.amount_total !== null &&
          session.amount_total !== row.order.amountCents)
      )
        throw new Error(
          "Identidade ou valor do checkout recorrente divergente.",
        );
      if (["created", "pending"].includes(row.order.status)) {
        const status =
          event.type === "checkout.session.expired"
            ? "expired"
            : event.type === "checkout.session.async_payment_failed"
              ? "failed"
              : "pending";
        await tx
          .update(contestOrders)
          .set({ stripeSessionId: session.id, status, updatedAt: new Date() })
          .where(eq(contestOrders.id, orderId));
      }
    });
    const subId = objectId(session.subscription);
    if (subId) await reconcileContestSubscription(subId, orderId, transaction);
    return true;
  }
  let subscriptionId: string | null = null;
  let metadata: Stripe.Metadata | null | undefined;
  if (event.type.startsWith("customer.subscription.")) {
    const subscription = event.data.object as Stripe.Subscription;
    subscriptionId = subscription.id;
    metadata = subscription.metadata;
  } else if (event.type.startsWith("invoice.")) {
    const invoice = event.data.object as Stripe.Invoice;
    subscriptionId = objectId(
      invoice.parent?.subscription_details?.subscription,
    );
    metadata = invoice.parent?.subscription_details?.metadata;
  } else return false;
  if (!subscriptionId) return false;
  const [known] = await transaction
    .select({ id: contestOrders.id })
    .from(contestOrders)
    .where(eq(contestOrders.stripeSubscriptionId, subscriptionId));
  if (!known && !isContestSubscriptionMetadata(metadata)) return false;
  const orderId = known?.id ?? metadata?.order_id;
  if (!orderId) throw new Error("Evento de assinatura sem pedido de concurso.");
  await reconcileContestSubscription(subscriptionId, orderId, transaction);
  return true;
}
