import { randomUUID } from "node:crypto";

import { and, eq, isNull, sql } from "drizzle-orm";
import { NextRequest } from "next/server";
import type Stripe from "stripe";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db/client";
import { auditLogs, stripeConnectPartners } from "@/lib/db/schema";
import { hasTrustedOrigin } from "@/lib/stripe";
import {
  createStripeConnectAccountLink,
  createStripeConnectedExpressAccount,
  getStripeConnectOnboardingReadiness,
  retrieveStripeConnectedAccount,
  StripeConnectInputError,
  StripeConnectUnavailableError,
} from "@/lib/stripe-connect";

export const runtime = "nodejs";

const createPartnerSchema = z.object({
  action: z.literal("create_partner"),
  requestId: z.uuid(),
  displayName: z.string().trim().min(2).max(120),
  legalName: z.string().trim().min(2).max(180),
  email: z.email().max(254).transform((value) => value.toLowerCase()),
});

const createLinkSchema = z.object({
  action: z.literal("create_link"),
  requestId: z.uuid(),
  partnerPublicId: z.uuid(),
});

const requestSchema = z.discriminatedUnion("action", [createPartnerSchema, createLinkSchema]);

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

function getAccountStatus(account: Stripe.Account) {
  const currentlyDue = account.requirements?.currently_due ?? [];
  const pastDue = account.requirements?.past_due ?? [];

  if (account.payouts_enabled && account.details_submitted) return "enabled";
  if (currentlyDue.length > 0 || pastDue.length > 0) return "restricted";
  return "onboarding";
}

async function syncPartnerFromStripe({
  partnerId,
  account,
  actorUserId,
}: {
  partnerId: number;
  account: Stripe.Account;
  actorUserId: number;
}) {
  const currentlyDue = account.requirements?.currently_due ?? [];
  const pastDue = account.requirements?.past_due ?? [];

  const [partner] = await getDb()
    .update(stripeConnectPartners)
    .set({
      stripeAccountId: account.id,
      status: getAccountStatus(account),
      detailsSubmitted: account.details_submitted,
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      requirementsCurrentlyDue: currentlyDue,
      requirementsPastDue: pastDue,
      updatedByUserId: actorUserId,
      updatedAt: new Date(),
    })
    .where(eq(stripeConnectPartners.id, partnerId))
    .returning({
      publicId: stripeConnectPartners.publicId,
      displayName: stripeConnectPartners.displayName,
      email: stripeConnectPartners.email,
      status: stripeConnectPartners.status,
      detailsSubmitted: stripeConnectPartners.detailsSubmitted,
      payoutsEnabled: stripeConnectPartners.payoutsEnabled,
    });

  return partner;
}

export async function POST(request: NextRequest) {
  if (!hasTrustedOrigin(request)) return jsonError("Origem da solicitação não autorizada.", 403);

  const user = await getCurrentUser();
  if (!user) return jsonError("Entre na sua conta para continuar.", 401);
  if (user.role !== "admin") return jsonError("Apenas o super admin pode cadastrar recebedores.", 403);

  const input = requestSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) return jsonError("Dados do recebedor inválidos.", 400);

  const onboardingReadiness = getStripeConnectOnboardingReadiness();
  if (!onboardingReadiness.ready) {
    return jsonError("O onboarding do Stripe Connect ainda não está configurado no servidor.", 503);
  }

  const db = getDb();

  try {
    if (input.data.action === "create_partner") {
      // Keep the INSERT target list aligned with the column-level database grant.
      // Drizzle's regular insert includes every defaulted column in the statement.
      await db.execute(sql`
        insert into stripe_connect_partners (
          public_id,
          display_name,
          legal_name,
          email,
          status,
          created_by_user_id,
          updated_by_user_id
        ) values (
          ${input.data.requestId},
          ${input.data.displayName},
          ${input.data.legalName},
          ${input.data.email},
          'draft',
          ${user.id},
          ${user.id}
        )
        on conflict (public_id) do nothing
      `);
    }

    const partnerPublicId =
      input.data.action === "create_partner" ? input.data.requestId : input.data.partnerPublicId;
    let [partner] = await db
      .select()
      .from(stripeConnectPartners)
      .where(eq(stripeConnectPartners.publicId, partnerPublicId))
      .limit(1);

    if (!partner) return jsonError("Recebedor não encontrado.", 404);

    if (
      input.data.action === "create_partner" &&
      (partner.displayName !== input.data.displayName ||
        partner.legalName !== input.data.legalName ||
        partner.email !== input.data.email)
    ) {
      return jsonError("Este identificador já foi usado em outro cadastro.", 409);
    }

    let connectedAccountId = partner.stripeAccountId;
    if (!connectedAccountId) {
      const createdAccount = await createStripeConnectedExpressAccount({
        partnerId: partner.publicId,
        createdByUserId: user.publicId,
        email: partner.email,
        // Version the key so a previously rejected capability set cannot poison
        // the corrected BR onboarding request in Stripe's idempotency store.
        idempotencyKey: `connect-account:v2:${partner.publicId}`,
      });

      const [claimed] = await db
        .update(stripeConnectPartners)
        .set({
          stripeAccountId: createdAccount.id,
          status: "onboarding",
          updatedByUserId: user.id,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(stripeConnectPartners.id, partner.id),
            isNull(stripeConnectPartners.stripeAccountId),
          ),
        )
        .returning({ stripeAccountId: stripeConnectPartners.stripeAccountId });

      if (!claimed?.stripeAccountId) {
        [partner] = await db
          .select()
          .from(stripeConnectPartners)
          .where(eq(stripeConnectPartners.id, partner.id))
          .limit(1);
      }
      connectedAccountId = claimed?.stripeAccountId ?? partner?.stripeAccountId ?? null;
    }

    if (!connectedAccountId) throw new Error("Conta conectada não persistida.");

    const stripeAccount = await retrieveStripeConnectedAccount(connectedAccountId);
    if ("deleted" in stripeAccount && stripeAccount.deleted) {
      return jsonError("A conta conectada foi removida na Stripe.", 409);
    }

    const syncedPartner = await syncPartnerFromStripe({
      partnerId: partner.id,
      account: stripeAccount,
      actorUserId: user.id,
    });
    const accountLink = await createStripeConnectAccountLink({
      connectedAccountId,
      idempotencyKey: `connect-link:${input.data.requestId}`,
    });

    await db.insert(auditLogs).values({
      actorUserId: user.id,
      action: "stripe_connect.onboarding_link_created",
      entityType: "stripe_connect_partner",
      entityId: partner.publicId,
      metadata: {
        stripeAccountId: connectedAccountId,
        mode: onboardingReadiness.mode,
        requestId: input.data.requestId,
      },
    });

    return Response.json(
      {
        partner: syncedPartner,
        onboarding: {
          url: accountLink.url,
          expiresAt: new Date(accountLink.expires_at * 1000).toISOString(),
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof StripeConnectUnavailableError) {
      return jsonError("O onboarding do Stripe Connect está indisponível.", 503);
    }
    if (error instanceof StripeConnectInputError) return jsonError(error.message, 400);

    const incidentId = randomUUID();
    const errorName = error instanceof Error ? error.name : "UnknownError";
    const errorCode =
      error && typeof error === "object" && "code" in error && typeof error.code === "string"
        ? error.code
        : null;
    const errorMessage = error instanceof Error ? error.message : null;
    const causeCode =
      error &&
      typeof error === "object" &&
      "cause" in error &&
      error.cause &&
      typeof error.cause === "object" &&
      "code" in error.cause &&
      typeof error.cause.code === "string"
        ? error.cause.code
        : null;
    console.error("Stripe Connect onboarding failed", {
      incidentId,
      errorName,
      errorCode,
      causeCode,
      errorMessage,
    });
    return jsonError(`Não foi possível gerar o formulário agora. Código: ${incidentId}`, 502);
  }
}
