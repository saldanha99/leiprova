ALTER TABLE "contest_store_products" ADD COLUMN "preparation_mode" text DEFAULT 'current_notice' NOT NULL;
--> statement-breakpoint
ALTER TABLE "contest_store_products" ADD COLUMN "preparation_reviewed_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "contest_store_products" ADD COLUMN "preparation_reviewed_by_user_id" bigint;
--> statement-breakpoint
ALTER TABLE "contest_store_products" ADD CONSTRAINT "contest_store_products_preparation_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("preparation_reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "contest_store_products" ADD COLUMN "preparation_approval_reference" text;
--> statement-breakpoint
ALTER TABLE "contest_store_products" ADD COLUMN "preparation_opportunity_updated_at" timestamp with time zone;
--> statement-breakpoint
CREATE INDEX "contest_store_preparation_reviewer_idx" ON "contest_store_products" ("preparation_reviewed_by_user_id");
--> statement-breakpoint
ALTER TABLE "contest_store_products" ADD CONSTRAINT "contest_store_preparation_mode_check" CHECK ("preparation_mode" in ('current_notice','historical_training','pre_notice'));
--> statement-breakpoint
ALTER TABLE "contest_store_products" ADD CONSTRAINT "contest_store_preparation_review_check" CHECK ("preparation_mode" = 'current_notice' or (
  "opportunity_id" is not null and "preparation_reviewed_at" is not null
  and "preparation_reviewed_by_user_id" is not null and "preparation_opportunity_updated_at" is not null
  and "preparation_approval_reference" is not null
  and "preparation_approval_reference" ~ '^[a-z0-9][a-z0-9._:/-]{0,159}$'
));
