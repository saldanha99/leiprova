import { and, eq, inArray } from "drizzle-orm";
import { NextRequest } from "next/server";

import { processStripeEvent } from "@/app/api/stripe/webhook/process";
import { getDb } from "@/lib/db/client";
import { stripeEvents } from "@/lib/db/schema";
import { processMasterStripeEvent } from "@/lib/stripe/master-subscription";
import {
  getStripeClient,
  getStripeWebhookConfiguration,
  stripeKeyExpectsLivemode,
} from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_WEBHOOK_BYTES = 512 * 1024;

export async function POST(request: NextRequest) {
  const configuration = getStripeWebhookConfiguration();
  if (!configuration) {
    return Response.json({ error: "Webhook indisponível." }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return Response.json({ error: "Assinatura ausente." }, { status: 400 });
  }

  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_WEBHOOK_BYTES) {
    return Response.json({ error: "Evento muito grande." }, { status: 413 });
  }

  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody, "utf8") > MAX_WEBHOOK_BYTES) {
    return Response.json({ error: "Evento muito grande." }, { status: 413 });
  }
  let event;

  try {
    event = getStripeClient(configuration.secretKey).webhooks.constructEvent(
      rawBody,
      signature,
      configuration.webhookSecret,
    );
  } catch {
    return Response.json({ error: "Assinatura inválida." }, { status: 400 });
  }

  const expectedLivemode = stripeKeyExpectsLivemode(configuration.secretKey);
  if (expectedLivemode !== null && event.livemode !== expectedLivemode) {
    return Response.json({ error: "Modo do evento incompatível." }, { status: 400 });
  }

  const db = getDb();
  const eventObject = event.data.object as { id?: string; object?: string };
  const payload = {
    objectId: eventObject.id ?? null,
    objectType: eventObject.object ?? null,
    created: event.created,
    requestId: event.request?.id ?? null,
  };

  await db
    .insert(stripeEvents)
    .values({
      eventId: event.id,
      eventType: event.type,
      apiVersion: event.api_version,
      livemode: event.livemode,
      status: "received",
      payload,
    })
    .onConflictDoNothing();

  // Master conclui evento e direitos na mesma transação. O claim legado abaixo
  // permanece reservado aos concursos e não bloqueia recuperar um Master interrompido.
  try {
    if (await processMasterStripeEvent(event, { trackEvent: true })) {
      return Response.json({ received: true });
    }
  } catch {
    return Response.json({ error: "Falha ao reconciliar o pagamento Master." }, { status: 500 });
  }

  const [claimed] = await db
    .update(stripeEvents)
    .set({ status: "processing", errorMessage: null })
    .where(
      and(
        eq(stripeEvents.eventId, event.id),
        inArray(stripeEvents.status, ["received", "failed"]),
      ),
    )
    .returning({ eventId: stripeEvents.eventId });

  if (!claimed) {
    const [storedEvent] = await db
      .select({ status: stripeEvents.status })
      .from(stripeEvents)
      .where(eq(stripeEvents.eventId, event.id))
      .limit(1);

    if (storedEvent?.status === "processed") {
      return Response.json({ received: true, duplicate: true });
    }

    return Response.json({ error: "Evento já está em processamento." }, { status: 409 });
  }

  try {
    await processStripeEvent(event);
    await db
      .update(stripeEvents)
      .set({ status: "processed", processedAt: new Date(), errorMessage: null })
      .where(eq(stripeEvents.eventId, event.id));

    return Response.json({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 2_000) : "Falha desconhecida.";

    await db
      .update(stripeEvents)
      .set({ status: "failed", errorMessage: message })
      .where(eq(stripeEvents.eventId, event.id));

    return Response.json({ error: "Falha ao processar o evento." }, { status: 500 });
  }
}
