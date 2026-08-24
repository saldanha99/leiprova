import { and, eq, inArray, isNull } from "drizzle-orm";
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
  stripeMetadata,
} from "@/lib/stripe";

export const runtime = "nodejs";

const requestSchema = z.object({
  planSlug: z.string().min(1).max(40),
  attemptId: z.uuid(),
});

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

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
    })
    .from(billingPlans)
    .where(and(eq(billingPlans.slug, plan.slug), eq(billingPlans.isActive, true)))
    .limit(1);

  if (!storedPlan) return jsonError("Este plano ainda não está disponível para compra.", 409);
  if (storedPlan.stripePriceId && storedPlan.stripePriceId !== availability.priceId) {
    return jsonError("A configuração deste plano precisa ser revisada.", 503);
  }

  const [currentSubscription] = await db
    .select({ id: subscriptions.id })
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.userId, user.id),
        inArray(subscriptions.status, ["active", "trialing", "past_due"]),
      ),
    )
    .limit(1);

  if (currentSubscription) {
    return jsonError("Você já possui um acesso ativo. Gerencie-o na área de assinatura.", 409);
  }

  await db
    .insert(checkoutAttempts)
    .values({
      id: input.data.attemptId,
      userId: user.id,
      planId: storedPlan.id,
      status: "created",
    })
    .onConflictDoNothing();

  const [attempt] = await db
    .select({
      id: checkoutAttempts.id,
      userId: checkoutAttempts.userId,
      planId: checkoutAttempts.planId,
      providerSessionId: checkoutAttempts.providerSessionId,
      status: checkoutAttempts.status,
    })
    .from(checkoutAttempts)
    .where(eq(checkoutAttempts.id, input.data.attemptId))
    .limit(1);

  if (!attempt || attempt.userId !== user.id || attempt.planId !== storedPlan.id) {
    return jsonError("Esta tentativa de checkout não é válida.", 409);
  }

  if (attempt.status === "completed" && attempt.providerSessionId) {
    return Response.json({ completed: true, sessionId: attempt.providerSessionId });
  }
  if (attempt.status === "expired" || attempt.status === "failed") {
    return jsonError("Esta tentativa expirou. Recarregue a página para começar outra.", 409);
  }

  const stripe = getStripeClient();

  if (attempt.providerSessionId) {
    try {
      const existingSession = await stripe.checkout.sessions.retrieve(attempt.providerSessionId);

      if (existingSession.status === "complete") {
        return Response.json({ completed: true, sessionId: existingSession.id });
      }

      if (existingSession.status === "open" && existingSession.client_secret) {
        return Response.json({ clientSecret: existingSession.client_secret });
      }

      await db
        .update(checkoutAttempts)
        .set({ status: "expired", updatedAt: new Date() })
        .where(eq(checkoutAttempts.id, attempt.id));

      return jsonError("Esta tentativa expirou. Recarregue a página para começar outra.", 409);
    } catch {
      return jsonError("Não foi possível recuperar esta tentativa de pagamento.", 502);
    }
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
    const expiresAt = Math.floor(Date.now() / 1000) + 60 * 60;

    const params: Stripe.Checkout.SessionCreateParams = {
      ui_mode: "custom",
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
    };

    const session = await stripe.checkout.sessions.create(params, {
      // checkout_attempts.id is the durable source for the key used on every retry.
      idempotencyKey: `checkout:${attempt.id}`,
    });

    if (!session.client_secret) throw new Error("Checkout Session sem client secret.");

    await db
      .update(checkoutAttempts)
      .set({
        providerSessionId: session.id,
        status: "session_created",
        expiresAt: new Date(session.expires_at * 1000),
        updatedAt: new Date(),
      })
      .where(eq(checkoutAttempts.id, attempt.id));

    return Response.json({ clientSecret: session.client_secret });
  } catch {
    return jsonError("Não foi possível iniciar o pagamento. Tente novamente em instantes.", 502);
  }
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
    { idempotencyKey: `customer:${user.publicId}` },
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
