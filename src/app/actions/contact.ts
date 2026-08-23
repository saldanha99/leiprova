"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createHmac } from "node:crypto";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { getDb, isDatabaseConfigured } from "@/lib/db/client";
import { contactMessages } from "@/lib/db/schema";
import { isContactEnabled } from "@/lib/launch";
import { consumeRateLimits, getRequestIp } from "@/lib/rate-limit";

export type ContactState = { error?: string; fieldErrors?: Record<string, string> };

const schema = z.object({
  name: z.string().trim().min(2, "Informe seu nome.").max(80),
  email: z.string().trim().toLowerCase().email("Informe um e-mail válido.").max(254),
  subject: z.string().trim().min(3, "Resuma o assunto.").max(120),
  message: z.string().trim().min(20, "Conte um pouco mais para podermos ajudar.").max(4_000),
  company: z.string().max(0).optional(),
});

export async function sendContactAction(_state: ContactState, formData: FormData): Promise<ContactState> {
  if (!isContactEnabled()) return { error: "O canal público de contato ainda não está aberto." };
  if (!isDatabaseConfigured()) return { error: "O canal será liberado após a configuração do ambiente de dados." };
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      fieldErrors[key] ??= issue.message;
    }
    return { fieldErrors };
  }

  const requestHeaders = await headers();
  const ip = getRequestIp(requestHeaders);
  const secret = process.env.IP_HASH_SECRET;
  const user = await getCurrentUser();
  const rateLimited = await consumeRateLimits([
    { policy: "contactIp", subject: { kind: "ip", value: ip } },
    { policy: "contactEmail", subject: { kind: "email", value: parsed.data.email } },
  ]);
  if (rateLimited) {
    return { error: "Muitas mensagens em pouco tempo. Aguarde antes de enviar novamente." };
  }

  await getDb().insert(contactMessages).values({
    userId: user?.id ?? null,
    name: parsed.data.name,
    email: parsed.data.email,
    subject: parsed.data.subject,
    message: parsed.data.message,
    ipHash: ip !== "unknown" && secret ? createHmac("sha256", secret).update(ip).digest("hex") : null,
  });

  redirect("/contato?enviado=1");
}
