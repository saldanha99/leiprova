import { sql } from "drizzle-orm";
import { bigint, check, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import type { DeliverySnapshot } from "@/lib/commerce/purchase-delivery-core";
import { users } from "./schema";

export const purchaseDeliveryOutbox = pgTable("purchase_delivery_outbox", {
  id: text("id").primaryKey(),
  userId: bigint("user_id", { mode: "number" }).notNull().references(() => users.id, { onDelete: "cascade" }),
  scope: text("scope").notNull(),
  purchaseId: text("purchase_id").notNull(),
  productSlug: text("product_slug").notNull(),
  status: text("status").notNull().default("pending"),
  attempts: integer("attempts").notNull().default(0),
  nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }).notNull().defaultNow(),
  leaseToken: text("lease_token"),
  leaseExpiresAt: timestamp("lease_expires_at", { withTimezone: true }),
  payload: jsonb("payload").$type<DeliverySnapshot>(),
  payloadDigest: text("payload_digest"),
  firstDispatchAt: timestamp("first_dispatch_at", { withTimezone: true }),
  lastErrorCode: text("last_error_code"),
  providerMessageId: text("provider_message_id"),
  providerAcceptedAt: timestamp("provider_accepted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("purchase_delivery_identity_uidx").on(table.scope, table.purchaseId, table.productSlug),
  index("purchase_delivery_user_idx").on(table.userId),
  index("purchase_delivery_due_idx").on(table.nextAttemptAt, table.createdAt).where(sql`${table.status} in ('pending','retry')`),
  index("purchase_delivery_lease_idx").on(table.leaseExpiresAt).where(sql`${table.status} = 'processing'`),
  check("purchase_delivery_id_check", sql`${table.id} ~ '^[a-f0-9]{64}$'`),
  check("purchase_delivery_scope_check", sql`${table.scope} in ('master','contest')`),
  check("purchase_delivery_reference_check", sql`char_length(${table.purchaseId}) between 1 and 240 and char_length(${table.productSlug}) between 1 and 240`),
  check("purchase_delivery_status_check", sql`${table.status} in ('pending','processing','retry','queued','manual_review','cancelled')`),
  check("purchase_delivery_attempts_check", sql`${table.attempts} between 0 and 6`),
  check("purchase_delivery_lease_check", sql`(${table.status} = 'processing' and ${table.leaseToken} is not null and ${table.leaseExpiresAt} is not null) or (${table.status} <> 'processing' and ${table.leaseToken} is null and ${table.leaseExpiresAt} is null)`),
  check("purchase_delivery_payload_check", sql`(${table.payload} is null and ${table.payloadDigest} is null and ${table.firstDispatchAt} is null) or (${table.payload} is not null and ${table.payloadDigest} is not null and jsonb_typeof(${table.payload}) = 'object' and ${table.payload} ?& array['version','to','name','productLabel','scope','origin','from'] and (${table.payload} - array['version','to','name','productLabel','scope','origin','from']) = '{}'::jsonb and ${table.payloadDigest} ~ '^[a-f0-9]{64}$' and ${table.firstDispatchAt} is not null)`),
  check("purchase_delivery_error_check", sql`${table.lastErrorCode} is null or ${table.lastErrorCode} ~ '^[a-z0-9_]{1,100}$'`),
  check("purchase_delivery_accepted_check", sql`${table.status} <> 'queued' or (${table.providerMessageId} is not null and ${table.providerAcceptedAt} is not null and ${table.payloadDigest} is not null)`),
]);

// Histórico só de identificadores operacionais/estados; nunca copia o payload ou endereço.
export const purchaseDeliveryEvents = pgTable("purchase_delivery_events", {
  id: text("id").primaryKey(),
  deliveryId: text("delivery_id").notNull().references(() => purchaseDeliveryOutbox.id, { onDelete: "cascade" }),
  event: text("event").notNull(),
  attempt: integer("attempt").notNull(),
  code: text("code"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("purchase_delivery_events_delivery_idx").on(table.deliveryId, table.createdAt),
  check("purchase_delivery_events_type_check", sql`${table.event} in ('enqueued','claimed','dispatch_prepared','retry','queued','manual_review','cancelled')`),
  check("purchase_delivery_events_attempt_check", sql`${table.attempt} between 0 and 6`),
  check("purchase_delivery_events_code_check", sql`${table.code} is null or ${table.code} ~ '^[a-z0-9_]{1,100}$'`),
]);
