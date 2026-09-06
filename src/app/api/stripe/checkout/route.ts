import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { NextRequest } from "next/server";
import type Stripe from "stripe";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db/client";
import {
  checkoutAttempts,
  plans as billingPlans,
  subscriptions,
  users,
} from "@/lib/db/schema";
import { getPlan } from "@/lib/plans";
import {
  getCheckoutAvailability,
  getPublicOrigin,
  getStripeClient,
  hasTrustedOrigin,
  stripeKeyExpectsLivemode,
  stripeMetadata,
} from "@/lib/stripe";

export const runtime = "nodejs";

const requestSchema = z.object({
  planSlug: z.string().min(1).max(40),
  attemptId: z.uuid(),
});

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

const stripeRequestOptions: Stripe.RequestOptions = { timeout: 8_000, maxNetworkRetries: 1 };
const pendingStatuses = ["created", "session_created"];

export async function POST(request: NextRequest) {
  if (!hasTrustedOrigin(request)) return jsonError("Origem da solicitação não autorizada.", 403);

  const input = requestSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) return jsonError("Tentativa de checkout inválida.", 400);

  const plan = getPlan(input.data.planSlug);
  if (!plan) return jsonError("Plano não encontrado.", 404);

  const availability = getCheckoutAvailability(plan);
  if (!availability.available) {
    return jsonError("Os pagamentos estão temporariamente indisponíveis.", 503);
  }

  const user = await getCurrentUser();
  if (!user) return jsonError("Entre na sua conta para continuar.", 401);

  const db = getDb();
  const [storedPlan] = await db
    .select({
      id: billingPlans.id,
      stripePriceId: billingPlans.stripePriceId,
      amountCents: billingPlans.amountCents,
      currency: billingPlans.currency,
      billingType: billingPlans.billingType,
    })
    .from(billingPlans)
    .where(and(eq(billingPlans.slug, plan.slug), eq(billingPlans.isActive, true)))
    .limit(1);

  if (!storedPlan) return jsonError("Este plano ainda não está disponível para compra.", 409);
  if (!storedPlan.stripePriceId || storedPlan.stripePriceId !== availability.priceId ||
    storedPlan.amountCents !== plan.priceCents || storedPlan.currency !== "brl" ||
    storedPlan.billingType !== (plan.billingMonths === 12 ? "year" : "month")) {
    return jsonError("A configuração deste plano precisa ser revisada.", 503);
  }
  const expectedLive = stripeKeyExpectsLivemode(process.env.STRIPE_SECRET_KEY?.trim() ?? "");
  if (expectedLive === null) return jsonError("Modo de pagamento indisponível.", 503);

  let selection;
  try {
    selection = await db.transaction(async (tx) => {
      await tx.execute(sql`set local lock_timeout = '8s'`);
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`master-checkout:${user.id}`},0))`);
      // Trava as tentativas ANTES de ler assinaturas: se o webhook concluiu
      // enquanto aguardávamos, sua assinatura já estará visível na consulta seguinte.
      const pending = await tx.select().from(checkoutAttempts).where(and(
        eq(checkoutAttempts.userId, user.id), inArray(checkoutAttempts.status, pendingStatuses),
      )).orderBy(asc(checkoutAttempts.createdAt)).limit(2).for("update");
      const [active] = await tx.select({ id: subscriptions.id }).from(subscriptions).where(and(
        eq(subscriptions.userId, user.id),
        inArray(subscriptions.status, ["active", "trialing", "past_due", "unpaid", "paused", "incomplete"]),
      )).limit(1);
      if (active) return { error: "Você já possui uma assinatura ativa ou em regularização. Gerencie-a na área de assinatura." };
      const [requested] = await tx.select().from(checkoutAttempts)
        .where(eq(checkoutAttempts.id, input.data.attemptId)).limit(1);
      if (requested && (requested.userId !== user.id || requested.planId !== storedPlan.id))
        return { error: "Esta tentativa de checkout não é válida." };
      if (pending.length > 1)
        return { error: "Há mais de uma tentativa Master antiga. Fale com o atendimento para conciliá-las antes de uma nova contratação." };
      if (pending[0]) {
        if (pending[0].planId !== storedPlan.id)
          return { error: "Já existe um pagamento Master pendente para outro plano. Retome esse plano ou fale com o atendimento antes de trocar." };
        return { attempt: pending[0] };
      }
      if (requested) return { attempt: requested };
      const createdAt = new Date(Math.floor(Date.now() / 1000) * 1000);
      await tx.insert(checkoutAttempts).values({
        id: input.data.attemptId, userId: user.id, planId: storedPlan.id, status: "created",
        createdAt, expiresAt: new Date(createdAt.getTime() + 3600_000),
      }).onConflictDoNothing();
      const [created] = await tx.select().from(checkoutAttempts)
        .where(eq(checkoutAttempts.id, input.data.attemptId)).limit(1);
      if (!created || created.userId !== user.id || created.planId !== storedPlan.id)
        return { error: "Esta tentativa de checkout não é válida." };
      return { attempt: created };
    });
  } catch {
    return jsonError("Não foi possível reservar sua tentativa. Tente novamente sem alterar o plano.", 503);
  }
  if (selection.error) return jsonError(selection.error, 409);
  const attempt = selection.attempt!;
  if (["expired", "failed"].includes(attempt.status))
    return jsonError("Esta tentativa foi encerrada. Recarregue a página para começar outra.", 409);
  if (attempt.status === "completed" && !attempt.providerSessionId)
    return jsonError("Pagamento concluído sem sessão local. Fale com o atendimento; não refaça a compra.", 409);

  const stripe = getStripeClient();

  if (attempt.providerSessionId) {
    try {
      const existingSession = await stripe.checkout.sessions.retrieve(attempt.providerSessionId,
        { expand: ["line_items.data.price"] }, stripeRequestOptions);
      const [fresh] = await db.select({ customerId: users.stripeCustomerId }).from(users).where(eq(users.id, user.id));
      validateSession(existingSession, { sessionId: attempt.providerSessionId, attemptId: attempt.id,
        userId: user.id, publicId: user.publicId, customerId: fresh?.customerId ?? null,
        planSlug: plan.slug, priceId: availability.priceId, amountCents: plan.priceCents,
        interval: plan.billingMonths === 12 ? "year" : "month", live: expectedLive });

      if (existingSession.status === "complete") {
        return Response.json({ completed: true, sessionId: existingSession.id }, { headers: { "Cache-Control": "no-store" } });
      }

      if (existingSession.status === "open" && existingSession.ui_mode === "elements" && existingSession.client_secret) {
        return Response.json({ clientSecret: existingSession.client_secret }, { headers: { "Cache-Control": "no-store" } });
      }
      if (existingSession.status === "expired") {
        await db.update(checkoutAttempts).set({ status: "expired", updatedAt: new Date() }).where(and(
          eq(checkoutAttempts.id, attempt.id), inArray(checkoutAttempts.status, pendingStatuses),
        ));
        return jsonError("Esta tentativa expirou. Recarregue a página para começar outra.", 409);
      }
      return jsonError("Esta sessão precisa de conciliação pelo atendimento. Não inicie outro pagamento.", 409);
    } catch {
      return jsonError("Não foi possível recuperar esta tentativa de pagamento.", 502);
    }
  }

  // O código antigo só persistia expiresAt depois da API. Sem ele, não sabemos
  // os parâmetros originais nem se uma sessão existe; não trocar chave ou cancelar por suposição.
  const expiresAt = attempt.expiresAt && Math.floor(attempt.expiresAt.getTime() / 1000);
  if (!expiresAt || expiresAt !== Math.floor(attempt.createdAt.getTime() / 1000) + 3600 ||
    expiresAt <= Math.floor(Date.now() / 1000) + 1800) {
    return jsonError("Sua tentativa precisa de conciliação antes de continuar. Fale com o atendimento; nenhum novo pagamento foi iniciado.", 409);
  }

  try {
    const customerId = await getOrCreateCustomer({
      stripe,
      user,
    });
    const metadata = stripeMetadata({
      userId: user.id,
      userPublicId: user.publicId,
      planSlug: plan.slug,
      attemptId: attempt.id,
    });
    const origin = getPublicOrigin(request);
    const price = await stripe.prices.retrieve(availability.priceId, {}, stripeRequestOptions);
    validatePrice(price, { priceId: availability.priceId, amountCents: plan.priceCents,
      interval: plan.billingMonths === 12 ? "year" : "month", live: expectedLive });

    const params: Stripe.Checkout.SessionCreateParams = {
      ui_mode: "elements",
      mode: "subscription",
      customer: customerId,
      client_reference_id: user.publicId,
      line_items: [{ price: availability.priceId, quantity: 1 }],
      locale: "pt-BR",
      allow_promotion_codes: true,
      billing_address_collection: "auto",
      expires_at: expiresAt,
      return_url: `${origin}/checkout/retorno?session_id={CHECKOUT_SESSION_ID}`,
      metadata,
      subscription_data: { metadata },
      expand: ["line_items.data.price"],
    };

    const session = await stripe.checkout.sessions.create(params, {
      // checkout_attempts.id is the durable source for the key used on every retry.
      idempotencyKey: `checkout:${attempt.id}`,
      ...stripeRequestOptions,
    });
    validateSession(session, { attemptId: attempt.id, userId: user.id, publicId: user.publicId,
      customerId, planSlug: plan.slug, priceId: availability.priceId, amountCents: plan.priceCents,
      interval: plan.billingMonths === 12 ? "year" : "month", live: expectedLive });
    if (session.ui_mode !== "elements" || session.status !== "open" || !session.client_secret)
      throw new Error("Checkout Session sem continuação válida.");

    await db
      .update(checkoutAttempts)
      .set({
        providerSessionId: session.id,
        status: "session_created",
        updatedAt: new Date(),
      })
      .where(and(eq(checkoutAttempts.id, attempt.id), eq(checkoutAttempts.status, "created"),
        isNull(checkoutAttempts.providerSessionId)));

    return Response.json({ clientSecret: session.client_secret }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return jsonError("Não foi possível iniciar o pagamento. Tente novamente em instantes.", 502);
  }
}

type CheckoutPriceIdentity = { priceId: string; amountCents: number; interval: "month" | "year"; live: boolean };
function validatePrice(price: Stripe.Price, expected: CheckoutPriceIdentity) {
  if (price.id !== expected.priceId || !price.active || price.livemode !== expected.live ||
    price.type !== "recurring" || price.billing_scheme !== "per_unit" || price.unit_amount !== expected.amountCents ||
    price.currency !== "brl" || price.recurring?.interval !== expected.interval ||
    price.recurring.interval_count !== 1 || price.recurring.usage_type !== "licensed") {
    throw new Error("Preço Master divergente.");
  }
}

function validateSession(session: Stripe.Checkout.Session, expected: CheckoutPriceIdentity & {
  sessionId?: string; attemptId: string; userId: number; publicId: string; customerId: string | null; planSlug: string;
}) {
  const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
  const metadata = session.metadata;
  const line = session.line_items?.data[0];
  if ((expected.sessionId && session.id !== expected.sessionId) || !session.id ||
    session.mode !== "subscription" || session.livemode !== expected.live || session.currency !== "brl" ||
    !expected.customerId || customerId !== expected.customerId || session.client_reference_id !== expected.publicId ||
    metadata?.app !== "leiprova" || (metadata.commerce && metadata.commerce !== "master_v2") ||
    metadata.checkout_attempt_id !== expected.attemptId || metadata.plan_slug !== expected.planSlug ||
    metadata.user_id !== String(expected.userId) || metadata.user_public_id !== expected.publicId ||
    !session.line_items || session.line_items.has_more || session.line_items.data.length !== 1 ||
    !line?.price || line.quantity !== 1 || session.amount_subtotal !== expected.amountCents) {
    throw new Error("Identidade da sessão Master divergente.");
  }
  validatePrice(line.price, expected);
}

async function getOrCreateCustomer({
  stripe,
  user,
}: {
  stripe: Stripe;
  user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;
}) {
  if (user.stripeCustomerId) return user.stripeCustomerId;

  const customer = await stripe.customers.create(
    {
      email: user.email,
      name: user.name,
      metadata: {
        app: "leiprova",
        user_id: String(user.id),
        user_public_id: user.publicId,
      },
    },
    { idempotencyKey: `customer:${user.publicId}`, ...stripeRequestOptions },
  );

  const db = getDb();
  const [claimedCustomer] = await db
    .update(users)
    .set({ stripeCustomerId: customer.id, updatedAt: new Date() })
    .where(and(eq(users.id, user.id), isNull(users.stripeCustomerId)))
    .returning({ stripeCustomerId: users.stripeCustomerId });

  if (claimedCustomer?.stripeCustomerId) return claimedCustomer.stripeCustomerId;

  const [freshUser] = await db
    .select({ stripeCustomerId: users.stripeCustomerId })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);

  return freshUser?.stripeCustomerId ?? customer.id;
}
