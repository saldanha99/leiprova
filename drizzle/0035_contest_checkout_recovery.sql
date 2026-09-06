ALTER TABLE "contest_orders" ADD COLUMN "checkout_ui_mode" text DEFAULT 'hosted' NOT NULL;--> statement-breakpoint
ALTER TABLE "contest_orders" ADD COLUMN "stripe_creation_started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "contest_orders" ADD CONSTRAINT "contest_orders_ui_mode_check" CHECK ("contest_orders"."checkout_ui_mode" in ('hosted','elements'));--> statement-breakpoint
-- Legados podem ter criado uma sessão cuja resposta se perdeu. Não presumir ausência na Stripe.
UPDATE "contest_orders" SET "stripe_creation_started_at" = "created_at"
WHERE "status" IN ('created','pending');
