import "server-only";

import { and, eq, inArray, sql } from "drizzle-orm";
import type Stripe from "stripe";
import { normalizeSubscriptionStatus, objectId, parsePositiveInteger } from "@/app/api/stripe/webhook/mapping";
import { sendPurchaseAccessEmail } from "@/lib/account-access";
import { getDb } from "@/lib/db/client";
import { checkoutAttempts, contestBillingInvoices, contestOrders, plans, stripeEvents, subscriptions, users } from "@/lib/db/schema";
import { getStripeClient } from "@/lib/stripe";
import { isMasterMetadata, masterDisputesBlockAccess, masterInvoicePaymentIntent, masterPaymentReversal, paidMasterInvoicePeriod, validateMasterSubscription, type MasterBillingIdentity } from "./master-policy";

const requestOptions: Stripe.RequestOptions = { timeout: 8_000, maxNetworkRetries: 1 };

async function knownMasterSubscription(id: string | null) {
  if (!id) return false;
  const [row] = await getDb().select({ id: subscriptions.id }).from(subscriptions)
    .where(and(eq(subscriptions.provider, "stripe"), eq(subscriptions.providerSubscriptionId, id))).limit(1);
  return Boolean(row);
}

function finiteDate(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) return null;
  const date = new Date(value * 1000);
  return Number.isFinite(date.getTime()) ? date : null;
}

function validateSession(session: Stripe.Checkout.Session, identity: MasterBillingIdentity, storedSessionId: string | null) {
  const metadata = session.metadata;
  if (session.mode !== "subscription" || session.livemode !== identity.live ||
    (storedSessionId && session.id !== storedSessionId) ||
    (identity.subscriptionId && objectId(session.subscription) !== identity.subscriptionId) ||
    !identity.customerId || objectId(session.customer) !== identity.customerId ||
    session.client_reference_id !== identity.userPublicId || !isMasterMetadata(metadata) ||
    metadata.checkout_attempt_id !== identity.attemptId || metadata.user_public_id !== identity.userPublicId ||
    parsePositiveInteger(metadata.user_id) !== identity.userId || metadata.plan_slug !== identity.plan.slug) {
    throw new Error("Identidade do checkout Master divergente.");
  }
}

async function reconcileMasterSubscription(subscriptionId: string, live: boolean, options: {
  session?: Stripe.Checkout.Session;
  reversedInvoice?: Stripe.Invoice;
  reversedIntentId?: string;
  reversedChargeId?: string;
  disputeId?: string;
  event?: Stripe.Event;
} = {}) {
  const stripe = getStripeClient();
  const confirmation = await getDb().transaction(async (tx) => {
    // Um único lock, sempre antes de ler a Stripe: eventos concorrentes não reaplicam snapshots antigos.
    // Todas as consultas locais abaixo usam tx, sem pedir outra conexão enquanto a primeira está ocupada.
    await tx.execute(sql`set local idle_in_transaction_session_timeout = '60s'`);
    await tx.execute(sql`set local lock_timeout = '8s'`);
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`master-subscription:${subscriptionId}`}, 0))`);
    if (options.event) {
      const [stored] = await tx.select().from(stripeEvents).where(eq(stripeEvents.eventId, options.event.id)).for("update");
      if (!stored || stored.livemode !== options.event.livemode || stored.eventType !== options.event.type) throw new Error("Registro Master divergente.");
      if (stored.status === "processed") return null;
      // Recuperação segura: todos os direitos e a conclusão usam a mesma transação.
      await tx.update(stripeEvents).set({ status: "processing", errorMessage: null }).where(eq(stripeEvents.eventId, options.event.id));
    }
    const current = await stripe.subscriptions.retrieve(subscriptionId, {}, requestOptions);
    if (!isMasterMetadata(current.metadata) || !current.metadata.checkout_attempt_id) {
      throw new Error("Assinatura Master sem tentativa local; reconciliação assistida necessária.");
    }
    const [context] = await tx.select({ attempt: checkoutAttempts, user: users, plan: plans })
      .from(checkoutAttempts).innerJoin(users, eq(users.id, checkoutAttempts.userId))
      .innerJoin(plans, eq(plans.id, checkoutAttempts.planId))
      .where(eq(checkoutAttempts.id, current.metadata.checkout_attempt_id)).limit(1);
    if (!context) throw new Error("Assinatura Master sem tentativa local correspondente.");
    const [existing] = await tx.select().from(subscriptions)
      .where(eq(subscriptions.providerSubscriptionId, subscriptionId)).limit(1);
    if (existing && (existing.provider !== "stripe" || existing.userId !== context.user.id ||
      existing.planId !== context.plan.id || (existing.providerCheckoutSessionId && context.attempt.providerSessionId &&
      existing.providerCheckoutSessionId !== context.attempt.providerSessionId))) {
      throw new Error("Vínculo local da assinatura Master divergente.");
    }
    const identity: MasterBillingIdentity = {
      attemptId: context.attempt.id, userId: context.user.id, userPublicId: context.user.publicId,
      customerId: context.user.stripeCustomerId, subscriptionId, plan: context.plan, live,
    };
    const item = validateMasterSubscription(identity, current);
    const sessionId = context.attempt.providerSessionId ?? existing?.providerCheckoutSessionId ?? options.session?.id;
    if (!sessionId) throw new Error("Checkout Master ainda não persistido. Reenvie o evento.");
    // Reconsulta sob o lock; o snapshot recebido não pode trocar a titularidade.
    const currentSession = await stripe.checkout.sessions.retrieve(sessionId, {}, requestOptions);
    validateSession(currentSession, identity, sessionId);
    if (options.session) validateSession(options.session, identity, sessionId);
    if (options.reversedInvoice && (objectId(options.reversedInvoice.customer) !== identity.customerId ||
      objectId(options.reversedInvoice.parent?.subscription_details?.subscription) !== subscriptionId ||
      options.reversedInvoice.livemode !== live)) {
      throw new Error("Titularidade da devolução Master divergente.");
    }
    let status = normalizeSubscriptionStatus(current.status);
    if (status === "active" || status === "trialing") status = "incomplete";
    let start = finiteDate(item.current_period_start);
    let end = finiteDate(item.current_period_end);
    let paid = false;
    const invoiceId = objectId(current.latest_invoice);
    if (current.status === "active" && invoiceId) {
      {
        const invoice = await stripe.invoices.retrieve(invoiceId, {}, requestOptions);
        if (invoice.id !== invoiceId || invoice.livemode !== live || objectId(invoice.customer) !== identity.customerId ||
          objectId(invoice.parent?.subscription_details?.subscription) !== subscriptionId) {
          throw new Error("Vínculo da fatura Master divergente.");
        }
        if (invoice.status === "paid") {
          const payments = await stripe.invoicePayments.list({ invoice: invoiceId, status: "paid", limit: 10 }, requestOptions);
          const intentId = masterInvoicePaymentIntent(payments, invoice, live);
          const intent = await stripe.paymentIntents.retrieve(intentId, { expand: ["latest_charge"] }, requestOptions);
          if (intent.id !== intentId) throw new Error("Pagamento Master divergente.");
          // Estorno é conferido antes dos valores: nota de crédito não pode impedir a revogação.
          let reversal = masterPaymentReversal(intent, invoice, identity);
          if (reversal === "disputed" || (options.disputeId && options.reversedInvoice?.id === invoiceId)) {
            const disputes = await stripe.disputes.list({ charge: objectId(intent.latest_charge)!, limit: 100 }, requestOptions);
            const blocked = masterDisputesBlockAccess(disputes, intent, live);
            if (options.disputeId && options.reversedInvoice?.id === invoiceId && !disputes.data.some((row) => row.id === options.disputeId)) throw new Error("Disputa Master recebida não confere com a cobrança.");
            if (reversal !== "refunded") reversal = blocked ? "disputed" : null;
          }
          if (options.reversedInvoice?.id === invoiceId && (options.reversedIntentId !== intentId || options.reversedChargeId !== objectId(intent.latest_charge) || (!options.disputeId && !reversal))) throw new Error("Estorno Master ainda não confirmado no pagamento atual.");
          if (reversal) {
            status = "unpaid";
          } else {
            const period = paidMasterInvoicePeriod(invoice, current, identity);
            if (period) {
              start = period.start;
              end = period.end;
              status = "active";
              paid = true;
            }
          }
        }
      }
    }
    if (paid && (!start || !end || end <= start)) throw new Error("Vigência Master inválida.");
    const values = {
      status, currentPeriodStart: start, currentPeriodEnd: end, accessEndsAt: end,
      providerCheckoutSessionId: sessionId, cancelAtPeriodEnd: current.cancel_at_period_end,
      canceledAt: finiteDate(current.canceled_at), updatedAt: new Date(),
    };
    await tx.insert(subscriptions).values({
      userId: context.user.id, planId: context.plan.id, provider: "stripe", providerSubscriptionId: subscriptionId, ...values,
    }).onConflictDoUpdate({ target: subscriptions.providerSubscriptionId, set: values });
    if (paid) await tx.update(checkoutAttempts).set({
      status: "completed", providerSessionId: sessionId, updatedAt: new Date(),
    }).where(eq(checkoutAttempts.id, context.attempt.id));
    if (options.event) await tx.update(stripeEvents).set({ status: "processed", processedAt: new Date(), errorMessage: null }).where(eq(stripeEvents.eventId, options.event.id));
    return paid && context.attempt.status !== "completed" ? {
      userId: context.user.id, checkoutAttemptId: context.attempt.id,
    } : null;
  });
  if (confirmation) {
    try { await sendPurchaseAccessEmail(confirmation); }
    catch { console.error("master_purchase_notification_failed", { checkoutAttemptId: confirmation.checkoutAttemptId }); }
  }
}

async function processMasterReversal(event: Stripe.Event, trackEvent: boolean) {
  if (event.type !== "charge.refunded" && event.type !== "charge.dispute.created" && event.type !== "charge.dispute.closed" && event.type !== "charge.dispute.updated") return false;
  const object = event.data.object as Stripe.Charge | Stripe.Dispute;
  const intentId = objectId(object.payment_intent);
  const chargeId = object.object === "charge" ? object.id : objectId(object.charge);
  if (!intentId || !chargeId) return false;
  // Não intercepta o caminho de estorno dos avulsos, que tem contrato próprio.
  const [contestOrder] = await getDb().select({ id: contestOrders.id }).from(contestOrders)
    .where(eq(contestOrders.stripePaymentIntentId, intentId)).limit(1);
  const [contestInvoice] = await getDb().select({ id: contestBillingInvoices.invoiceId }).from(contestBillingInvoices)
    .where(eq(contestBillingInvoices.paymentIntentId, intentId)).limit(1);
  if (contestOrder || contestInvoice) return false;
  const stripe = getStripeClient();
  const payments = await stripe.invoicePayments.list({ payment: { type: "payment_intent", payment_intent: intentId }, limit: 10 }, requestOptions);
  let handled = false;
  for (const payment of payments.data) {
    const invoiceId = objectId(payment.invoice);
    if (!invoiceId) continue;
    const invoice = await stripe.invoices.retrieve(invoiceId, {}, requestOptions);
    const subscriptionId = objectId(invoice.parent?.subscription_details?.subscription);
    if (!subscriptionId || (!isMasterMetadata(invoice.parent?.subscription_details?.metadata) && !await knownMasterSubscription(subscriptionId))) continue;
    if (payment.payment.type !== "payment_intent" || objectId(payment.payment.payment_intent) !== intentId ||
      payment.livemode !== event.livemode || invoice.livemode !== event.livemode || invoice.id !== invoiceId) {
      throw new Error("Vínculo financeiro da devolução Master divergente.");
    }
    if (payments.has_more || payments.data.length !== 1) throw new Error("Devolução Master com várias liquidações exige revisão.");
    await reconcileMasterSubscription(subscriptionId, event.livemode, { reversedInvoice: invoice, reversedIntentId: intentId, reversedChargeId: chargeId, disputeId: object.object === "dispute" ? object.id : undefined, event: trackEvent ? event : undefined });
    handled = true;
  }
  return handled;
}

export async function processMasterStripeEvent(event: Stripe.Event, { trackEvent = false } = {}) {
  if (event.account) return false;
  if (await processMasterReversal(event, trackEvent)) return true;
  if (["checkout.session.completed", "checkout.session.async_payment_succeeded", "checkout.session.async_payment_failed", "checkout.session.expired"].includes(event.type)) {
    const payload = event.data.object as Stripe.Checkout.Session;
    if (!isMasterMetadata(payload.metadata) && !await knownMasterSubscription(objectId(payload.subscription))) return false;
    const current = await getStripeClient().checkout.sessions.retrieve(payload.id, {}, requestOptions);
    if (current.id !== payload.id || current.mode !== "subscription" || current.livemode !== event.livemode || !isMasterMetadata(current.metadata)) {
      throw new Error("Checkout Master divergente ou legado; reconciliação assistida necessária.");
    }
    const subscriptionId = objectId(current.subscription);
    if (subscriptionId) await reconcileMasterSubscription(subscriptionId, event.livemode, { session: current, event: trackEvent ? event : undefined });
    else {
      const [context] = await getDb().select({ attempt: checkoutAttempts, user: users, plan: plans })
        .from(checkoutAttempts).innerJoin(users, eq(users.id, checkoutAttempts.userId))
        .innerJoin(plans, eq(plans.id, checkoutAttempts.planId))
        .where(eq(checkoutAttempts.id, current.metadata.checkout_attempt_id ?? "")).limit(1);
      if (!context) throw new Error("Checkout Master sem tentativa local correspondente.");
      validateSession(current, {
        attemptId: context.attempt.id, userId: context.user.id, userPublicId: context.user.publicId,
        customerId: context.user.stripeCustomerId, plan: context.plan, live: event.livemode,
      }, context.attempt.providerSessionId);
      // Evento tardio sem assinatura não desfaz a confirmação de uma compra concluída.
      await getDb().update(checkoutAttempts).set({
        providerSessionId: current.id, status: current.status === "expired" ? "expired" : "session_created", updatedAt: new Date(),
      }).where(and(eq(checkoutAttempts.id, context.attempt.id), inArray(checkoutAttempts.status, ["created", "session_created"])));
    }
    if (trackEvent && !subscriptionId) await getDb().update(stripeEvents).set({ status: "processed", processedAt: new Date(), errorMessage: null }).where(eq(stripeEvents.eventId, event.id));
    return true;
  }
  let subscriptionId: string | null = null;
  let metadata: Stripe.Metadata | null | undefined;
  if (["customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted", "customer.subscription.paused", "customer.subscription.resumed"].includes(event.type)) {
    const payload = event.data.object as Stripe.Subscription;
    subscriptionId = payload.id;
    metadata = payload.metadata;
  } else if (["invoice.paid", "invoice.payment_failed", "invoice.payment_action_required", "invoice.voided", "invoice.marked_uncollectible"].includes(event.type)) {
    const payload = event.data.object as Stripe.Invoice;
    subscriptionId = objectId(payload.parent?.subscription_details?.subscription);
    metadata = payload.parent?.subscription_details?.metadata;
  }
  if (!subscriptionId || (!isMasterMetadata(metadata) && !await knownMasterSubscription(subscriptionId))) return false;
  await reconcileMasterSubscription(subscriptionId, event.livemode, { event: trackEvent ? event : undefined });
  return true;
}
