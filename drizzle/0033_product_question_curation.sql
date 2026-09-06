CREATE TABLE "contest_product_question_bindings" (
	"id" text PRIMARY KEY NOT NULL,
	"product_slug" text NOT NULL,
	"opportunity_id" bigint NOT NULL,
	"requirement_id" bigint NOT NULL,
	"question_id" bigint NOT NULL,
	"source_document_id" bigint NOT NULL,
	"source_snapshot_id" bigint,
	"source_snapshot_checksum" text,
	"legal_article_id" bigint NOT NULL,
	"legal_version_id" bigint NOT NULL,
	"legal_version_checksum" text NOT NULL,
	"question_updated_at" timestamp with time zone NOT NULL,
	"requirement_text" text NOT NULL,
	"source_locator" text NOT NULL,
	"requirement_quote" text NOT NULL,
	"legal_quote" text NOT NULL,
	"scope_notes" text NOT NULL,
	"evidence" jsonb NOT NULL,
	"status" text DEFAULT 'pending_review' NOT NULL,
	"proposed_by_user_id" bigint NOT NULL,
	"reviewed_by_user_id" bigint,
	"reviewed_at" timestamp with time zone,
	"review_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "contest_product_bindings_hash_check" CHECK ("contest_product_question_bindings"."id" ~ '^[a-f0-9]{64}$' and "contest_product_question_bindings"."legal_version_checksum" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "contest_product_bindings_status_check" CHECK ("contest_product_question_bindings"."status" in ('pending_review','approved','rejected','suspended')),
	CONSTRAINT "contest_product_bindings_snapshot_check" CHECK (("contest_product_question_bindings"."source_snapshot_id" is null and "contest_product_question_bindings"."source_snapshot_checksum" is null) or ("contest_product_question_bindings"."source_snapshot_id" is not null and "contest_product_question_bindings"."source_snapshot_checksum" is not null and "contest_product_question_bindings"."source_snapshot_checksum" ~ '^[a-f0-9]{64}$')),
	CONSTRAINT "contest_product_bindings_evidence_check" CHECK (jsonb_typeof("contest_product_question_bindings"."evidence") = 'object' and char_length("contest_product_question_bindings"."requirement_quote") between 10 and 20000 and char_length("contest_product_question_bindings"."legal_quote") between 15 and 12000 and char_length("contest_product_question_bindings"."scope_notes") between 30 and 2000),
	CONSTRAINT "contest_product_bindings_review_check" CHECK (("contest_product_question_bindings"."status" = 'pending_review' and "contest_product_question_bindings"."reviewed_by_user_id" is null and "contest_product_question_bindings"."reviewed_at" is null and "contest_product_question_bindings"."review_notes" is null) or ("contest_product_question_bindings"."status" <> 'pending_review' and "contest_product_question_bindings"."reviewed_by_user_id" is not null and "contest_product_question_bindings"."reviewed_at" is not null and "contest_product_question_bindings"."review_notes" is not null and char_length(btrim("contest_product_question_bindings"."review_notes")) between 20 and 2000))
);
--> statement-breakpoint
ALTER TABLE "contest_product_question_bindings" ADD CONSTRAINT "contest_product_question_bindings_product_slug_contest_store_products_slug_fk" FOREIGN KEY ("product_slug") REFERENCES "public"."contest_store_products"("slug") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contest_product_question_bindings" ADD CONSTRAINT "contest_product_question_bindings_opportunity_id_contest_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."contest_opportunities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contest_product_question_bindings" ADD CONSTRAINT "contest_product_question_bindings_requirement_id_opportunity_requirements_id_fk" FOREIGN KEY ("requirement_id") REFERENCES "public"."opportunity_requirements"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contest_product_question_bindings" ADD CONSTRAINT "contest_product_question_bindings_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contest_product_question_bindings" ADD CONSTRAINT "contest_product_question_bindings_source_document_id_opportunity_source_documents_id_fk" FOREIGN KEY ("source_document_id") REFERENCES "public"."opportunity_source_documents"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contest_product_question_bindings" ADD CONSTRAINT "contest_product_question_bindings_source_snapshot_id_opportunity_document_snapshots_id_fk" FOREIGN KEY ("source_snapshot_id") REFERENCES "public"."opportunity_document_snapshots"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contest_product_question_bindings" ADD CONSTRAINT "contest_product_question_bindings_legal_article_id_legal_articles_id_fk" FOREIGN KEY ("legal_article_id") REFERENCES "public"."legal_articles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contest_product_question_bindings" ADD CONSTRAINT "contest_product_question_bindings_legal_version_id_legal_versions_id_fk" FOREIGN KEY ("legal_version_id") REFERENCES "public"."legal_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contest_product_question_bindings" ADD CONSTRAINT "contest_product_question_bindings_proposed_by_user_id_users_id_fk" FOREIGN KEY ("proposed_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contest_product_question_bindings" ADD CONSTRAINT "contest_product_question_bindings_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "contest_product_bindings_access_idx" ON "contest_product_question_bindings" USING btree ("product_slug","status","question_id");--> statement-breakpoint
CREATE INDEX "contest_product_bindings_requirement_idx" ON "contest_product_question_bindings" USING btree ("requirement_id");