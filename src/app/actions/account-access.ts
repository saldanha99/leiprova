"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import {
  accountAccessTokenSchema,
  accountPasswordSchema,
} from "@/lib/account-access-core";
import {
  consumeAccountAccessToken,
  requestPasswordResetEmail,
} from "@/lib/account-access";
import { createUserSession, hashPassword } from "@/lib/auth";
import { isDatabaseConfigured } from "@/lib/db/client";
import { consumeRateLimits, getRequestIp } from "@/lib/rate-limit";

export type AccountAccessActionState = {
  status?: "sent";
  error?: string;
  fieldErrors?: Partial<Record<"email" | "password" | "passwordConfirmation", string>>;
};

const emailSchema = z.string().trim().toLowerCase().email("Informe um e-mail válido.").max(254);

const activationSchema = z
  .object({
    token: accountAccessTokenSchema,
    password: accountPasswordSchema,
    passwordConfirmation: z.string().min(1, "Repita a nova senha.").max(128),
  })
  .refine((input) => input.password === input.passwordConfirmation, {
    path: ["passwordConfirmation"],
    message: "As senhas não coincidem.",
  });

function fieldErrors(error: z.ZodError): AccountAccessActionState["fieldErrors"] {
  const mapped: NonNullable<AccountAccessActionState["fieldErrors"]> = {};
  for (const issue of error.issues) {
    const field = issue.path[0];
    if (
      (field === "email" || field === "password" || field === "passwordConfirmation") &&
      !mapped[field]
    ) {
      mapped[field] = issue.message;
    }
  }
  return mapped;
}

export async function requestAccountAccessAction(
  _previousState: AccountAccessActionState,
  formData: FormData,
): Promise<AccountAccessActionState> {
  if (!isDatabaseConfigured()) {
    return { error: "O envio de acesso será liberado assim que o ambiente estiver configurado." };
  }

  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) return { fieldErrors: { email: parsed.error.issues[0]?.message } };

  const requestIp = getRequestIp(await headers());
  const rateLimited = await consumeRateLimits([
    { policy: "accessRequestIp", subject: { kind: "ip", value: requestIp } },
    { policy: "accessRequestEmail", subject: { kind: "email", value: parsed.data } },
  ]);
  if (rateLimited) {
    return { error: "Muitas solicitações em pouco tempo. Aguarde e tente novamente." };
  }

  try {
    const requested = await requestPasswordResetEmail(parsed.data);
    if (requested.status === "disabled") {
      return { error: "O envio automático de acesso ainda não está disponível." };
    }
  } catch {
    console.error("account_access_request_failed");
  }

  return { status: "sent" };
}

export async function activateAccountAccessAction(
  _previousState: AccountAccessActionState,
  formData: FormData,
): Promise<AccountAccessActionState> {
  if (!isDatabaseConfigured()) {
    return { error: "Não foi possível concluir seu acesso agora. Tente novamente em instantes." };
  }

  const parsed = activationSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

  const requestIp = getRequestIp(await headers());
  const rateLimited = await consumeRateLimits([
    { policy: "accessActivateIp", subject: { kind: "ip", value: requestIp } },
  ]);
  if (rateLimited) {
    return { error: "Muitas tentativas em pouco tempo. Aguarde e tente novamente." };
  }

  const claimed = await consumeAccountAccessToken({
    rawToken: parsed.data.token,
    passwordHash: await hashPassword(parsed.data.password),
  });
  if (!claimed) {
    return { error: "Este link já foi usado ou expirou. Solicite um novo acesso." };
  }

  await createUserSession(claimed.userId);
  redirect("/app?acesso=ativado");
}
