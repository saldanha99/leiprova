CREATE TABLE "contest_product_previous_exam_waivers" (
	"product_slug" text PRIMARY KEY NOT NULL,
	"reason" text NOT NULL,
	"approval_reference" text NOT NULL,
	"decided_by_user_id" bigint NOT NULL,
	"decided_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "contest_product_previous_exam_waivers_reason_check" CHECK (char_length(btrim("contest_product_previous_exam_waivers"."reason")) between 20 and 1000),
	CONSTRAINT "contest_product_previous_exam_waivers_reference_check" CHECK ("contest_product_previous_exam_waivers"."approval_reference" ~ '^[a-z0-9][a-z0-9._:/-]{0,159}$')
);
--> statement-breakpoint
ALTER TABLE "contest_product_previous_exam_waivers" ADD CONSTRAINT "contest_product_previous_exam_waivers_product_slug_contest_store_products_slug_fk" FOREIGN KEY ("product_slug") REFERENCES "public"."contest_store_products"("slug") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contest_product_previous_exam_waivers" ADD CONSTRAINT "contest_product_previous_exam_waivers_decided_by_user_id_users_id_fk" FOREIGN KEY ("decided_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;