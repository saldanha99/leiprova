import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";

export const ACCOUNT_ACCESS_TOKEN_TTL_MS = 24 * 60 * 60 * 1_000;

export const accountAccessTokenSchema = z
  .string()
  .trim()
  .min(40)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/);

export const accountPasswordSchema = z
  .string()
  .min(10, "Use pelo menos 10 caracteres.")
  .max(128, "A senha deve ter no máximo 128 caracteres.")
  .regex(/[A-Za-zÀ-ÿ]/, "Inclua pelo menos uma letra.")
  .regex(/[0-9]/, "Inclua pelo menos um número.");

export function digestAccountAccessToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function generateAccountAccessToken() {
  const token = randomBytes(32).toString("base64url");
  return { token, digest: digestAccountAccessToken(token) };
}
