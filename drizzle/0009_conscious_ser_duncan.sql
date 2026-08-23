CREATE TABLE "stripe_connect_partners" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "stripe_connect_partners_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"public_id" text NOT NULL,
	"display_name" text NOT NULL,
	"legal_name" text NOT NULL,
	"email" text NOT NULL,
	"country" text DEFAULT 'BR' NOT NULL,
	"currency" text DEFAULT 'brl' NOT NULL,
	"stripe_account_id" text,
	"account_type" text DEFAULT 'express' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"details_submitted" boolean DEFAULT false NOT NULL,
	"charges_enabled" boolean DEFAULT false NOT NULL,
	"payouts_enabled" boolean DEFAULT false NOT NULL,
	"requirements_currently_due" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"requirements_past_due" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_by_user_id" bigint,
	"updated_by_user_id" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stripe_connect_partners_public_id_unique" UNIQUE("public_id"),
	CONSTRAINT "stripe_connect_partners_stripe_account_id_unique" UNIQUE("stripe_account_id"),
	CONSTRAINT "stripe_connect_partners_public_id_check" CHECK ("stripe_connect_partners"."public_id" ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'),
	CONSTRAINT "stripe_connect_partners_country_check" CHECK ("stripe_connect_partners"."country" = upper("stripe_connect_partners"."country")),
	CONSTRAINT "stripe_connect_partners_currency_check" CHECK ("stripe_connect_partners"."currency" = lower("stripe_connect_partners"."currency")),
	CONSTRAINT "stripe_connect_partners_account_id_check" CHECK ("stripe_connect_partners"."stripe_account_id" is null or "stripe_connect_partners"."stripe_account_id" ~ '^acct_[A-Za-z0-9]+$'),
	CONSTRAINT "stripe_connect_partners_account_type_check" CHECK ("stripe_connect_partners"."account_type" = 'express'),
	CONSTRAINT "stripe_connect_partners_status_check" CHECK ("stripe_connect_partners"."status" in ('draft', 'onboarding', 'restricted', 'enabled', 'paused', 'archived'))
);
--> statement-breakpoint
CREATE TABLE "stripe_connect_split_allocations" (
	"rule_id" bigint NOT NULL,
	"partner_id" bigint NOT NULL,
	"share_bps" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stripe_connect_split_allocations_pkey" PRIMARY KEY("rule_id","partner_id"),
	CONSTRAINT "stripe_connect_split_allocations_share_check" CHECK ("stripe_connect_split_allocations"."share_bps" between 1 and 10000)
);
--> statement-breakpoint
CREATE TABLE "stripe_connect_split_rules" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "stripe_connect_split_rules_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"public_id" text NOT NULL,
	"name" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"charge_model" text DEFAULT 'separate_charges_transfers' NOT NULL,
	"currency" text DEFAULT 'brl' NOT NULL,
	"platform_share_bps" integer DEFAULT 0 NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"effective_from" timestamp with time zone,
	"effective_until" timestamp with time zone,
	"created_by_user_id" bigint,
	"updated_by_user_id" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stripe_connect_split_rules_public_id_unique" UNIQUE("public_id"),
	CONSTRAINT "stripe_connect_split_rules_public_id_check" CHECK ("stripe_connect_split_rules"."public_id" ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'),
	CONSTRAINT "stripe_connect_split_rules_status_check" CHECK ("stripe_connect_split_rules"."status" in ('draft', 'pending_approval', 'active', 'paused', 'archived')),
	CONSTRAINT "stripe_connect_split_rules_charge_model_check" CHECK ("stripe_connect_split_rules"."charge_model" = 'separate_charges_transfers'),
	CONSTRAINT "stripe_connect_split_rules_currency_check" CHECK ("stripe_connect_split_rules"."currency" = lower("stripe_connect_split_rules"."currency")),
	CONSTRAINT "stripe_connect_split_rules_platform_share_check" CHECK ("stripe_connect_split_rules"."platform_share_bps" between 0 and 10000),
	CONSTRAINT "stripe_connect_split_rules_version_check" CHECK ("stripe_connect_split_rules"."version" >= 1),
	CONSTRAINT "stripe_connect_split_rules_effective_period_check" CHECK ("stripe_connect_split_rules"."effective_until" is null or "stripe_connect_split_rules"."effective_from" is null or "stripe_connect_split_rules"."effective_until" > "stripe_connect_split_rules"."effective_from")
);
--> statement-breakpoint
CREATE TABLE "stripe_connect_transfer_batches" (
	"id" text PRIMARY KEY NOT NULL,
	"checkout_attempt_id" text NOT NULL,
	"rule_id" bigint NOT NULL,
	"provider_payment_intent_id" text,
	"provider_charge_id" text,
	"transfer_group" text NOT NULL,
	"status" text DEFAULT 'planned' NOT NULL,
	"gross_amount_cents" integer NOT NULL,
	"platform_amount_cents" integer NOT NULL,
	"partner_amount_cents" integer NOT NULL,
	"currency" text DEFAULT 'brl' NOT NULL,
	"livemode" boolean NOT NULL,
	"failure_code" text,
	"failure_message" text,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stripe_connect_transfer_batches_checkout_attempt_id_unique" UNIQUE("checkout_attempt_id"),
	CONSTRAINT "stripe_connect_transfer_batches_provider_payment_intent_id_unique" UNIQUE("provider_payment_intent_id"),
	CONSTRAINT "stripe_connect_transfer_batches_provider_charge_id_unique" UNIQUE("provider_charge_id"),
	CONSTRAINT "stripe_connect_transfer_batches_transfer_group_unique" UNIQUE("transfer_group"),
	CONSTRAINT "stripe_connect_transfer_batches_status_check" CHECK ("stripe_connect_transfer_batches"."status" in ('planned', 'processing', 'completed', 'failed', 'partially_reversed', 'reversed')),
	CONSTRAINT "stripe_connect_transfer_batches_amounts_check" CHECK ("stripe_connect_transfer_batches"."gross_amount_cents" > 0
        and "stripe_connect_transfer_batches"."platform_amount_cents" >= 0
        and "stripe_connect_transfer_batches"."partner_amount_cents" >= 0
        and "stripe_connect_transfer_batches"."platform_amount_cents" + "stripe_connect_transfer_batches"."partner_amount_cents" = "stripe_connect_transfer_batches"."gross_amount_cents"),
	CONSTRAINT "stripe_connect_transfer_batches_currency_check" CHECK ("stripe_connect_transfer_batches"."currency" = lower("stripe_connect_transfer_batches"."currency"))
);
--> statement-breakpoint
CREATE TABLE "stripe_connect_transfers" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "stripe_connect_transfers_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"batch_id" text NOT NULL,
	"partner_id" bigint NOT NULL,
	"provider_transfer_id" text,
	"idempotency_key" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"reversed_amount_cents" integer DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'brl' NOT NULL,
	"status" text DEFAULT 'planned' NOT NULL,
	"failure_code" text,
	"failure_message" text,
	"transferred_at" timestamp with time zone,
	"reversed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stripe_connect_transfers_provider_transfer_id_unique" UNIQUE("provider_transfer_id"),
	CONSTRAINT "stripe_connect_transfers_idempotency_key_unique" UNIQUE("idempotency_key"),
	CONSTRAINT "stripe_connect_transfers_amount_check" CHECK ("stripe_connect_transfers"."amount_cents" > 0),
	CONSTRAINT "stripe_connect_transfers_reversed_amount_check" CHECK ("stripe_connect_transfers"."reversed_amount_cents" between 0 and "stripe_connect_transfers"."amount_cents"),
	CONSTRAINT "stripe_connect_transfers_currency_check" CHECK ("stripe_connect_transfers"."currency" = lower("stripe_connect_transfers"."currency")),
	CONSTRAINT "stripe_connect_transfers_status_check" CHECK ("stripe_connect_transfers"."status" in ('planned', 'pending', 'succeeded', 'failed', 'partially_reversed', 'reversed'))
);
--> statement-breakpoint
ALTER TABLE "stripe_connect_partners" ADD CONSTRAINT "stripe_connect_partners_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stripe_connect_partners" ADD CONSTRAINT "stripe_connect_partners_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stripe_connect_split_allocations" ADD CONSTRAINT "stripe_connect_split_allocations_rule_id_stripe_connect_split_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."stripe_connect_split_rules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stripe_connect_split_allocations" ADD CONSTRAINT "stripe_connect_split_allocations_partner_id_stripe_connect_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."stripe_connect_partners"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stripe_connect_split_rules" ADD CONSTRAINT "stripe_connect_split_rules_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stripe_connect_split_rules" ADD CONSTRAINT "stripe_connect_split_rules_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stripe_connect_transfer_batches" ADD CONSTRAINT "stripe_connect_transfer_batches_checkout_attempt_id_checkout_attempts_id_fk" FOREIGN KEY ("checkout_attempt_id") REFERENCES "public"."checkout_attempts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stripe_connect_transfer_batches" ADD CONSTRAINT "stripe_connect_transfer_batches_rule_id_stripe_connect_split_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."stripe_connect_split_rules"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stripe_connect_transfers" ADD CONSTRAINT "stripe_connect_transfers_batch_id_stripe_connect_transfer_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."stripe_connect_transfer_batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stripe_connect_transfers" ADD CONSTRAINT "stripe_connect_transfers_partner_id_stripe_connect_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."stripe_connect_partners"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "stripe_connect_partners_status_idx" ON "stripe_connect_partners" USING btree ("status");--> statement-breakpoint
CREATE INDEX "stripe_connect_partners_created_by_idx" ON "stripe_connect_partners" USING btree ("created_by_user_id");--> statement-breakpoint
CREATE INDEX "stripe_connect_partners_updated_by_idx" ON "stripe_connect_partners" USING btree ("updated_by_user_id");--> statement-breakpoint
CREATE INDEX "stripe_connect_split_allocations_partner_idx" ON "stripe_connect_split_allocations" USING btree ("partner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "stripe_connect_split_rules_one_active_uidx" ON "stripe_connect_split_rules" USING btree ("status") WHERE "stripe_connect_split_rules"."status" = 'active';--> statement-breakpoint
CREATE INDEX "stripe_connect_split_rules_created_by_idx" ON "stripe_connect_split_rules" USING btree ("created_by_user_id");--> statement-breakpoint
CREATE INDEX "stripe_connect_split_rules_updated_by_idx" ON "stripe_connect_split_rules" USING btree ("updated_by_user_id");--> statement-breakpoint
CREATE INDEX "stripe_connect_transfer_batches_status_created_idx" ON "stripe_connect_transfer_batches" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "stripe_connect_transfer_batches_rule_idx" ON "stripe_connect_transfer_batches" USING btree ("rule_id");--> statement-breakpoint
CREATE UNIQUE INDEX "stripe_connect_transfers_batch_partner_uidx" ON "stripe_connect_transfers" USING btree ("batch_id","partner_id");--> statement-breakpoint
CREATE INDEX "stripe_connect_transfers_partner_status_idx" ON "stripe_connect_transfers" USING btree ("partner_id","status");