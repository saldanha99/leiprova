import "server-only";

import { lt, sql } from "drizzle-orm";

import { getDb } from "@/lib/db/client";
import { rateLimitCounters } from "@/lib/db/schema";
import {
  fixedRateLimitWindow,
  hashRateLimitSubject,
  retryAfterSeconds,
  type RateLimitSubject,
} from "@/lib/rate-limit-core";

export const RATE_LIMIT_POLICIES = {
  loginIp: { scope: "auth_login_ip", limit: 30, windowSeconds: 15 * 60 },
  loginEmail: { scope: "auth_login_email", limit: 10, windowSeconds: 15 * 60 },
  registerIp: { scope: "auth_register_ip", limit: 5, windowSeconds: 60 * 60 },
  registerEmail: { scope: "auth_register_email", limit: 3, windowSeconds: 24 * 60 * 60 },
  contactIp: { scope: "contact_ip", limit: 5, windowSeconds: 60 * 60 },
  contactEmail: { scope: "contact_email", limit: 3, windowSeconds: 60 * 60 },
  quizSessionUserMinute: { scope: "quiz_session_user_minute", limit: 15, windowSeconds: 60 },
  quizSessionIpMinute: { scope: "quiz_session_ip_minute", limit: 30, windowSeconds: 60 },
  studyAttemptUserMinute: { scope: "study_attempt_user_minute", limit: 60, windowSeconds: 60 },
  studyAttemptUserDay: { scope: "study_attempt_user_day", limit: 1_000, windowSeconds: 24 * 60 * 60 },
  studyAttemptIpMinute: { scope: "study_attempt_ip_minute", limit: 120, windowSeconds: 60 },
} as const;

export type RateLimitPolicyName = keyof typeof RATE_LIMIT_POLICIES;

export type RateLimitRequest = {
  policy: RateLimitPolicyName;
  subject: RateLimitSubject;
};

export type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: Date;
  retryAfterSeconds: number;
};

type HeaderReader = Pick<Headers, "get">;

let cleanupAfter = 0;

export function getRequestIp(requestHeaders: HeaderReader) {
  const forwardedFor = requestHeaders
    .get("x-forwarded-for")
    ?.split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return (
    forwardedFor?.[forwardedFor.length - 1] ||
    requestHeaders.get("x-real-ip")?.trim() ||
    "unknown"
  );
}

export async function consumeRateLimit(
  request: RateLimitRequest,
  options: { now?: Date } = {},
): Promise<RateLimitResult> {
  const policy = RATE_LIMIT_POLICIES[request.policy];
  const now = options.now ?? new Date();
  const secret = process.env.IP_HASH_SECRET?.trim() ?? "";
  const subjectHash = hashRateLimitSubject(request.subject, secret);
  const { startedAt, resetAt } = fixedRateLimitWindow(now, policy.windowSeconds);
  const db = getDb();

  const [counter] = await db
    .insert(rateLimitCounters)
    .values({
      scope: policy.scope,
      subjectHash,
      windowStartedAt: startedAt,
      requestCount: 1,
      expiresAt: resetAt,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [
        rateLimitCounters.scope,
        rateLimitCounters.subjectHash,
        rateLimitCounters.windowStartedAt,
      ],
      set: {
        requestCount: sql`${rateLimitCounters.requestCount} + 1`,
        expiresAt: resetAt,
        updatedAt: now,
      },
      setWhere: lt(rateLimitCounters.requestCount, policy.limit),
    })
    .returning({ requestCount: rateLimitCounters.requestCount });

  await maybeCleanupExpiredCounters(now);

  const retryAfter = retryAfterSeconds(resetAt, now);
  if (!counter) {
    return {
      allowed: false,
      limit: policy.limit,
      remaining: 0,
      resetAt,
      retryAfterSeconds: retryAfter,
    };
  }

  return {
    allowed: true,
    limit: policy.limit,
    remaining: Math.max(0, policy.limit - counter.requestCount),
    resetAt,
    retryAfterSeconds: retryAfter,
  };
}

export async function consumeRateLimits(requests: RateLimitRequest[]) {
  for (const request of requests) {
    const result = await consumeRateLimit(request);
    if (!result.allowed) return result;
  }

  return null;
}

export function rateLimitJsonResponse(
  result: RateLimitResult,
  message = "Muitas tentativas em pouco tempo. Aguarde e tente novamente.",
) {
  return Response.json(
    {
      error: "rate_limited",
      message,
      retryAfterSeconds: result.retryAfterSeconds,
    },
    {
      status: 429,
      headers: {
        "Cache-Control": "no-store",
        "Retry-After": String(result.retryAfterSeconds),
      },
    },
  );
}

async function maybeCleanupExpiredCounters(now: Date) {
  if (now.getTime() < cleanupAfter) return;
  cleanupAfter = now.getTime() + 10 * 60 * 1_000;

  try {
    await getDb().delete(rateLimitCounters).where(lt(rateLimitCounters.expiresAt, now));
  } catch {
    // Limitar requisições é prioritário; uma falha de limpeza pode ser tentada novamente.
    cleanupAfter = now.getTime() + 60 * 1_000;
  }
}
