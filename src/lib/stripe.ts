import "server-only";

import type { NextRequest } from "next/server";
import Stripe from "stripe";

import { isDatabaseConfigured } from "@/lib/db/client";
import { isSupplierIdentityComplete } from "@/lib/legal";
import { PLANS, type PlanDefinition } from "@/lib/plans";
import { getTransactionalEmailConfig } from "@/lib/transactional-email";
import { stripeCredentialsMatchMode } from "@/lib/commerce/stripe-mode-policy";

const STRIPE_API_VERSION: Stripe.LatestApiVersion = "2026-07-29.dahlia";

let stripeClient: Stripe | null = null;
let stripeClientKey: string | null = null;

function readEnv(name: string) {
  const value = process.env[name]?.trim();
  return value || null;
}

export function isCheckoutEnabled() {
  return process.env.CHECKOUT_ENABLED?.trim().toLowerCase() === "true";
}

export function isContestCheckoutEnabled() {
  return (
    isCheckoutEnabled() &&
    process.env.CONTEST_CHECKOUT_ENABLED?.trim().toLowerCase() === "true"
  );
}

export type CheckoutAvailability =
  | {
      available: true;
      publishableKey: string;
      priceId: string;
    }
  | {
      available: false;
      reason:
        | "disabled"
        | "supplier_identity"
        | "database"
        | "transactional_email"
        | "publishable_key"
        | "secret_key"
        | "mode"
        | "price"
        | "webhook";
    };

export function getCheckoutAvailability(
  plan: Pick<PlanDefinition, "stripePriceEnv">,
  configuredPriceId?: string,
): CheckoutAvailability {
  if (!isCheckoutEnabled()) return { available: false, reason: "disabled" };

  // Vender sem exibir nome empresarial, CNPJ e endereços viola o Decreto
  // 7.962/2013, art. 2º, I. A trava fica aqui, e não numa lista de tarefas,
  // para que seja impossível abrir o checkout com os documentos incompletos.
  if (!isSupplierIdentityComplete())
    return { available: false, reason: "supplier_identity" };

  if (!isDatabaseConfigured()) return { available: false, reason: "database" };

  // O comprador precisa conseguir criar a senha em outro dispositivo depois
  // da confirmação. Sem canal transacional validado, a venda permanece fechada.
  if (!getTransactionalEmailConfig())
    return { available: false, reason: "transactional_email" };

  const publishableKey = readEnv("STRIPE_PUBLISHABLE_KEY");
  if (!publishableKey) return { available: false, reason: "publishable_key" };

  if (!readEnv("STRIPE_SECRET_KEY"))
    return { available: false, reason: "secret_key" };

  if (
    !stripeCredentialsMatchMode(
      process.env,
      readEnv("STRIPE_SECRET_KEY")!,
      publishableKey,
    )
  )
    return { available: false, reason: "mode" };

  const priceId = configuredPriceId ?? readEnv(plan.stripePriceEnv);
  if (!priceId) return { available: false, reason: "price" };

  if (!readEnv("STRIPE_WEBHOOK_SECRET"))
    return { available: false, reason: "webhook" };

  return { available: true, publishableKey, priceId };
}

export function getStripeWebhookConfiguration() {
  // Fechar novas vendas não pode interromper cancelamentos e reembolsos existentes.
  if (!isDatabaseConfigured()) return null;

  const secretKey = readEnv("STRIPE_SECRET_KEY");
  const webhookSecret = readEnv("STRIPE_WEBHOOK_SECRET");
  if (!secretKey || !webhookSecret) return null;
  if (!stripeCredentialsMatchMode(process.env, secretKey)) return null;

  return { secretKey, webhookSecret };
}

export function getStripePortalConfiguration() {
  if (!isDatabaseConfigured()) return null;

  const secretKey = readEnv("STRIPE_SECRET_KEY");
  const webhookSecret = readEnv("STRIPE_WEBHOOK_SECRET");
  const publishableKey = readEnv("STRIPE_PUBLISHABLE_KEY");
  if (!secretKey || !webhookSecret || !publishableKey) return null;
  if (!stripeCredentialsMatchMode(process.env, secretKey, publishableKey))
    return null;

  return {
    secretKey,
    portalConfigurationId: readEnv("STRIPE_PORTAL_CONFIGURATION_ID"),
  };
}

export function getStripeClient(secretKey = readEnv("STRIPE_SECRET_KEY")) {
  if (!secretKey) throw new Error("Stripe não está configurada no servidor.");

  if (!stripeClient || stripeClientKey !== secretKey) {
    stripeClient = new Stripe(secretKey, {
      apiVersion: STRIPE_API_VERSION,
      maxNetworkRetries: 2,
      appInfo: {
        name: "Editalume",
        version: "0.1.0",
      },
    });
    stripeClientKey = secretKey;
  }

  return stripeClient;
}

export function getPlanByStripePriceId(priceId: string | null | undefined) {
  if (!priceId) return null;
  return PLANS.find((plan) => readEnv(plan.stripePriceEnv) === priceId) ?? null;
}

export function getPublicOrigin(request: NextRequest) {
  const configuredOrigin = readEnv("APP_URL") ?? readEnv("NEXT_PUBLIC_APP_URL");
  if (configuredOrigin) {
    try {
      const url = new URL(configuredOrigin);
      if (process.env.NODE_ENV === "production" && url.protocol !== "https:") {
        throw new Error("APP_URL precisa usar HTTPS em produção.");
      }
      return url.origin;
    } catch {
      if (process.env.NODE_ENV === "production") {
        throw new Error("APP_URL inválida em produção.");
      }
    }
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("APP_URL é obrigatória em produção.");
  }

  const forwardedHost = request.headers
    .get("x-forwarded-host")
    ?.split(",")[0]
    ?.trim();
  const forwardedProto = request.headers
    .get("x-forwarded-proto")
    ?.split(",")[0]
    ?.trim();

  if (
    forwardedHost &&
    (forwardedProto === "http" || forwardedProto === "https")
  ) {
    return `${forwardedProto}://${forwardedHost}`;
  }

  return request.nextUrl.origin;
}

export function hasTrustedOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return true;

  try {
    return new URL(origin).origin === getPublicOrigin(request);
  } catch {
    return false;
  }
}

export function stripeKeyExpectsLivemode(secretKey: string) {
  if (secretKey.startsWith("rk_live_") || secretKey.startsWith("sk_live_"))
    return true;
  if (secretKey.startsWith("rk_test_") || secretKey.startsWith("sk_test_"))
    return false;
  return null;
}

export function stripeMetadata({
  userId,
  userPublicId,
  planSlug,
  attemptId,
}: {
  userId: number;
  userPublicId: string;
  planSlug: string;
  attemptId: string;
}) {
  return {
    app: "leiprova",
    user_id: String(userId),
    user_public_id: userPublicId,
    plan_slug: planSlug,
    checkout_attempt_id: attemptId,
  } satisfies Stripe.MetadataParam;
}
