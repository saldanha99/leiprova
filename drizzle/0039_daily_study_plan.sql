CREATE TABLE "user_daily_study_progress" (
	"user_id" bigint NOT NULL,
	"study_date" date NOT NULL,
	"legal_act_id" bigint NOT NULL,
	"article_start_order" integer NOT NULL,
	"article_end_order" integer NOT NULL,
	"reading_completed_at" timestamp with time zone,
	"review_completed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_daily_study_progress_pkey" PRIMARY KEY("user_id","study_date"),
	CONSTRAINT "user_daily_study_progress_range_check" CHECK ("user_daily_study_progress"."article_start_order" >= 0 and "user_daily_study_progress"."article_end_order" >= "user_daily_study_progress"."article_start_order")
);
--> statement-breakpoint
ALTER TABLE "user_daily_study_progress" ADD CONSTRAINT "user_daily_study_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_daily_study_progress" ADD CONSTRAINT "user_daily_study_progress_legal_act_id_legal_acts_id_fk" FOREIGN KEY ("legal_act_id") REFERENCES "public"."legal_acts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_daily_study_progress_legal_act_idx" ON "user_daily_study_progress" USING btree ("legal_act_id");