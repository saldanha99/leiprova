CREATE TABLE "question_notebook_items" (
	"notebook_id" bigint NOT NULL,
	"question_id" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "question_notebook_items_pkey" PRIMARY KEY("notebook_id","question_id")
);
--> statement-breakpoint
CREATE TABLE "question_notebooks" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "question_notebooks_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"public_id" text NOT NULL,
	"user_id" bigint NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "question_notebooks_public_id_unique" UNIQUE("public_id"),
	CONSTRAINT "question_notebooks_name_check" CHECK (char_length(btrim("question_notebooks"."name")) between 1 and 80),
	CONSTRAINT "question_notebooks_description_check" CHECK ("question_notebooks"."description" is null or char_length("question_notebooks"."description") <= 240)
);
--> statement-breakpoint
CREATE TABLE "saved_study_filters" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "saved_study_filters_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"user_id" bigint NOT NULL,
	"legal_act_id" bigint NOT NULL,
	"name" text NOT NULL,
	"article_start_order" integer NOT NULL,
	"article_end_order" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "saved_study_filters_name_check" CHECK (char_length(btrim("saved_study_filters"."name")) between 1 and 80),
	CONSTRAINT "saved_study_filters_article_range_check" CHECK ("saved_study_filters"."article_start_order" >= 0 and "saved_study_filters"."article_end_order" >= "saved_study_filters"."article_start_order")
);
--> statement-breakpoint
ALTER TABLE "question_notebook_items" ADD CONSTRAINT "question_notebook_items_notebook_id_question_notebooks_id_fk" FOREIGN KEY ("notebook_id") REFERENCES "public"."question_notebooks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_notebook_items" ADD CONSTRAINT "question_notebook_items_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_notebooks" ADD CONSTRAINT "question_notebooks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_study_filters" ADD CONSTRAINT "saved_study_filters_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_study_filters" ADD CONSTRAINT "saved_study_filters_legal_act_id_legal_acts_id_fk" FOREIGN KEY ("legal_act_id") REFERENCES "public"."legal_acts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "question_notebook_items_question_id_idx" ON "question_notebook_items" USING btree ("question_id");--> statement-breakpoint
CREATE UNIQUE INDEX "question_notebooks_user_name_uidx" ON "question_notebooks" USING btree ("user_id",lower("name"));--> statement-breakpoint
CREATE INDEX "question_notebooks_user_updated_idx" ON "question_notebooks" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "saved_study_filters_user_name_uidx" ON "saved_study_filters" USING btree ("user_id",lower("name"));--> statement-breakpoint
CREATE INDEX "saved_study_filters_user_updated_idx" ON "saved_study_filters" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE INDEX "saved_study_filters_legal_act_id_idx" ON "saved_study_filters" USING btree ("legal_act_id");