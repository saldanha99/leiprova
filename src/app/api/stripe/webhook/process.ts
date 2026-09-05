import "server-only";

import { and, eq, isNull } from "drizzle-orm";
import type Stripe from "stripe";

import { sendPurchaseAccessEmail } from "@/lib/account-access";
import { getDb } from "@/lib/db/client";
import {
  checkoutAttempts,
  plans as billingPlans,
  subscriptions,
  users,
} from "@/lib/db/schema";
import { getPlanByStripePriceId } from "@/lib/stripe";
import { processContestStripeEvent } from "@/lib/commerce/webhook";
import { processContestSubscriptionEvent } from "@/lib/commerce/subscription-webhook";

import {
  isLeiProvaMetadata,
  normalizeSubscriptionStatus,
  objectId,
  parsePositiveInteger,
  subscriptionPeriod,
  unixDate,
  type LocalSubscriptionStatus,
} from "./mapping";

type BillingContext = {
  userId: number;
  planId: number;
  attemptId: string | null;
  checkoutSessionId: string | null;
};

export async function processStripeEvent(event: Stripe.Event) {
  if (await processContestSubscriptionEvent(event)) return;
  if (await processContestStripeEvent(event)) return;
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded":
    case "checkout.session.async_payment_failed":
    case "checkout.session.expired":
      await handleCheckoutSession(
        event.data.object as Stripe.Checkout.Session,
        event.type,
      );
      return;

    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      await handleSubscription(
        event.data.object as Stripe.Subscription,
        event.type,
      );
      return;

    case "invoice.paid":
    case "invoice.payment_failed":
    case "invoice.payment_action_required":
      await handleInvoice(event.data.object as Stripe.Invoice, event.type);
      return;

    default:
      return;
  }
}

async function handleCheckoutSession(
  session: Stripe.Checkout.Session,
  eventType:
    | "checkout.session.completed"
    | "checkout.session.async_payment_succeeded"
    | "checkout.session.async_payment_failed"
    | "checkout.session.expired",
) {
  const metadata = session.metadata;
  if (!isLeiProvaMetadata(metadata)) return;

  const attemptId = metadata.checkout_attempt_id;
  const context = await resolveBillingContext({
    metadata,
    checkoutSessionId: session.id,
  });
  if (!context || !attemptId)
    throw new Error("Checkout LeiProva sem tentativa correspondente.");

  const customerId = objectId(session.customer);
  if (customerId) await attachCustomerToUser(context.userId, customerId);

  const failed = eventType === "checkout.session.async_payment_failed";
  const expired = eventType === "checkout.session.expired";
  const paid =
    eventType === "checkout.session.async_payment_succeeded" ||
    session.payment_status === "paid" ||
    session.payment_status === "no_payment_required";

  const attemptStatus = failed
    ? "failed"
    : expired
      ? "expired"
      : paid
        ? "completed"
        : "session_created";

  await getDb()
    .update(checkoutAttempts)
    .set({
      providerSessionId: session.id,
      status: attemptStatus,
      updatedAt: new Date(),
    })
    .where(eq(checkoutAttempts.id, attemptId));

  if (failed || expired) {
    await getDb()
      .update(subscriptions)
      .set({ status: "expired", updatedAt: new Date() })
      .where(eq(subscriptions.providerCheckoutSessionId, session.id));
    return;
  }

  if (session.mode === "subscription") {
    const providerSubscriptionId = objectId(session.subscription);
    if (!providerSubscriptionId) return;

    await upsertRecurringSubscription({
      context,
      providerSubscriptionId,
      status: paid ? "active" : "incomplete",
    });
    if (paid) await notifyPurchaseAccess(context.userId, attemptId);
    return;
  }

  if (session.mode === "payment") {
    await upsertOneTimeAccess({
      context,
      checkoutSessionId: session.id,
      status: paid ? "active" : "incomplete",
    });
    if (paid) await notifyPurchaseAccess(context.userId, attemptId);
  }
}

async function notifyPurchaseAccess(userId: number, checkoutAttemptId: string) {
  try {
    await sendPurchaseAccessEmail({ userId, checkoutAttemptId });
  } catch {
    // A liberação da compra não pode ser revertida por indisponibilidade do canal de e-mail.
    console.error("purchase_access_notification_failed", {
      userId,
      checkoutAttemptId,
    });
  }
}

async function handleSubscription(
  subscription: Stripe.Subscription,
  eventType:
    | "customer.subscription.created"
    | "customer.subscription.updated"
    | "customer.subscription.deleted",
) {
  const metadata = subscription.metadata;
  if (!isLeiProvaMetadata(metadata)) return;

  const firstPriceId = subscription.items.data[0]?.price.id ?? null;
  const context = await resolveBillingContext({
    metadata,
    providerSubscriptionId: subscription.id,
    priceId: firstPriceId,
  });
  if (!context)
    throw new Error("Assinatura LeiProva sem usuário ou plano correspondente.");

  const customerId = objectId(subscription.customer);
  if (customerId) await attachCustomerToUser(context.userId, customerId);

  const status =
    eventType === "customer.subscription.deleted"
      ? "canceled"
      : normalizeSubscriptionStatus(subscription.status);
  const periods = subscriptionPeriod(subscription);

  await upsertRecurringSubscription({
    context,
    providerSubscriptionId: subscription.id,
    status,
    currentPeriodStart: periods.start,
    currentPeriodEnd: periods.end,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    canceledAt: unixDate(subscription.canceled_at),
  });

  if ((status === "active" || status === "trialing") && context.attemptId) {
    await getDb()
      .update(checkoutAttempts)
      .set({ status: "completed", updatedAt: new Date() })
      .where(eq(checkoutAttempts.id, context.attemptId));
  }
}

async function handleInvoice(
  invoice: Stripe.Invoice,
  eventType:
    | "invoice.paid"
    | "invoice.payment_failed"
    | "invoice.payment_action_required",
) {
  const subscriptionDetails = invoice.parent?.subscription_details;
  const legacyInvoice = invoice as Stripe.Invoice & {
    subscription?: string | Stripe.Subscription | null;
    subscription_details?: { metadata?: Stripe.Metadata | null } | null;
  };
  const metadata =
    subscriptionDetails?.metadata ??
    legacyInvoice.subscription_details?.metadata ??
    invoice.metadata;
  if (!isLeiProvaMetadata(metadata)) return;

  const providerSubscriptionId =
    objectId(subscriptionDetails?.subscription) ??
    objectId(legacyInvoice.subscription);
  if (!providerSubscriptionId) return;

  const context = await resolveBillingContext({
    metadata,
    providerSubscriptionId,
  });
  if (!context)
    throw new Error("Fatura LeiProva sem assinatura correspondente.");

  const status: LocalSubscriptionStatus =
    eventType === "invoice.paid" ? "active" : "past_due";
  await upsertRecurringSubscription({
    context,
    providerSubscriptionId,
    status,
    currentPeriodStart: unixDate(invoice.period_start),
    currentPeriodEnd: unixDate(invoice.period_end),
  });

  if (eventType === "invoice.paid" && context.attemptId) {
    await getDb()
      .update(checkoutAttempts)
      .set({ status: "completed", updatedAt: new Date() })
      .where(eq(checkoutAttempts.id, context.attemptId));
  }
}

async function resolveBillingContext({
  metadata,
  providerSubscriptionId,
  checkoutSessionId,
  priceId,
}: {
  metadata: Stripe.Metadata | null;
  providerSubscriptionId?: string;
  checkoutSessionId?: string;
  priceId?: string | null;
}): Promise<BillingContext | null> {
  const db = getDb();
  const metadataAttemptId = metadata?.checkout_attempt_id ?? null;

  const [attempt] = metadataAttemptId
    ? await db
        .select({
          id: checkoutAttempts.id,
          userId: checkoutAttempts.userId,
          planId: checkoutAttempts.planId,
          planSlug: billingPlans.slug,
          providerSessionId: checkoutAttempts.providerSessionId,
        })
        .from(checkoutAttempts)
        .innerJoin(billingPlans, eq(checkoutAttempts.planId, billingPlans.id))
        .where(eq(checkoutAttempts.id, metadataAttemptId))
        .limit(1)
    : checkoutSessionId
      ? await db
          .select({
            id: checkoutAttempts.id,
            userId: checkoutAttempts.userId,
            planId: checkoutAttempts.planId,
            planSlug: billingPlans.slug,
            providerSessionId: checkoutAttempts.providerSessionId,
          })
          .from(checkoutAttempts)
          .innerJoin(billingPlans, eq(checkoutAttempts.planId, billingPlans.id))
          .where(eq(checkoutAttempts.providerSessionId, checkoutSessionId))
          .limit(1)
      : [];

  const [existing] = providerSubscriptionId
    ? await db
        .select({
          userId: subscriptions.userId,
          planId: subscriptions.planId,
          providerCheckoutSessionId: subscriptions.providerCheckoutSessionId,
        })
        .from(subscriptions)
        .where(eq(subscriptions.providerSubscriptionId, providerSubscriptionId))
        .limit(1)
    : [];

  const metadataUserId = parsePositiveInteger(metadata?.user_id);
  if (attempt && metadataUserId && attempt.userId !== metadataUserId) {
    throw new Error("Usuário do webhook diverge da tentativa de checkout.");
  }
  if (existing && metadataUserId && existing.userId !== metadataUserId) {
    throw new Error("Usuário do webhook diverge da assinatura persistida.");
  }

  const userId = existing?.userId ?? attempt?.userId ?? metadataUserId;
  if (!userId) return null;

  const pricePlan = getPlanByStripePriceId(priceId);
  const desiredPlanSlug =
    pricePlan?.slug ?? metadata?.plan_slug ?? attempt?.planSlug ?? null;
  let planId = existing?.planId ?? attempt?.planId ?? null;

  if (
    desiredPlanSlug &&
    (!attempt || desiredPlanSlug !== attempt.planSlug || !planId)
  ) {
    const [storedPlan] = await db
      .select({ id: billingPlans.id })
      .from(billingPlans)
      .where(eq(billingPlans.slug, desiredPlanSlug))
      .limit(1);
    planId = storedPlan?.id ?? null;
  }

  if (!planId) return null;

  return {
    userId,
    planId,
    attemptId: attempt?.id ?? metadataAttemptId,
    checkoutSessionId:
      checkoutSessionId ??
      attempt?.providerSessionId ??
      existing?.providerCheckoutSessionId ??
      null,
  };
}

async function upsertRecurringSubscription({
  context,
  providerSubscriptionId,
  status,
  currentPeriodStart,
  currentPeriodEnd,
  cancelAtPeriodEnd,
  canceledAt,
}: {
  context: BillingContext;
  providerSubscriptionId: string;
  status: LocalSubscriptionStatus;
  currentPeriodStart?: Date | null;
  currentPeriodEnd?: Date | null;
  cancelAtPeriodEnd?: boolean;
  canceledAt?: Date | null;
}) {
  const now = new Date();
  const updateValues: Partial<typeof subscriptions.$inferInsert> = {
    userId: context.userId,
    planId: context.planId,
    status,
    updatedAt: now,
  };

  if (context.checkoutSessionId) {
    updateValues.providerCheckoutSessionId = context.checkoutSessionId;
  }
  if (currentPeriodStart !== undefined)
    updateValues.currentPeriodStart = currentPeriodStart;
  if (currentPeriodEnd !== undefined) {
    updateValues.currentPeriodEnd = currentPeriodEnd;
    updateValues.accessEndsAt = currentPeriodEnd;
  }
  if (cancelAtPeriodEnd !== undefined)
    updateValues.cancelAtPeriodEnd = cancelAtPeriodEnd;
  if (canceledAt !== undefined) updateValues.canceledAt = canceledAt;

  await getDb()
    .insert(subscriptions)
    .values({
      userId: context.userId,
      planId: context.planId,
      provider: "stripe",
      providerSubscriptionId,
      providerCheckoutSessionId: context.checkoutSessionId,
      status,
      currentPeriodStart: currentPeriodStart ?? null,
      currentPeriodEnd: currentPeriodEnd ?? null,
      accessEndsAt: currentPeriodEnd ?? null,
      cancelAtPeriodEnd: cancelAtPeriodEnd ?? false,
      canceledAt: canceledAt ?? null,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: subscriptions.providerSubscriptionId,
      set: updateValues,
    });
}

async function upsertOneTimeAccess({
  context,
  checkoutSessionId,
  status,
}: {
  context: BillingContext;
  checkoutSessionId: string;
  status: "incomplete" | "active";
}) {
  const now = new Date();

  await getDb()
    .insert(subscriptions)
    .values({
      userId: context.userId,
      planId: context.planId,
      provider: "stripe",
      providerSubscriptionId: null,
      providerCheckoutSessionId: checkoutSessionId,
      status,
      currentPeriodStart: status === "active" ? now : null,
      currentPeriodEnd: null,
      accessEndsAt: null,
      cancelAtPeriodEnd: false,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: subscriptions.providerCheckoutSessionId,
      set: {
        planId: context.planId,
        status,
        ...(status === "active" ? { currentPeriodStart: now } : {}),
        updatedAt: now,
      },
    });
}

async function attachCustomerToUser(userId: number, customerId: string) {
  const db = getDb();
  const [user] = await db
    .select({ stripeCustomerId: users.stripeCustomerId })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) throw new Error("Usuário do webhook não existe.");
  if (user.stripeCustomerId && user.stripeCustomerId !== customerId) {
    throw new Error("Customer Stripe diverge do usuário persistido.");
  }

  if (!user.stripeCustomerId) {
    await db
      .update(users)
      .set({ stripeCustomerId: customerId, updatedAt: new Date() })
      .where(and(eq(users.id, userId), isNull(users.stripeCustomerId)));
  }
}
