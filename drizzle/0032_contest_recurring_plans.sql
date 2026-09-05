CREATE TABLE "contest_billing_invoices" (
	"invoice_id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"payment_intent_id" text NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'paid' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "contest_billing_invoices_payment_intent_id_unique" UNIQUE("payment_intent_id"),
	CONSTRAINT "contest_billing_invoices_period_check" CHECK ("contest_billing_invoices"."period_end" > "contest_billing_invoices"."period_start"),
	CONSTRAINT "contest_billing_invoices_status_check" CHECK ("contest_billing_invoices"."status" in ('paid','refunded','disputed'))
);
--> statement-breakpoint
ALTER TABLE "contest_orders" ADD COLUMN "stripe_subscription_id" text;--> statement-breakpoint
ALTER TABLE "contest_orders" ADD COLUMN "stripe_customer_id" text;--> statement-breakpoint
ALTER TABLE "contest_orders" ADD COLUMN "subscription_status" text;--> statement-breakpoint
ALTER TABLE "contest_orders" ADD COLUMN "cancel_at_period_end" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "contest_orders" ADD COLUMN "paid_through" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "contest_store_products" ADD COLUMN "stripe_price_monthly" text;--> statement-breakpoint
ALTER TABLE "contest_store_products" ADD COLUMN "stripe_price_annual" text;--> statement-breakpoint
ALTER TABLE "contest_billing_invoices" ADD CONSTRAINT "contest_billing_invoices_order_id_contest_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."contest_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "contest_billing_invoices_order_idx" ON "contest_billing_invoices" USING btree ("order_id");--> statement-breakpoint
ALTER TABLE "contest_orders" ADD CONSTRAINT "contest_orders_stripe_subscription_id_unique" UNIQUE("stripe_subscription_id");--> statement-breakpoint
ALTER TABLE "contest_store_products" ADD CONSTRAINT "contest_store_products_stripe_price_monthly_unique" UNIQUE("stripe_price_monthly");--> statement-breakpoint
ALTER TABLE "contest_store_products" ADD CONSTRAINT "contest_store_products_stripe_price_annual_unique" UNIQUE("stripe_price_annual");