import "server-only";
import { eq, sql } from "drizzle-orm";
import type Stripe from "stripe";
import { contestOrders, contestPurchases, users } from "@/lib/db/schema";
import { getStripeClient } from "@/lib/stripe";
import { accessEndsAt } from "./catalog";
import { orderPaymentMatches } from "./order-policy";
import { readDuringCommerceTransaction, withCommerceTransaction, type CommerceTransaction } from "./webhook-transaction";
import { enqueuePurchaseDelivery } from "./purchase-delivery";

const requestOptions: Stripe.RequestOptions = { timeout: 8_000, maxNetworkRetries: 1 };

export async function processContestStripeEvent(
  event: Stripe.Event,
  transaction?: CommerceTransaction,
): Promise<boolean> {
  if (event.account) return false;
  if (!transaction) return withCommerceTransaction(undefined, (tx) => processContestStripeEvent(event, tx));
  if (
    event.type === "charge.refunded" ||
    event.type === "charge.dispute.created"
  ) {
    const object = event.data.object;
    const paymentIntent =
      "payment_intent" in object ? object.payment_intent : null;
    const id =
      typeof paymentIntent === "string" ? paymentIntent : paymentIntent?.id;
    if (!id) return false;
    const status = event.type === "charge.refunded" ? "refunded" : "disputed";
    const updated = await withCommerceTransaction(transaction, async (tx) => {
      const orders = await tx
        .update(contestOrders)
        .set({ status, updatedAt: new Date() })
        .where(eq(contestOrders.stripePaymentIntentId, id))
        .returning({ id: contestOrders.id });
      for (const order of orders)
        await tx
          .update(contestPurchases)
          .set({ status: "revoked", updatedAt: new Date() })
          .where(eq(contestPurchases.orderId, order.id));
      return orders.length;
    });
    return updated > 0;
  }
  if (!event.type.startsWith("checkout.session.")) return false;
  const session = event.data.object as Stripe.Checkout.Session;
  if (
    session.metadata?.app !== "leiprova" ||
    session.metadata.commerce !== "contest_v1"
  )
    return false;
  const orderId = session.metadata.order_id;
  if (!orderId) throw new Error("Pedido avulso sem referência.");
  if (
    ![
      "checkout.session.completed",
      "checkout.session.async_payment_succeeded",
      "checkout.session.async_payment_failed",
      "checkout.session.expired",
    ].includes(event.type)
  )
    return true;
  const paid = session.payment_status === "paid";
  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id;
  let revokedStatus: "refunded" | "disputed" | null = null;
  // Confere o estado atual, inclusive se o reembolso chegou antes do webhook de compra.
  if (paid) {
    if (!paymentIntentId) throw new Error("Pedido pago sem transação.");
    const intent = await readDuringCommerceTransaction(transaction, () => getStripeClient().paymentIntents.retrieve(
      paymentIntentId,
      { expand: ["latest_charge"] },
      requestOptions,
    ));
    const charge =
      typeof intent.latest_charge === "object" ? intent.latest_charge : null;
    if (!charge) throw new Error("Transação paga sem confirmação da cobrança.");
    if (charge.amount_refunded > 0) revokedStatus = "refunded";
    else if (charge.disputed) revokedStatus = "disputed";
  }
  await withCommerceTransaction(transaction, async (tx) => {
    await tx.execute(
      sql`select id from ${contestOrders} where id = ${orderId} for update`,
    );
    const [row] = await tx
      .select({ order: contestOrders, userPublicId: users.publicId })
      .from(contestOrders)
      .innerJoin(users, eq(contestOrders.userId, users.id))
      .where(eq(contestOrders.id, orderId))
      .limit(1);
    if (
      !row ||
      row.userPublicId !== session.client_reference_id ||
      row.userPublicId !== session.metadata?.user_public_id ||
      (row.order.stripeSessionId && row.order.stripeSessionId !== session.id)
    )
      throw new Error("Identidade do pedido avulso divergente.");
    const { order } = row;
    if (["refunded", "disputed"].includes(order.status)) return;
    if (order.status === "paid" && !revokedStatus) {
      // Um retry legado pode encontrar os direitos já persistidos. A outbox
      // valida esses direitos e deduplica a confirmação sem ampliar o acesso.
      for (const line of order.lines) {
        await enqueuePurchaseDelivery(tx, {
          userId: order.userId,
          scope: "contest",
          purchaseId: order.id,
          productSlug: line.productSlug,
        });
      }
      return;
    }
    if (
      paid &&
      !orderPaymentMatches({
        expectedCents: order.amountCents,
        actualCents: session.amount_total,
        currency: session.currency,
        mode: session.mode,
        paymentStatus: session.payment_status,
        expectedLive: order.stripeMode === "live",
        actualLive: session.livemode,
      })
    )
      throw new Error("Valor ou modo do pedido avulso divergente.");
    if ((order.stripeMode === "live") !== session.livemode)
      throw new Error("Modo do pedido avulso divergente.");
    const status =
      revokedStatus ??
      (paid
        ? "paid"
        : event.type === "checkout.session.expired"
          ? "expired"
          : event.type === "checkout.session.async_payment_failed"
            ? "failed"
            : "pending");
    await tx
      .update(contestOrders)
      .set({
        status,
        stripeSessionId: session.id,
        stripePaymentIntentId: paymentIntentId ?? null,
        updatedAt: new Date(),
      })
      .where(eq(contestOrders.id, order.id));
    if (revokedStatus) {
      await tx
        .update(contestPurchases)
        .set({ status: "revoked", updatedAt: new Date() })
        .where(eq(contestPurchases.orderId, order.id));
      return;
    }
    if (!paid) return;
    const start = new Date(event.created * 1000);
    for (const line of order.lines) {
      await tx
        .insert(contestPurchases)
        .values({
          orderId: order.id,
          productSlug: line.productSlug,
          opportunityId: line.opportunityId,
          userId: order.userId,
          accessStartsAt: start,
          accessEndsAt: accessEndsAt(start, line.months),
          status: "active",
        })
        .onConflictDoNothing();
      await enqueuePurchaseDelivery(tx, {
        userId: order.userId,
        scope: "contest",
        purchaseId: order.id,
        productSlug: line.productSlug,
      });
    }
  });
  return true;
}
