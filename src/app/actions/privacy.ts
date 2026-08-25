"use server";

import { createHmac, randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { getDb, isDatabaseConfigured } from "@/lib/db/client";
import { contactMessages } from "@/lib/db/schema";
import { isPrivacyRequestsEnabled } from "@/lib/launch";
import { sendPrivacyRequestConfirmation } from "@/lib/privacy-email";
import {
  formatPrivacyRequestProtocol,
  privacyRequestLabel,
  PRIVACY_REQUEST_TYPES,
  type PrivacyRequestType,
} from "@/lib/privacy-request-core";
import { consumeRateLimits, getRequestIp } from "@/lib/rate-limit";

type PrivacyField = "name" | "email" | "requestType" | "details";

export type PrivacyRequestState = {
  status?: "recorded";
  protocol?: string;
  emailStatus?: "sent" | "unavailable";
  error?: string;
  fieldErrors?: Partial<Record<PrivacyField, string>>;
};

const requestTypes = PRIVACY_REQUEST_TYPES.map(({ value }) => value) as [
  PrivacyRequestType,
  ...PrivacyRequestType[],
];

const privacyRequestSchema = z.object({
  name: z.string().trim().min(2, "Informe seu nome.").max(80),
  email: z.string().trim().toLowerCase().email("Informe um e-mail válido.").max(254),
  requestType: z.enum(requestTypes, { message: "Selecione o direito que deseja exercer." }),
  details: z
    .string()
    .trim()
    .min(10, "Descreva sua solicitação com um pouco mais de detalhe.")
    .max(2_000, "Use no máximo 2.000 caracteres."),
  company: z.string().max(0).optional(),
});

function mapFieldErrors(error: z.ZodError): PrivacyRequestState["fieldErrors"] {
  const mapped: NonNullable<PrivacyRequestState["fieldErrors"]> = {};
  for (const issue of error.issues) {
    const field = issue.path[0];
    if (
      (field === "name" ||
        field === "email" ||
        field === "requestType" ||
        field === "details") &&
      !mapped[field]
    ) {
      mapped[field] = issue.message;
    }
  }
  return mapped;
}

function firstName(name: string) {
  return name.split(/\s+/)[0] || "titular";
}

export async function submitPrivacyRequestAction(
  _previousState: PrivacyRequestState,
  formData: FormData,
): Promise<PrivacyRequestState> {
  if (!isPrivacyRequestsEnabled()) {
    return { error: "O canal digital de privacidade ainda não está disponível." };
  }
  if (!isDatabaseConfigured()) {
    return { error: "Não foi possível registrar a solicitação agora. Tente novamente em instantes." };
  }

  const parsed = privacyRequestSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    requestType: formData.get("requestType"),
    details: formData.get("details"),
    company: formData.get("company") || undefined,
  });
  if (!parsed.success) return { fieldErrors: mapFieldErrors(parsed.error) };

  const requestIp = getRequestIp(await headers());
  const rateLimited = await consumeRateLimits([
    { policy: "privacyRequestIp", subject: { kind: "ip", value: requestIp } },
    { policy: "privacyRequestEmail", subject: { kind: "email", value: parsed.data.email } },
  ]);
  if (rateLimited) {
    return { error: "Muitas solicitações em pouco tempo. Aguarde antes de enviar novamente." };
  }

  const protocol = formatPrivacyRequestProtocol(new Date(), randomBytes(4).toString("hex"));
  const requestLabel = privacyRequestLabel(parsed.data.requestType);
  const user = await getCurrentUser();
  const secret = process.env.IP_HASH_SECRET;

  await getDb().insert(contactMessages).values({
    userId: user?.id ?? null,
    name: parsed.data.name,
    email: parsed.data.email,
    subject: `[LGPD ${protocol}] ${requestLabel}`,
    message: [`Tipo da solicitação: ${requestLabel}`, "", parsed.data.details].join("\n"),
    ipHash:
      requestIp !== "unknown" && secret
        ? createHmac("sha256", secret).update(requestIp).digest("hex")
        : null,
  });

  let emailStatus: PrivacyRequestState["emailStatus"] = "sent";
  try {
    await sendPrivacyRequestConfirmation({
      email: parsed.data.email,
      firstName: firstName(parsed.data.name),
      protocol,
      requestType: requestLabel,
    });
  } catch {
    emailStatus = "unavailable";
    console.error("privacy_confirmation_email_failed");
  }

  return { status: "recorded", protocol, emailStatus };
}
