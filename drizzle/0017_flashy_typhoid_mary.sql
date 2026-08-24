CREATE TABLE "account_access_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" bigint NOT NULL,
	"checkout_attempt_id" text,
	"purpose" text NOT NULL,
	"delivery_status" text DEFAULT 'pending' NOT NULL,
	"provider_message_id" text,
	"last_error" text,
	"expires_at" timestamp with time zone NOT NULL,
	"sent_at" timestamp with time zone,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "account_access_tokens_id_check" CHECK ("account_access_tokens"."id" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "account_access_tokens_purpose_check" CHECK ("account_access_tokens"."purpose" in ('purchase_access', 'password_reset')),
	CONSTRAINT "account_access_tokens_delivery_check" CHECK ("account_access_tokens"."delivery_status" in ('pending', 'sent', 'failed')),
	CONSTRAINT "account_access_tokens_expiry_check" CHECK ("account_access_tokens"."expires_at" > "account_access_tokens"."created_at"),
	CONSTRAINT "account_access_tokens_error_check" CHECK ("account_access_tokens"."last_error" is null or char_length("account_access_tokens"."last_error") <= 500)
);
--> statement-breakpoint
ALTER TABLE "account_access_tokens" ADD CONSTRAINT "account_access_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_access_tokens" ADD CONSTRAINT "account_access_tokens_checkout_attempt_id_checkout_attempts_id_fk" FOREIGN KEY ("checkout_attempt_id") REFERENCES "public"."checkout_attempts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "account_access_tokens_checkout_uidx" ON "account_access_tokens" USING btree ("checkout_attempt_id") WHERE "account_access_tokens"."checkout_attempt_id" is not null;--> statement-breakpoint
CREATE INDEX "account_access_tokens_user_created_idx" ON "account_access_tokens" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "account_access_tokens_expires_idx" ON "account_access_tokens" USING btree ("expires_at");