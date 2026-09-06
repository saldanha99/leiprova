CREATE TABLE "purchase_delivery_events" (
	"id" text PRIMARY KEY NOT NULL,
	"delivery_id" text NOT NULL,
	"event" text NOT NULL,
	"attempt" integer NOT NULL,
	"code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "purchase_delivery_events_type_check" CHECK ("purchase_delivery_events"."event" in ('enqueued','claimed','dispatch_prepared','retry','queued','manual_review','cancelled')),
	CONSTRAINT "purchase_delivery_events_attempt_check" CHECK ("purchase_delivery_events"."attempt" between 0 and 6),
	CONSTRAINT "purchase_delivery_events_code_check" CHECK ("purchase_delivery_events"."code" is null or "purchase_delivery_events"."code" ~ '^[a-z0-9_]{1,100}$')
);
--> statement-breakpoint
CREATE TABLE "purchase_delivery_outbox" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" bigint NOT NULL,
	"scope" text NOT NULL,
	"purchase_id" text NOT NULL,
	"product_slug" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"lease_token" text,
	"lease_expires_at" timestamp with time zone,
	"payload" jsonb,
	"payload_digest" text,
	"first_dispatch_at" timestamp with time zone,
	"last_error_code" text,
	"provider_message_id" text,
	"provider_accepted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "purchase_delivery_id_check" CHECK ("purchase_delivery_outbox"."id" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "purchase_delivery_scope_check" CHECK ("purchase_delivery_outbox"."scope" in ('master','contest')),
	CONSTRAINT "purchase_delivery_reference_check" CHECK (char_length("purchase_delivery_outbox"."purchase_id") between 1 and 240 and char_length("purchase_delivery_outbox"."product_slug") between 1 and 240),
	CONSTRAINT "purchase_delivery_status_check" CHECK ("purchase_delivery_outbox"."status" in ('pending','processing','retry','queued','manual_review','cancelled')),
	CONSTRAINT "purchase_delivery_attempts_check" CHECK ("purchase_delivery_outbox"."attempts" between 0 and 6),
	CONSTRAINT "purchase_delivery_lease_check" CHECK (("purchase_delivery_outbox"."status" = 'processing' and "purchase_delivery_outbox"."lease_token" is not null and "purchase_delivery_outbox"."lease_expires_at" is not null) or ("purchase_delivery_outbox"."status" <> 'processing' and "purchase_delivery_outbox"."lease_token" is null and "purchase_delivery_outbox"."lease_expires_at" is null)),
	CONSTRAINT "purchase_delivery_payload_check" CHECK (("purchase_delivery_outbox"."payload" is null and "purchase_delivery_outbox"."payload_digest" is null and "purchase_delivery_outbox"."first_dispatch_at" is null) or ("purchase_delivery_outbox"."payload" is not null and "purchase_delivery_outbox"."payload_digest" is not null and jsonb_typeof("purchase_delivery_outbox"."payload") = 'object' and "purchase_delivery_outbox"."payload" ?& array['version','to','name','productLabel','scope','origin','from'] and ("purchase_delivery_outbox"."payload" - array['version','to','name','productLabel','scope','origin','from']) = '{}'::jsonb and "purchase_delivery_outbox"."payload_digest" ~ '^[a-f0-9]{64}$' and "purchase_delivery_outbox"."first_dispatch_at" is not null)),
	CONSTRAINT "purchase_delivery_error_check" CHECK ("purchase_delivery_outbox"."last_error_code" is null or "purchase_delivery_outbox"."last_error_code" ~ '^[a-z0-9_]{1,100}$'),
	CONSTRAINT "purchase_delivery_accepted_check" CHECK ("purchase_delivery_outbox"."status" <> 'queued' or ("purchase_delivery_outbox"."provider_message_id" is not null and "purchase_delivery_outbox"."provider_accepted_at" is not null and "purchase_delivery_outbox"."payload_digest" is not null))
);
--> statement-breakpoint
ALTER TABLE "purchase_delivery_events" ADD CONSTRAINT "purchase_delivery_events_delivery_id_purchase_delivery_outbox_id_fk" FOREIGN KEY ("delivery_id") REFERENCES "public"."purchase_delivery_outbox"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_delivery_outbox" ADD CONSTRAINT "purchase_delivery_outbox_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "purchase_delivery_events_delivery_idx" ON "purchase_delivery_events" USING btree ("delivery_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "purchase_delivery_identity_uidx" ON "purchase_delivery_outbox" USING btree ("scope","purchase_id","product_slug");--> statement-breakpoint
CREATE INDEX "purchase_delivery_user_idx" ON "purchase_delivery_outbox" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "purchase_delivery_due_idx" ON "purchase_delivery_outbox" USING btree ("next_attempt_at","created_at") WHERE "purchase_delivery_outbox"."status" in ('pending','retry');--> statement-breakpoint
CREATE INDEX "purchase_delivery_lease_idx" ON "purchase_delivery_outbox" USING btree ("lease_expires_at") WHERE "purchase_delivery_outbox"."status" = 'processing';