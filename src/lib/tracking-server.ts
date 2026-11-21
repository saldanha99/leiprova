import "server-only";

import { createHash } from "node:crypto";

import { and, desc, eq } from "drizzle-orm";

import { getDb } from "@/lib/db/client";
import { auditLogs } from "@/lib/db/schema";
import {
  attributionMetadata,
  type Attribution,
  type CheckoutTracking,
  type FunnelEventName,
} from "@/lib/tracking";

const ATTRIBUTION_ACTION = "tracking.checkout_attribution";

/**
 * Guarda a atribuição do checkout no nosso banco (primeira gravação por pedido vence).
 * Não vai para a sessão da Stripe: a sessão usa chave de idempotência por pedido e
 * parâmetros diferentes numa nova tentativa seriam recusados.
 * Nunca derruba o checkout: falha aqui só perde a atribuição.
 */
export async function recordCheckoutAttribution(input: {
  entityType: "checkout_attempt" | "contest_order";
  entityId: string;
  userId: number;
  tracking: CheckoutTracking | undefined;
}) {
  if (!input.tracking) return;
  try {
    const db = getDb();
    const [existing] = await db
      .select({ id: auditLogs.id })
      .from(auditLogs)
      .where(and(eq(auditLogs.action, ATTRIBUTION_ACTION), eq(auditLogs.entityId, input.entityId)))
      .limit(1);
    if (existing) return;
    await db.insert(auditLogs).values({
      actorUserId: input.userId,
      action: ATTRIBUTION_ACTION,
      entityType: input.entityType,
      entityId: input.entityId,
      metadata: {
        initiateCheckoutEventId: input.tracking.eventId,
        attribution: input.tracking.attribution,
      },
    });
  } catch {
    // Atribuição é acessória: o pagamento segue.
  }
}

export async function readCheckoutAttribution(entityId: string): Promise<Attribution | null> {
  const [row] = await getDb()
    .select({ metadata: auditLogs.metadata })
    .from(auditLogs)
    .where(and(eq(auditLogs.action, ATTRIBUTION_ACTION), eq(auditLogs.entityId, entityId)))
    .orderBy(desc(auditLogs.id))
    .limit(1);
  const value = (row?.metadata as { attribution?: Attribution | null } | undefined)?.attribution;
  return value ?? null;
}

export function sha256Normalized(value: string) {
  return createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

/**
 * Monta o evento server-side (formato do Data Client do Stape / CAPI) com o MESMO
 * event_id do Pixel. Função pura para teste.
 */
export function buildServerEvent(input: {
  name: FunnelEventName;
  eventId: string;
  eventTimeSec: number;
  email?: string | null;
  attribution: Attribution | null;
  value?: number;
  currency?: string;
  pageUrl?: string;
}) {
  const userData: Record<string, string> = {};
  if (input.email) userData.em = sha256Normalized(input.email);
  if (input.attribution?.fbp) userData.fbp = input.attribution.fbp;
  if (input.attribution?.fbc) userData.fbc = input.attribution.fbc;
  return {
    event_name: input.name,
    event_id: input.eventId,
    event_time: input.eventTimeSec,
    action_source: "website",
    ...(input.pageUrl ? { event_source_url: input.pageUrl } : {}),
    user_data: userData,
    custom_data: {
      ...(input.value !== undefined ? { value: input.value, currency: input.currency ?? "BRL" } : {}),
      ...attributionMetadata(input.attribution),
    },
  };
}

/**
 * Envia ao GTM server-side (Stape). Desligado sem STAPE_SERVER_EVENTS_URL (https).
 * Timeout curto e sem lançar erro: nunca atrasa nem derruba webhook ou checkout.
 */
export async function sendServerEvent(event: ReturnType<typeof buildServerEvent>) {
  const endpoint = process.env.STAPE_SERVER_EVENTS_URL?.trim();
  if (!endpoint?.startsWith("https://")) return { sent: false as const, reason: "disabled" };
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(event),
      signal: AbortSignal.timeout(3000),
    });
    return { sent: response.ok, status: response.status };
  } catch {
    return { sent: false as const, reason: "network" };
  }
}

type PaidSessionLike = {
  id: string;
  payment_status?: string | null;
  amount_total?: number | null;
  currency?: string | null;
  customer_details?: { email?: string | null } | null;
  metadata?: Record<string, string> | null;
};

/** Purchase pela CAPI quando a Stripe confirma o pagamento (cartão na hora, Pix depois). */
export async function sendPurchaseServerEvent(event: { type: string; created: number; data: { object: unknown } }) {
  if (event.type !== "checkout.session.completed" && event.type !== "checkout.session.async_payment_succeeded") return;
  const session = event.data.object as PaidSessionLike;
  if (session.payment_status !== "paid" || session.metadata?.app !== "leiprova") return;
  const entityId = session.metadata.checkout_attempt_id ?? session.metadata.order_id;
  try {
    const attribution = entityId ? await readCheckoutAttribution(entityId) : null;
    await sendServerEvent(buildServerEvent({
      name: "Purchase",
      eventId: `purchase_${session.id}`,
      eventTimeSec: event.created,
      email: session.customer_details?.email ?? null,
      attribution,
      value: typeof session.amount_total === "number" ? session.amount_total / 100 : undefined,
      currency: session.currency?.toUpperCase() ?? "BRL",
    }));
  } catch {
    // Nunca afeta a confirmação do pagamento.
  }
}
