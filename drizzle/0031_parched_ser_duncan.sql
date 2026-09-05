CREATE TABLE "contest_orders" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" bigint NOT NULL,
	"status" text DEFAULT 'created' NOT NULL,
	"currency" text DEFAULT 'brl' NOT NULL,
	"amount_cents" integer NOT NULL,
	"lines" jsonb NOT NULL,
	"stripe_session_id" text,
	"stripe_payment_intent_id" text,
	"stripe_mode" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "contest_orders_stripe_session_id_unique" UNIQUE("stripe_session_id"),
	CONSTRAINT "contest_orders_stripe_payment_intent_id_unique" UNIQUE("stripe_payment_intent_id"),
	CONSTRAINT "contest_orders_status_check" CHECK ("contest_orders"."status" in ('created','pending','paid','failed','expired','refunded','disputed')),
	CONSTRAINT "contest_orders_amount_check" CHECK ("contest_orders"."amount_cents" > 0 and "contest_orders"."currency" = 'brl'),
	CONSTRAINT "contest_orders_mode_check" CHECK ("contest_orders"."stripe_mode" in ('test','live')),
	CONSTRAINT "contest_orders_lines_check" CHECK (jsonb_typeof("contest_orders"."lines") = 'array' and jsonb_array_length("contest_orders"."lines") between 1 and 3)
);
--> statement-breakpoint
CREATE TABLE "contest_purchases" (
	"order_id" text NOT NULL,
	"product_slug" text NOT NULL,
	"opportunity_id" bigint NOT NULL,
	"user_id" bigint NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"access_starts_at" timestamp with time zone NOT NULL,
	"access_ends_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "contest_purchases_order_id_product_slug_pk" PRIMARY KEY("order_id","product_slug"),
	CONSTRAINT "contest_purchases_status_check" CHECK ("contest_purchases"."status" in ('active','revoked')),
	CONSTRAINT "contest_purchases_period_check" CHECK ("contest_purchases"."access_ends_at" > "contest_purchases"."access_starts_at")
);
--> statement-breakpoint
CREATE TABLE "contest_store_products" (
	"slug" text PRIMARY KEY NOT NULL,
	"opportunity_id" bigint,
	"status" text DEFAULT 'draft' NOT NULL,
	"stripe_product_id" text,
	"stripe_price_6m" text,
	"stripe_price_12m" text,
	"stripe_mode" text DEFAULT 'test' NOT NULL,
	"released_at" timestamp with time zone,
	"released_by_user_id" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "contest_store_products_stripe_product_id_unique" UNIQUE("stripe_product_id"),
	CONSTRAINT "contest_store_products_stripe_price_6m_unique" UNIQUE("stripe_price_6m"),
	CONSTRAINT "contest_store_products_stripe_price_12m_unique" UNIQUE("stripe_price_12m"),
	CONSTRAINT "contest_store_status_check" CHECK ("contest_store_products"."status" in ('draft','released','retired')),
	CONSTRAINT "contest_store_mode_check" CHECK ("contest_store_products"."stripe_mode" in ('test','live')),
	CONSTRAINT "contest_store_release_check" CHECK ("contest_store_products"."status" <> 'released' or ("contest_store_products"."opportunity_id" is not null and "contest_store_products"."released_at" is not null and "contest_store_products"."released_by_user_id" is not null))
);
--> statement-breakpoint
ALTER TABLE "contest_orders" ADD CONSTRAINT "contest_orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contest_purchases" ADD CONSTRAINT "contest_purchases_order_id_contest_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."contest_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contest_purchases" ADD CONSTRAINT "contest_purchases_product_slug_contest_store_products_slug_fk" FOREIGN KEY ("product_slug") REFERENCES "public"."contest_store_products"("slug") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contest_purchases" ADD CONSTRAINT "contest_purchases_opportunity_id_contest_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."contest_opportunities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contest_purchases" ADD CONSTRAINT "contest_purchases_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contest_store_products" ADD CONSTRAINT "contest_store_products_opportunity_id_contest_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."contest_opportunities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contest_store_products" ADD CONSTRAINT "contest_store_products_released_by_user_id_users_id_fk" FOREIGN KEY ("released_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "contest_orders_user_idx" ON "contest_orders" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "contest_purchases_user_access_idx" ON "contest_purchases" USING btree ("user_id","status","access_ends_at");--> statement-breakpoint
CREATE INDEX "contest_purchases_product_idx" ON "contest_purchases" USING btree ("product_slug");--> statement-breakpoint
CREATE INDEX "contest_purchases_opportunity_idx" ON "contest_purchases" USING btree ("opportunity_id");--> statement-breakpoint
CREATE INDEX "contest_store_opportunity_idx" ON "contest_store_products" USING btree ("opportunity_id");--> statement-breakpoint
CREATE INDEX "contest_store_released_by_idx" ON "contest_store_products" USING btree ("released_by_user_id");