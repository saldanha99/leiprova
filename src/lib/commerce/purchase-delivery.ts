import "server-only";
import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { getTransactionalEmailConfig, sendTransactionalEmail, TransactionalEmailError } from "@/lib/transactional-email";
import { getCatalogContest, contestTitle } from "./catalog";
import { getPlan } from "@/lib/plans";
import type { CommerceTransaction } from "./webhook-transaction";
import {
  buildPurchaseConfirmationV1, DELIVERY_LEASE_MS, DELIVERY_MAX_ATTEMPTS, DELIVERY_SAFE_RETRY_WINDOW_MS,
  deliveryFailureState, deliveryPayloadDigest, deliveryRetryAt, deliverySnapshotSchema,
  purchaseDeliveryId, purchaseDeliveryInputSchema, validateDeliveryOrigin,
  type DeliveryFinalState, type DeliverySnapshot, type PurchaseDeliveryInput,
} from "./purchase-delivery-core";

type DeliveryDatabase = Pick<ReturnType<typeof getDb>, "execute">;
export type ClaimedPurchaseDelivery = PurchaseDeliveryInput & {
  id: string; attempts: number; leaseToken: string; payload: DeliverySnapshot | null;
  payloadDigest: string | null; firstDispatchAt: Date | string | null;
};
type RecipientContext = { email: string; name: string; eligible: boolean };
type DeliveryConfig = { from: string; origin: string };
type ProviderMessage = Parameters<typeof sendTransactionalEmail>[0];
export type PurchaseDeliveryDependencies = {
  db: DeliveryDatabase;
  config: () => DeliveryConfig | null;
  send: (message: ProviderMessage) => ReturnType<typeof sendTransactionalEmail>;
  now?: () => Date;
};

function entitlementExists(input: PurchaseDeliveryInput, now?: Date) {
  return input.scope === "contest" ? sql`exists (
    select 1 from contest_orders o join contest_purchases p on p.order_id = o.id
    where o.id = ${input.purchaseId} and o.user_id = ${input.userId} and o.status = 'paid'
      and p.user_id = ${input.userId} and p.product_slug = ${input.productSlug}
      and p.status = 'active'
      and ${now ? sql`p.access_starts_at <= ${now.toISOString()}::timestamptz and p.access_ends_at > ${now.toISOString()}::timestamptz` : sql`true`}
  )` : sql`exists (
    select 1 from checkout_attempts a join plans p on p.id = a.plan_id
    join subscriptions s on s.provider_checkout_session_id = a.provider_session_id
      and s.user_id = a.user_id and s.plan_id = a.plan_id and s.provider = 'stripe'
    where a.id = ${input.purchaseId} and a.user_id = ${input.userId} and a.status = 'completed'
      and p.slug = ${input.productSlug} and s.status = 'active'
      and ${now ? sql`s.current_period_start <= ${now.toISOString()}::timestamptz and s.access_ends_at > ${now.toISOString()}::timestamptz` : sql`true`}
  )`;
}

/** Chamar na MESMA transação que confirma pagamento e acesso. Não abre conexão nem envia mensagem. */
export async function enqueuePurchaseDelivery(tx: CommerceTransaction, input: PurchaseDeliveryInput) {
  const value = purchaseDeliveryInputSchema.parse(input);
  const id = purchaseDeliveryId(value);
  const [previous] = await tx.execute<{ matches: boolean }>(sql`
    select (user_id = ${value.userId} and scope = ${value.scope} and purchase_id = ${value.purchaseId}
      and product_slug = ${value.productSlug}) as matches from purchase_delivery_outbox where id = ${id}
  `);
  if (previous) {
    if (!previous.matches) throw new Error("purchase_delivery_identity_conflict");
    return { id, created: false };
  }
  // Eventos pagos históricos não falham por relógio: só o worker decide se ainda cabe comunicar acesso vigente.
  const [eligibility] = await tx.execute<{ eligible: boolean }>(sql`select ${entitlementExists(value)} as eligible`);
  if (!eligibility?.eligible) throw new Error("purchase_delivery_entitlement_mismatch");
  const inserted = await tx.execute<{ id: string }>(sql`
    with inserted as (
      insert into purchase_delivery_outbox (id,user_id,scope,purchase_id,product_slug)
      values (${id},${value.userId},${value.scope},${value.purchaseId},${value.productSlug})
      on conflict do nothing returning id
    ), audited as (
      insert into purchase_delivery_events (id,delivery_id,event,attempt)
      select ${randomUUID()},id,'enqueued',0 from inserted
    ) select id from inserted
  `);
  if (!inserted.length) {
    const [existing] = await tx.execute<{ matches: boolean }>(sql`
      select (user_id = ${value.userId} and scope = ${value.scope} and purchase_id = ${value.purchaseId}
        and product_slug = ${value.productSlug}) as matches from purchase_delivery_outbox where id = ${id}
    `);
    if (!existing?.matches) throw new Error("purchase_delivery_identity_conflict");
  }
  return { id, created: inserted.length === 1 };
}

/** Reserva e histórico atômicos; não mantém locks enquanto chama o provedor. */
export async function claimPurchaseDelivery(db: DeliveryDatabase, now = new Date()): Promise<ClaimedPurchaseDelivery | null> {
  await db.execute(sql`
    with exhausted as (
      update purchase_delivery_outbox set status = 'manual_review', lease_token = null, lease_expires_at = null,
        last_error_code = 'delivery_retry_window_or_attempts_exhausted', updated_at = ${now.toISOString()}::timestamptz
      where id in (
        select id from purchase_delivery_outbox
        where (status in ('pending','retry') or (status = 'processing' and lease_expires_at <= ${now.toISOString()}::timestamptz))
          and (attempts >= ${DELIVERY_MAX_ATTEMPTS} or first_dispatch_at <= ${new Date(now.getTime() - DELIVERY_SAFE_RETRY_WINDOW_MS).toISOString()}::timestamptz)
        order by created_at for update skip locked limit 100
      ) returning id,attempts
    ) insert into purchase_delivery_events (id,delivery_id,event,attempt,code)
      select ${randomUUID()} || ':' || id,id,'manual_review',attempts,'delivery_retry_window_or_attempts_exhausted' from exhausted
  `);
  const rows = await db.execute<ClaimedPurchaseDelivery>(sql`
    with claimed as (
      update purchase_delivery_outbox j set status = 'processing', attempts = j.attempts + 1,
        lease_token = ${randomUUID()}, lease_expires_at = ${new Date(now.getTime() + DELIVERY_LEASE_MS).toISOString()}::timestamptz,
        updated_at = ${now.toISOString()}::timestamptz
      where j.id = (
        select id from purchase_delivery_outbox where attempts < ${DELIVERY_MAX_ATTEMPTS}
          and (first_dispatch_at is null or first_dispatch_at > ${new Date(now.getTime() - DELIVERY_SAFE_RETRY_WINDOW_MS).toISOString()}::timestamptz)
          and ((status in ('pending','retry') and next_attempt_at <= ${now.toISOString()}::timestamptz)
            or (status = 'processing' and lease_expires_at <= ${now.toISOString()}::timestamptz))
        order by next_attempt_at,created_at,id for update skip locked limit 1
      ) returning *
    ), audited as (
      insert into purchase_delivery_events (id,delivery_id,event,attempt)
      select ${randomUUID()},id,'claimed',attempts from claimed
    ) select id,user_id::double precision as "userId",scope,purchase_id as "purchaseId",product_slug as "productSlug",attempts,
      lease_token as "leaseToken",payload,payload_digest as "payloadDigest",first_dispatch_at as "firstDispatchAt" from claimed
  `);
  return rows[0] ?? null;
}

export async function finishPurchaseDelivery(db: DeliveryDatabase, job: ClaimedPurchaseDelivery,
  result: { status: DeliveryFinalState; code?: string; messageId?: string }, now = new Date()) {
  if (result.code && !/^[a-z0-9_]{1,100}$/.test(result.code)) throw new Error("delivery_error_code_invalid");
  if (result.status === "queued" && (!result.messageId || result.messageId.length > 255)) throw new Error("delivery_provider_message_id_invalid");
  const rows = await db.execute<{ id: string }>(sql`
    with finished as (
      update purchase_delivery_outbox set status = ${result.status},lease_token = null,lease_expires_at = null,
        last_error_code = ${result.code ?? null},provider_message_id = ${result.messageId ?? null},
        provider_accepted_at = ${result.status === "queued" ? now.toISOString() : null}::timestamptz,
        next_attempt_at = ${deliveryRetryAt(job.attempts, now).toISOString()}::timestamptz,
        updated_at = ${now.toISOString()}::timestamptz
      where id = ${job.id} and status = 'processing' and lease_token = ${job.leaseToken}
        and attempts = ${job.attempts} and lease_expires_at > ${now.toISOString()}::timestamptz
      returning id,attempts
    ), audited as (
      insert into purchase_delivery_events (id,delivery_id,event,attempt,code)
      select ${randomUUID()},id,${result.status},attempts,${result.code ?? null} from finished
    ) select id from finished
  `);
  return rows.length === 1;
}

function productLabel(job: ClaimedPurchaseDelivery) {
  if (job.scope === "master") return getPlan(job.productSlug)?.name ?? `Master ${job.productSlug}`;
  const contest = getCatalogContest(job.productSlug);
  return contest ? `${contestTitle(contest)} · ${contest.editionLabel}` : job.productSlug;
}

function defaultConfig(): DeliveryConfig | null {
  // Fechar vendas não suspende confirmações de clientes que já compraram.
  if (process.env.PURCHASE_DELIVERY_ENABLED?.trim().toLowerCase() !== "true") return null;
  const email = getTransactionalEmailConfig();
  const origin = process.env.APP_URL?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!email || !origin) return null;
  try {
    const safeOrigin = validateDeliveryOrigin(origin);
    if (process.env.NODE_ENV === "production" && !safeOrigin.startsWith("https://")) return null;
    return { from: email.from, origin: safeOrigin };
  } catch { return null; }
}

async function prepareDispatch(db: DeliveryDatabase, job: ClaimedPurchaseDelivery, snapshot: DeliverySnapshot, now: Date) {
  const digest = deliveryPayloadDigest(snapshot);
  const rows = await db.execute<{ id: string }>(sql`
    with prepared as (
      update purchase_delivery_outbox set payload = coalesce(payload,${JSON.stringify(snapshot)}::jsonb),
        payload_digest = coalesce(payload_digest,${digest}),first_dispatch_at = coalesce(first_dispatch_at,${now.toISOString()}::timestamptz),
        lease_expires_at = ${new Date(now.getTime() + DELIVERY_LEASE_MS).toISOString()}::timestamptz,
        updated_at = ${now.toISOString()}::timestamptz
      where id = ${job.id} and status = 'processing' and lease_token = ${job.leaseToken}
        and attempts = ${job.attempts} and lease_expires_at > ${now.toISOString()}::timestamptz
        and (payload_digest is null or payload_digest = ${digest})
        and (first_dispatch_at is null or first_dispatch_at > ${new Date(now.getTime() - DELIVERY_SAFE_RETRY_WINDOW_MS).toISOString()}::timestamptz)
        and exists (select 1 from users where id = ${job.userId} and email = ${snapshot.to})
        and ${entitlementExists(job, now)}
      returning id,attempts
    ), audited as (
      insert into purchase_delivery_events (id,delivery_id,event,attempt)
      select ${randomUUID()},id,'dispatch_prepared',attempts from prepared
    ) select id from prepared
  `);
  return rows.length === 1;
}

/** Pós-commit. queued significa aceito pelo Resend, NÃO entregue/aberto pelo cliente. */
export async function runPurchaseDeliveryWorker(options: { limit?: number } = {}, injected?: PurchaseDeliveryDependencies) {
  const limit = options.limit ?? 10;
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error("delivery_batch_limit_invalid");
  const config = injected ? injected.config() : defaultConfig();
  const summary = { disabled: !config, claimed: 0, queued: 0, retry: 0, manual_review: 0, cancelled: 0, leaseLost: 0 };
  if (!config) return summary;
  const db = injected?.db ?? getDb();
  const send = injected?.send ?? sendTransactionalEmail;
  const now = injected?.now ?? (() => new Date());
  for (let index = 0; index < limit; index += 1) {
    const job = await claimPurchaseDelivery(db, now());
    if (!job) break;
    summary.claimed += 1;
    let firstDispatchAt = job.firstDispatchAt ? new Date(job.firstDispatchAt) : null;
    let providerAccepted = false;
    const finish = async (result: Parameters<typeof finishPurchaseDelivery>[2]) => {
      if (await finishPurchaseDelivery(db, job, result, now())) summary[result.status] += 1;
      else summary.leaseLost += 1;
    };
    try {
      const [recipient] = await db.execute<RecipientContext>(sql`
        select email,name,${entitlementExists(job, now())} as eligible from users where id = ${job.userId}
      `);
      if (!recipient?.eligible) { await finish({ status: "cancelled", code: "delivery_entitlement_unavailable" }); continue; }
      const snapshot = job.payload ? deliverySnapshotSchema.parse(job.payload) : deliverySnapshotSchema.parse({
        version: 1, to: recipient.email, name: recipient.name, productLabel: productLabel(job), scope: job.scope,
        from: config.from, origin: validateDeliveryOrigin(config.origin),
      });
      if (snapshot.to !== recipient.email || snapshot.from !== config.from || snapshot.origin !== validateDeliveryOrigin(config.origin) ||
          snapshot.scope !== job.scope || (job.payloadDigest && deliveryPayloadDigest(snapshot) !== job.payloadDigest)) {
        await finish({ status: "manual_review", code: "delivery_payload_changed" }); continue;
      }
      if (!await prepareDispatch(db, job, snapshot, now())) {
        await finish({ status: "retry", code: "delivery_preflight_changed" }); continue;
      }
      firstDispatchAt ??= now();
      const message = buildPurchaseConfirmationV1(snapshot);
      // O remetente foi conferido contra a configuração atual; a mesma chave acompanha todas as retomadas.
      const accepted = await send({ to: message.to, subject: message.subject, html: message.html, text: message.text,
        idempotencyKey: `purchase-delivery/v1/${job.id}` });
      providerAccepted = true;
      if (!accepted.messageId) { await finish({ status: "manual_review", code: "delivery_provider_missing_id" }); continue; }
      await finish({ status: "queued", messageId: accepted.messageId });
    } catch (error) {
      const code = providerAccepted ? "delivery_acknowledgement_uncertain" : error instanceof TransactionalEmailError
        ? (/^[a-z0-9_]{1,100}$/.test(error.code) ? error.code : "delivery_provider_error") : "delivery_execution_failed";
      // Não despeja erro do provedor, destinatário, senha, link pessoal ou payload em logs.
      await finish({ status: deliveryFailureState(job.attempts, firstDispatchAt, now(), providerAccepted), code });
    }
  }
  return summary;
}
