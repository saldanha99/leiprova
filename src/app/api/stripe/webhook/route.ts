import { NextRequest } from "next/server";

import { processStripeEvent } from "@/app/api/stripe/webhook/process";
import { getDb } from "@/lib/db/client";
import { stripeEvents } from "@/lib/db/schema";
import { processMasterStripeEvent } from "@/lib/stripe/master-subscription";
import { withTrackedContestStripeEvent } from "@/lib/commerce/webhook-transaction";
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

  // O Master mantém sua unidade própria; não é executado dentro da tx dos concursos.
  try {
    if (await processMasterStripeEvent(event, { trackEvent: true })) {
      return Response.json({ received: true });
    }
  } catch {
    return Response.json({ error: "Falha ao reconciliar o pagamento Master." }, { status: 500 });
  }

  try {
    const result = await withTrackedContestStripeEvent(event, (tx) => processStripeEvent(event, tx));
    return Response.json({ received: true, ...(result.duplicate ? { duplicate: true } : {}) });
  } catch {
    // Rollback preserva o estado anterior. Não gravar failed fora da tx: uma
    // execução que perdeu a conexão não pode sobrescrever um retry já concluído.
    return Response.json({ error: "Falha ao processar o evento." }, { status: 500 });
  }
}
