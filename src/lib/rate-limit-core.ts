import { createHmac } from "node:crypto";

export type RateLimitSubject = {
  kind: "ip" | "email" | "user";
  value: string;
};

export function normalizeRateLimitSubject(subject: RateLimitSubject) {
  const value = subject.value.trim().toLowerCase() || "unknown";
  return `${subject.kind}\0${value}`;
}

export function hashRateLimitSubject(subject: RateLimitSubject, secret: string) {
  if (secret.length < 32) {
    throw new Error("IP_HASH_SECRET precisa ter pelo menos 32 caracteres.");
  }

  return createHmac("sha256", secret)
    .update("leiprova-rate-limit-v1\0")
    .update(normalizeRateLimitSubject(subject))
    .digest("hex");
}

export function fixedRateLimitWindow(now: Date, windowSeconds: number) {
  if (!Number.isSafeInteger(windowSeconds) || windowSeconds < 1) {
    throw new Error("A janela do rate limit precisa ser um inteiro positivo.");
  }

  const windowMs = windowSeconds * 1_000;
  const startedAtMs = Math.floor(now.getTime() / windowMs) * windowMs;

  return {
    startedAt: new Date(startedAtMs),
    resetAt: new Date(startedAtMs + windowMs),
  };
}

export function retryAfterSeconds(resetAt: Date, now: Date) {
  return Math.max(1, Math.ceil((resetAt.getTime() - now.getTime()) / 1_000));
}

