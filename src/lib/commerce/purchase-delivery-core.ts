import { createHash } from "node:crypto";
import { z } from "zod";

export const DELIVERY_MAX_ATTEMPTS = 6;
export const DELIVERY_LEASE_MS = 120_000;
// O provedor deduplica por 24h. Depois de 23h, uma tentativa incerta exige conciliação humana.
export const DELIVERY_SAFE_RETRY_WINDOW_MS = 23 * 60 * 60_000;

export const purchaseDeliveryInputSchema = z.object({
  userId: z.number().int().positive().safe(),
  scope: z.enum(["master", "contest"]),
  purchaseId: z.string().min(1).max(240).regex(/^[A-Za-z0-9_-]+$/),
  productSlug: z.string().min(1).max(240).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
}).strict();
export type PurchaseDeliveryInput = z.infer<typeof purchaseDeliveryInputSchema>;

export const deliverySnapshotSchema = z.object({
  version: z.literal(1),
  to: z.email().max(320),
  name: z.string().max(200),
  productLabel: z.string().min(1).max(500),
  scope: z.enum(["master", "contest"]),
  origin: z.url().max(300),
  from: z.string().min(1).max(500),
}).strict();
export type DeliverySnapshot = z.infer<typeof deliverySnapshotSchema>;
export type DeliveryFinalState = "retry" | "queued" | "manual_review" | "cancelled";

export function purchaseDeliveryId(input: PurchaseDeliveryInput) {
  const value = purchaseDeliveryInputSchema.parse(input);
  // Não inclui evento Stripe: reentregas de eventos distintos da mesma compra não duplicam mensagens.
  return createHash("sha256").update(JSON.stringify(["purchase-delivery/v1", value.scope, value.purchaseId, value.productSlug])).digest("hex");
}

export function deliveryRetryAt(attempt: number, now: Date) {
  return new Date(now.getTime() + Math.min(60, 2 ** Math.max(0, attempt - 1)) * 60_000);
}

export function deliveryFailureState(attempts: number, firstDispatchAt: Date | null, now: Date, permanent = false): "retry" | "manual_review" {
  return permanent || attempts >= DELIVERY_MAX_ATTEMPTS ||
    (firstDispatchAt !== null && now.getTime() - firstDispatchAt.getTime() >= DELIVERY_SAFE_RETRY_WINDOW_MS)
    ? "manual_review" : "retry";
}

export function validateDeliveryOrigin(value: string) {
  const url = new URL(value);
  if (url.username || url.password || url.search || url.hash || url.pathname !== "/" ||
      (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))))
    throw new Error("delivery_origin_invalid");
  return url.origin;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
}

/** Versão imutável do recibo: nenhuma senha, token de ativação ou direito é criado por este e-mail. */
export function buildPurchaseConfirmationV1(input: DeliverySnapshot) {
  const snapshot = deliverySnapshotSchema.parse(input);
  const origin = validateDeliveryOrigin(snapshot.origin);
  const loginUrl = `${origin}/entrar`;
  const recoveryUrl = `${origin}/recuperar-acesso`;
  const portalUrl = `${origin}/app/${snapshot.scope === "master" ? "assinatura" : "compras"}`;
  const scopeText = snapshot.scope === "master"
    ? "Seu Master permite acessar os concursos liberados na plataforma durante a vigência paga."
    : "Esta compra libera somente o concurso indicado, durante a vigência paga. Outros concursos não estão incluídos.";
  const subject = `Compra confirmada na Editalume: ${snapshot.productLabel}`;
  const greeting = `Olá, ${snapshot.name.trim().split(/\s+/)[0] || "estudante"}!`;
  const text = [greeting, "", `Confirmamos o pagamento de ${snapshot.productLabel}.`, scopeText, "",
    `Entre com o mesmo e-mail usado na compra: ${loginUrl}`, `Confira seu acesso: ${portalUrl}`, "",
    "Sua senha atual continua igual. Se comprou sem criar senha ou esqueceu sua senha, solicite um link pessoal de definição de senha:",
    recoveryUrl, "Esse link é enviado para o seu e-mail pelo fluxo seguro de recuperação.",
    "Nunca compartilhe sua senha ou links pessoais de acesso."].join("\n");
  const html = `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#050b12;color:#e8eef7;font-family:Arial,sans-serif"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:32px 16px"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#0a1420;border:1px solid #1c2b3d;border-radius:22px"><tr><td style="padding:28px 32px"><img src="${origin}/brand/editalume-icon-180.png" width="48" height="48" alt="Editalume" style="border:0;border-radius:12px"><p style="color:#fbbf24;font-weight:bold">Editalume · Lei seca guiada pelo edital</p><h1 style="font-size:26px">${escapeHtml(greeting)}</h1><p>Confirmamos o pagamento de <strong>${escapeHtml(snapshot.productLabel)}</strong>.</p><p>${scopeText}</p><p><a href="${loginUrl}" style="display:inline-block;padding:14px 22px;border-radius:12px;background:#fbbf24;color:#07111d;font-weight:bold;text-decoration:none">Entrar na plataforma</a></p><p><a href="${portalUrl}" style="color:#fbbf24">Consultar meu acesso</a></p><p style="color:#a9b6c8;line-height:1.6">Sua senha atual continua igual. Se comprou sem criar senha ou esqueceu sua senha, <a href="${recoveryUrl}" style="color:#fbbf24">solicite um link pessoal de definição de senha</a>. Ele será enviado ao seu e-mail pelo fluxo seguro de recuperação.</p><p style="color:#7f8ea3;font-size:12px">Nunca compartilhe sua senha ou links pessoais de acesso.</p></td></tr></table></td></tr></table></body></html>`;
  return { to: snapshot.to, from: snapshot.from, subject, html, text };
}

export function deliveryPayloadDigest(snapshot: DeliverySnapshot) {
  return createHash("sha256").update(JSON.stringify(buildPurchaseConfirmationV1(snapshot))).digest("hex");
}
