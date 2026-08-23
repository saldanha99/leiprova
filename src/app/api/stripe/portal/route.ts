import { randomUUID } from "node:crypto";

import { NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import {
  getPublicOrigin,
  getStripeClient,
  getStripePortalConfiguration,
  hasTrustedOrigin,
} from "@/lib/stripe";

export const runtime = "nodejs";

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export async function POST(request: NextRequest) {
  if (!hasTrustedOrigin(request)) return jsonError("Origem da solicitação não autorizada.", 403);

  const configuration = getStripePortalConfiguration();
  if (!configuration) return jsonError("A gestão da assinatura está temporariamente indisponível.", 503);

  const user = await getCurrentUser();
  if (!user) return jsonError("Entre na sua conta para continuar.", 401);
  if (!user.stripeCustomerId) return jsonError("Sua conta ainda não possui uma assinatura gerenciável.", 409);

  try {
    const portalSession = await getStripeClient(configuration.secretKey).billingPortal.sessions.create(
      {
        customer: user.stripeCustomerId,
        return_url: `${getPublicOrigin(request)}/app/assinatura`,
        ...(configuration.portalConfigurationId
          ? { configuration: configuration.portalConfigurationId }
          : {}),
      },
      { idempotencyKey: `portal:${user.publicId}:${randomUUID()}` },
    );

    return Response.json({ url: portalSession.url });
  } catch {
    return jsonError("Não foi possível abrir a gestão da assinatura agora.", 502);
  }
}
