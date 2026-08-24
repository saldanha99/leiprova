"use server";

import { eq, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";

import {
  createUserSession,
  destroyCurrentSession,
  hashPassword,
  verifyPassword,
} from "@/lib/auth";
import { getDb, isDatabaseConfigured } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { isRegistrationEnabled } from "@/lib/launch";
import { PRIVACY_VERSION, TERMS_VERSION } from "@/lib/legal";
import { getPlan } from "@/lib/plans";
import { consumeRateLimits, getRequestIp } from "@/lib/rate-limit";
import { getCheckoutAvailability } from "@/lib/stripe";
import { safeRedirectPath } from "@/lib/utils";

export type AuthActionState = {
  error?: string;
  fieldErrors?: Partial<Record<"name" | "email" | "password" | "terms", string>>;
};

const emailSchema = z.string().trim().toLowerCase().email("Informe um e-mail válido.").max(254);
const passwordSchema = z
  .string()
  .min(10, "Use pelo menos 10 caracteres.")
  .max(128, "A senha deve ter no máximo 128 caracteres.")
  .regex(/[A-Za-zÀ-ÿ]/, "Inclua pelo menos uma letra.")
  .regex(/[0-9]/, "Inclua pelo menos um número.");

const registerSchema = z.object({
  name: z.string().trim().min(2, "Informe seu nome.").max(80, "Use no máximo 80 caracteres."),
  email: emailSchema,
  password: passwordSchema,
  terms: z.literal("on", { error: "Aceite os termos para continuar." }),
  next: z.string().optional(),
});

const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Informe sua senha.").max(128),
  next: z.string().optional(),
});

const purchaseIdentitySchema = z.object({
  name: z.string().trim().min(2, "Informe seu nome.").max(80, "Use no máximo 80 caracteres."),
  email: emailSchema,
  planSlug: z.string().trim().min(1).max(40),
  terms: z.literal("on", { error: "Aceite os termos para continuar." }),
});

function mapFieldErrors(error: z.ZodError) {
  const fields: NonNullable<AuthActionState["fieldErrors"]> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if ((key === "name" || key === "email" || key === "password" || key === "terms") && !fields[key]) {
      fields[key] = issue.message;
    }
  }
  return fields;
}

export async function registerAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  if (!isRegistrationEnabled()) {
    return { error: "Os cadastros públicos ainda não estão abertos. Use a demonstração sem informar dados pessoais." };
  }

  if (!isDatabaseConfigured()) {
    return { error: "O cadastro será liberado assim que o ambiente de dados estiver configurado." };
  }

  const parsed = registerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: mapFieldErrors(parsed.error) };

  const requestIp = getRequestIp(await headers());
  const rateLimited = await consumeRateLimits([
    { policy: "registerIp", subject: { kind: "ip", value: requestIp } },
    { policy: "registerEmail", subject: { kind: "email", value: parsed.data.email } },
  ]);
  if (rateLimited) {
    return { error: "Muitas tentativas de cadastro. Aguarde um pouco e tente novamente." };
  }

  const db = getDb();
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(sql`lower(${users.email}) = ${parsed.data.email}`)
    .limit(1);

  if (existing.length) {
    return { fieldErrors: { email: "Já existe uma conta com este e-mail." } };
  }

  try {
    const [created] = await db
      .insert(users)
      .values({
        publicId: randomUUID(),
        name: parsed.data.name,
        email: parsed.data.email,
        passwordHash: await hashPassword(parsed.data.password),
        termsAcceptedAt: new Date(),
        termsVersion: TERMS_VERSION,
        privacyVersion: PRIVACY_VERSION,
      })
      .returning({ id: users.id });

    await createUserSession(created.id);
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
    if (code === "23505") return { fieldErrors: { email: "Já existe uma conta com este e-mail." } };
    console.error("register_failed", { code });
    return { error: "Não foi possível criar sua conta agora. Tente novamente." };
  }

  redirect(safeRedirectPath(parsed.data.next));
}

export async function loginAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  if (!isDatabaseConfigured()) {
    return { error: "O acesso será liberado assim que o ambiente de dados estiver configurado." };
  }

  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: mapFieldErrors(parsed.error) };

  const requestIp = getRequestIp(await headers());
  const rateLimited = await consumeRateLimits([
    { policy: "loginIp", subject: { kind: "ip", value: requestIp } },
    { policy: "loginEmail", subject: { kind: "email", value: parsed.data.email } },
  ]);
  if (rateLimited) {
    return { error: "Muitas tentativas de acesso. Aguarde alguns minutos e tente novamente." };
  }

  const [user] = await getDb()
    .select({ id: users.id, passwordHash: users.passwordHash })
    .from(users)
    .where(sql`lower(${users.email}) = ${parsed.data.email}`)
    .limit(1);

  const valid = user
    ? await verifyPassword(user.passwordHash, parsed.data.password)
    : Boolean(await hashPassword(parsed.data.password));

  if (!user || !valid) {
    return { error: "E-mail ou senha incorretos." };
  }

  await getDb().update(users).set({ lastSeenAt: new Date() }).where(eq(users.id, user.id));
  await createUserSession(user.id);
  redirect(safeRedirectPath(parsed.data.next));
}

export async function beginPurchaseAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  if (!isRegistrationEnabled()) {
    return { error: "As compras ainda não estão abertas." };
  }

  const parsed = purchaseIdentitySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: mapFieldErrors(parsed.error) };

  const plan = getPlan(parsed.data.planSlug);
  if (!plan || !getCheckoutAvailability(plan).available) {
    return { error: "Este plano ainda não está disponível para compra." };
  }

  const requestIp = getRequestIp(await headers());
  const rateLimited = await consumeRateLimits([
    { policy: "registerIp", subject: { kind: "ip", value: requestIp } },
    { policy: "registerEmail", subject: { kind: "email", value: parsed.data.email } },
  ]);
  if (rateLimited) {
    return { error: "Muitas tentativas de compra. Aguarde um pouco e tente novamente." };
  }

  const db = getDb();
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(sql`lower(${users.email}) = ${parsed.data.email}`)
    .limit(1);
  if (existing) {
    return { fieldErrors: { email: "Já existe uma conta com este e-mail. Entre para continuar a compra." } };
  }

  try {
    const provisionalPassword = randomBytes(32).toString("base64url");
    const [created] = await db
      .insert(users)
      .values({
        publicId: randomUUID(),
        name: parsed.data.name,
        email: parsed.data.email,
        passwordHash: await hashPassword(provisionalPassword),
        termsAcceptedAt: new Date(),
        termsVersion: TERMS_VERSION,
        privacyVersion: PRIVACY_VERSION,
      })
      .returning({ id: users.id });

    await createUserSession(created.id);
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
    if (code === "23505") {
      return { fieldErrors: { email: "Já existe uma conta com este e-mail. Entre para continuar a compra." } };
    }
    console.error("purchase_identity_failed", { code });
    return { error: "Não foi possível preparar sua compra agora. Tente novamente." };
  }

  redirect(`/checkout/${plan.slug}`);
}

export async function logoutAction() {
  await destroyCurrentSession();
  redirect("/");
}
