import "server-only";

import { and, eq, gt, isNull, sql } from "drizzle-orm";

import {
  ACCOUNT_ACCESS_TOKEN_TTL_MS,
  accountAccessTokenSchema,
  digestAccountAccessToken,
  generateAccountAccessToken,
} from "@/lib/account-access-core";
import { buildAccountAccessEmail } from "@/lib/account-access-email";
import { getDb, isDatabaseConfigured } from "@/lib/db/client";
import {
  accountAccessTokens,
  auditLogs,
  authSessions,
  users,
} from "@/lib/db/schema";
import {
  getTransactionalEmailConfig,
  sendTransactionalEmail,
  TransactionalEmailError,
} from "@/lib/transactional-email";

type AccessPurpose = "purchase_access" | "password_reset";

function getPublicAppOrigin() {
  const configured = process.env.APP_URL?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!configured) {
    if (process.env.NODE_ENV === "production") throw new Error("APP_URL ausente.");
    return "http://localhost:3000";
  }

  const url = new URL(configured);
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:") {
    throw new Error("APP_URL precisa usar HTTPS.");
  }
  return url.origin;
}

function errorCode(error: unknown) {
  if (error instanceof TransactionalEmailError) return error.code;
  return "unexpected_delivery_error";
}

async function deliverToken({
  tokenId,
  rawToken,
  userId,
  purpose,
  checkoutAttemptId,
}: {
  tokenId: string;
  rawToken: string;
  userId: number;
  purpose: AccessPurpose;
  checkoutAttemptId: string | null;
}) {
  const db = getDb();
  const [user] = await db
    .select({ publicId: users.publicId, email: users.email, name: users.name })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) return { status: "failed" as const, code: "user_not_found" };

  try {
    const accessUrl = `${getPublicAppOrigin()}/ativar-acesso?token=${encodeURIComponent(rawToken)}`;
    const email = buildAccountAccessEmail({
      name: user.name,
      accessUrl,
      purchase: purpose === "purchase_access",
    });
    const delivered = await sendTransactionalEmail({
      to: user.email,
      subject: email.subject,
      html: email.html,
      text: email.text,
    });
    const now = new Date();

    await db.transaction(async (transaction) => {
      await transaction
        .update(accountAccessTokens)
        .set({
          deliveryStatus: "sent",
          providerMessageId: delivered.messageId,
          lastError: null,
          sentAt: now,
          updatedAt: now,
        })
        .where(eq(accountAccessTokens.id, tokenId));
      await transaction.insert(auditLogs).values({
        action: "account_access.email_sent",
        entityType: "user",
        entityId: user.publicId,
        metadata: {
          purpose,
          checkoutAttemptId,
          provider: "cloudflare_email_service",
          providerStatus: delivered.status,
        },
      });
    });

    return { status: "sent" as const };
  } catch (error) {
    const code = errorCode(error);
    const now = new Date();
    await db.transaction(async (transaction) => {
      await transaction
        .update(accountAccessTokens)
        .set({ deliveryStatus: "failed", lastError: code, updatedAt: now })
        .where(eq(accountAccessTokens.id, tokenId));
      await transaction.insert(auditLogs).values({
        action: "account_access.email_failed",
        entityType: "user",
        entityId: user.publicId,
        metadata: { purpose, checkoutAttemptId, provider: "cloudflare_email_service", code },
      });
    });
    console.error("account_access_email_failed", { userId, purpose, code });
    return { status: "failed" as const, code };
  }
}

export async function sendPurchaseAccessEmail({
  userId,
  checkoutAttemptId,
}: {
  userId: number;
  checkoutAttemptId: string;
}) {
  const { token, digest } = generateAccountAccessToken();
  const now = new Date();
  const [inserted] = await getDb()
    .insert(accountAccessTokens)
    .values({
      id: digest,
      userId,
      checkoutAttemptId,
      purpose: "purchase_access",
      expiresAt: new Date(now.getTime() + ACCOUNT_ACCESS_TOKEN_TTL_MS),
      updatedAt: now,
    })
    .onConflictDoNothing()
    .returning({ id: accountAccessTokens.id });

  if (!inserted) return { status: "already_issued" as const };
  return deliverToken({
    tokenId: digest,
    rawToken: token,
    userId,
    purpose: "purchase_access",
    checkoutAttemptId,
  });
}

export async function requestPasswordResetEmail(email: string) {
  if (!getTransactionalEmailConfig()) return { status: "disabled" as const };

  const db = getDb();
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(sql`lower(${users.email}) = ${email}`)
    .limit(1);

  if (!user) return { status: "accepted" as const };

  const now = new Date();
  const { token, digest } = generateAccountAccessToken();

  await db.transaction(async (transaction) => {
    await transaction
      .update(accountAccessTokens)
      .set({ usedAt: now, updatedAt: now })
      .where(
        and(
          eq(accountAccessTokens.userId, user.id),
          eq(accountAccessTokens.purpose, "password_reset"),
          isNull(accountAccessTokens.usedAt),
        ),
      );

    await transaction.insert(accountAccessTokens).values({
      id: digest,
      userId: user.id,
      purpose: "password_reset",
      expiresAt: new Date(now.getTime() + ACCOUNT_ACCESS_TOKEN_TTL_MS),
      updatedAt: now,
    });
  });

  await deliverToken({
    tokenId: digest,
    rawToken: token,
    userId: user.id,
    purpose: "password_reset",
    checkoutAttemptId: null,
  });
  return { status: "accepted" as const };
}

export async function getAccountAccessTokenStatus(rawToken: string) {
  if (!isDatabaseConfigured() || !accountAccessTokenSchema.safeParse(rawToken).success) {
    return "invalid" as const;
  }

  const [stored] = await getDb()
    .select({ expiresAt: accountAccessTokens.expiresAt, usedAt: accountAccessTokens.usedAt })
    .from(accountAccessTokens)
    .where(eq(accountAccessTokens.id, digestAccountAccessToken(rawToken)))
    .limit(1);

  if (!stored) return "invalid" as const;
  if (stored.usedAt) return "used" as const;
  if (stored.expiresAt.getTime() <= Date.now()) return "expired" as const;
  return "valid" as const;
}

export async function consumeAccountAccessToken({
  rawToken,
  passwordHash,
}: {
  rawToken: string;
  passwordHash: string;
}) {
  if (!accountAccessTokenSchema.safeParse(rawToken).success) return null;

  const now = new Date();
  return getDb().transaction(async (transaction) => {
    const [claimed] = await transaction
      .update(accountAccessTokens)
      .set({ usedAt: now, updatedAt: now })
      .where(
        and(
          eq(accountAccessTokens.id, digestAccountAccessToken(rawToken)),
          isNull(accountAccessTokens.usedAt),
          gt(accountAccessTokens.expiresAt, now),
        ),
      )
      .returning({ userId: accountAccessTokens.userId, purpose: accountAccessTokens.purpose });

    if (!claimed) return null;

    const [updatedUser] = await transaction
      .update(users)
      .set({
        passwordHash,
        emailVerifiedAt: sql`coalesce(${users.emailVerifiedAt}, ${now})`,
        updatedAt: now,
      })
      .where(eq(users.id, claimed.userId))
      .returning({ id: users.id, publicId: users.publicId });

    if (!updatedUser) throw new Error("Conta do convite não encontrada.");

    await transaction.delete(authSessions).where(eq(authSessions.userId, claimed.userId));
    await transaction.insert(auditLogs).values({
      actorUserId: claimed.userId,
      action: "account_access.password_created",
      entityType: "user",
      entityId: updatedUser.publicId,
      metadata: { purpose: claimed.purpose },
    });

    return { userId: claimed.userId };
  });
}
