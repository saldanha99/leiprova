import { and, eq } from "drizzle-orm";
import { NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db/client";
import {
  checkoutAttempts,
  plans as billingPlans,
  subscriptions,
} from "@/lib/db/schema";
import { getStripePortalConfiguration } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CHECKOUT_SESSION_PATTERN = /^cs_[A-Za-z0-9_]{8,240}$/;

export async function GET(request: NextRequest) {
  if (!getStripePortalConfiguration()) {
    return Response.json({ error: "Consulta temporariamente indisponível." }, { status: 503 });
  }

  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Não autenticado." }, { status: 401 });

  const sessionId = request.nextUrl.searchParams.get("session_id");
  if (!sessionId || !CHECKOUT_SESSION_PATTERN.test(sessionId)) {
    return Response.json({ error: "Sessão inválida." }, { status: 400 });
  }

  const [record] = await getDb()
    .select({
      attemptStatus: checkoutAttempts.status,
      planName: billingPlans.name,
      subscriptionStatus: subscriptions.status,
    })
    .from(checkoutAttempts)
    .innerJoin(billingPlans, eq(checkoutAttempts.planId, billingPlans.id))
    .leftJoin(
      subscriptions,
      eq(subscriptions.providerCheckoutSessionId, checkoutAttempts.providerSessionId),
    )
    .where(
      and(
        eq(checkoutAttempts.userId, user.id),
        eq(checkoutAttempts.providerSessionId, sessionId),
      ),
    )
    .limit(1);

  if (!record) return Response.json({ error: "Sessão não encontrada." }, { status: 404 });

  const active = record.subscriptionStatus === "active" || record.subscriptionStatus === "trialing";
  const attention = record.subscriptionStatus === "past_due";
  const failed =
    record.attemptStatus === "failed" ||
    record.attemptStatus === "expired" ||
    record.subscriptionStatus === "canceled" ||
    record.subscriptionStatus === "unpaid" ||
    record.subscriptionStatus === "paused" ||
    record.subscriptionStatus === "expired";

  return Response.json({
    stage: active ? "active" : attention ? "attention" : failed ? "failed" : "processing",
    planName: record.planName,
  });
}
