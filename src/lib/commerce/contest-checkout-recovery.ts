import "server-only";
import { sql } from "drizzle-orm";
import type Stripe from "stripe";
import type { getDb } from "@/lib/db/client";
import type { contestOrders } from "@/lib/db/schema";
import { CONTEST_SUBSCRIPTION_COMMERCE } from "./subscription-policy";

export type RecoverableContestOrder = typeof contestOrders.$inferSelect;
type Database = Pick<ReturnType<typeof getDb>, "execute">;
type Sessions = Pick<Stripe["checkout"]["sessions"], "list" | "retrieve" | "expire">;
const requestOptions = { timeout: 8_000, maxNetworkRetries: 1 };
const objectId = (value: string | { id: string } | null) => typeof value === "string" ? value : value?.id ?? null;

export function originalContestCheckoutExpiry(order: Pick<RecoverableContestOrder, "createdAt">) {
  return Math.floor(order.createdAt.getTime() / 1_000) + 3_600;
}

export function validateContestCheckoutSession(order: RecoverableContestOrder, userPublicId: string, session: Stripe.Checkout.Session) {
  const commerce = session.metadata?.commerce;
  if (!session.id || (order.stripeSessionId && session.id !== order.stripeSessionId) ||
      session.metadata?.app !== "leiprova" || session.metadata.order_id !== order.id ||
      session.metadata.user_public_id !== userPublicId || session.client_reference_id !== userPublicId ||
      session.livemode !== (order.stripeMode === "live") || session.ui_mode !== order.checkoutUiMode ||
      (order.stripeCustomerId && objectId(session.customer) !== order.stripeCustomerId) ||
      !((commerce === CONTEST_SUBSCRIPTION_COMMERCE && session.mode === "subscription") ||
        (commerce === "contest_v1" && session.mode === "payment" && order.stripeSessionId === session.id)) ||
      !["open", "complete", "expired"].includes(session.status ?? ""))
    throw new Error("contest_checkout_session_identity_mismatch");
}

/** A busca deve terminar integralmente dentro do limite; uma página parcial nunca prova ausência. */
export async function findRecoverableContestSession(sessions: Sessions, order: RecoverableContestOrder, userPublicId: string) {
  if (order.stripeSessionId) {
    const session = await sessions.retrieve(order.stripeSessionId, {}, requestOptions);
    validateContestCheckoutSession(order, userPublicId, session);
    return session;
  }
  if (!order.stripeCustomerId) throw new Error("contest_checkout_recovery_customer_missing");
  let cursor: string | undefined;
  const seen = new Set<string>();
  const matches: Stripe.Checkout.Session[] = [];
  for (let page = 0; page < 5; page += 1) {
    // Sem filtro temporal: diferença de relógio nunca transforma uma sessão existente em ausência.
    const result = await sessions.list({ customer: order.stripeCustomerId, limit: 100,
      ...(cursor ? { starting_after: cursor } : {}),
    }, requestOptions);
    if (!Array.isArray(result.data) || typeof result.has_more !== "boolean" || result.data.length > 100)
      throw new Error("contest_checkout_recovery_incomplete");
    for (const session of result.data) {
      if (!session.id || seen.has(session.id)) throw new Error("contest_checkout_recovery_page_ambiguous");
      seen.add(session.id);
      if (session.metadata?.order_id === order.id) matches.push(session);
    }
    if (matches.length > 1) throw new Error("contest_checkout_recovery_duplicate_sessions");
    if (!result.has_more) {
      if (!matches.length) return null;
      validateContestCheckoutSession(order, userPublicId, matches[0]);
      // A lista localiza; retrieve entrega o estado atual e o segredo de retomada quando aplicável.
      const fresh = await sessions.retrieve(matches[0].id, {}, requestOptions);
      if (fresh.id !== matches[0].id) throw new Error("contest_checkout_session_identity_mismatch");
      validateContestCheckoutSession(order, userPublicId, fresh);
      return fresh;
    }
    if (!result.data.length) throw new Error("contest_checkout_recovery_incomplete");
    cursor = result.data.at(-1)!.id;
  }
  throw new Error("contest_checkout_recovery_incomplete");
}

export async function markContestCreationStarted(db: Database, order: RecoverableContestOrder, customerId: string) {
  const rows = await db.execute<{ id: string }>(sql`
    update contest_orders set stripe_customer_id = ${customerId},
      stripe_creation_started_at = coalesce(stripe_creation_started_at,now()),updated_at = now()
    where id = ${order.id} and user_id = ${order.userId} and status in ('created','pending')
      and stripe_session_id is null and checkout_ui_mode = ${order.checkoutUiMode}
      and (stripe_customer_id is null or stripe_customer_id = ${customerId})
      and floor(extract(epoch from created_at)) + 3600 > floor(extract(epoch from now()))
    returning id
  `);
  return rows.length === 1;
}

export async function persistContestCheckoutSession(db: Database, order: RecoverableContestOrder, sessionId: string) {
  const rows = await db.execute<{ id: string }>(sql`
    update contest_orders set stripe_session_id = ${sessionId},status = 'pending',updated_at = now()
    where id = ${order.id} and user_id = ${order.userId} and status in ('created','pending')
      and (stripe_session_id is null or stripe_session_id = ${sessionId})
      and checkout_ui_mode = ${order.checkoutUiMode}
      and stripe_customer_id is not distinct from ${order.stripeCustomerId}
    returning id
  `);
  return rows.length === 1;
}

export async function expireContestCheckoutSnapshot(db: Database, order: RecoverableContestOrder,
  reason: "never_started" | "original_expiry" | "stripe_expired") {
  const rows = await db.execute<{ id: string }>(sql`
    update contest_orders set status = 'expired',updated_at = now()
    where id = ${order.id} and user_id = ${order.userId} and status in ('created','pending')
      and stripe_session_id is not distinct from ${order.stripeSessionId}
      and checkout_ui_mode = ${order.checkoutUiMode}
      and stripe_customer_id is not distinct from ${order.stripeCustomerId}
      and ${reason === "never_started" ? sql`stripe_creation_started_at is null and stripe_session_id is null`
        : reason === "original_expiry" ? sql`stripe_session_id is null and stripe_creation_started_at is not null
          and floor(extract(epoch from created_at)) + 3600 <= floor(extract(epoch from now()))` : sql`true`}
    returning id
  `);
  return rows.length === 1;
}

export async function cancelRecoverableContestOrder(db: Database, sessions: Sessions | (() => Sessions), order: RecoverableContestOrder,
  userPublicId: string, now = new Date()): Promise<"cancelled" | "completed" | "wait" | "conflict"> {
  if (!["created", "pending"].includes(order.status)) return "conflict";
  if (!order.stripeSessionId && !order.stripeCreationStartedAt)
    return await expireContestCheckoutSnapshot(db, order, "never_started") ? "cancelled" : "conflict";
  const stripeSessions = typeof sessions === "function" ? sessions() : sessions;
  let session = await findRecoverableContestSession(stripeSessions, order, userPublicId);
  if (!session) {
    if (Math.floor(now.getTime() / 1_000) < originalContestCheckoutExpiry(order)) return "wait";
    return await expireContestCheckoutSnapshot(db, order, "original_expiry") ? "cancelled" : "conflict";
  }
  if (session.status === "complete") return "completed";
  if (session.status === "open") {
    session = await stripeSessions.expire(session.id, {}, requestOptions);
    validateContestCheckoutSession(order, userPublicId, session);
  }
  if (session.status !== "expired") return session.status === "complete" ? "completed" : "conflict";
  // A Stripe já confirmou a expiração; o CAS não sobrescreve pagamento/webhook concorrente.
  return await expireContestCheckoutSnapshot(db, order, "stripe_expired") ? "cancelled" : "conflict";
}
