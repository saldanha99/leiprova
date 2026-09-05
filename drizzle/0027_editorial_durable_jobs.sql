CREATE TABLE "editorial_automation_jobs" (
	"job_key" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"subject_id" bigint NOT NULL,
	"input_hash" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"lease_token" text,
	"lease_expires_at" timestamp with time zone,
	"last_error_code" text,
	"result" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "editorial_jobs_kind_check" CHECK ("editorial_automation_jobs"."kind" in ('draft_generation', 'source_capture')),
	CONSTRAINT "editorial_jobs_hash_check" CHECK ("editorial_automation_jobs"."input_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "editorial_jobs_status_check" CHECK ("editorial_automation_jobs"."status" in ('pending', 'running', 'retry', 'succeeded', 'blocked', 'failed')),
	CONSTRAINT "editorial_jobs_attempts_check" CHECK ("editorial_automation_jobs"."attempts" between 0 and 5),
	CONSTRAINT "editorial_jobs_subject_check" CHECK ("editorial_automation_jobs"."subject_id" > 0),
	CONSTRAINT "editorial_jobs_lease_check" CHECK (
      ("editorial_automation_jobs"."status" = 'running' and "editorial_automation_jobs"."lease_token" is not null and "editorial_automation_jobs"."lease_expires_at" is not null)
      or ("editorial_automation_jobs"."status" <> 'running' and "editorial_automation_jobs"."lease_token" is null and "editorial_automation_jobs"."lease_expires_at" is null)
    )
);
--> statement-breakpoint
CREATE INDEX "editorial_jobs_due_idx" ON "editorial_automation_jobs" USING btree ("kind","status","next_attempt_at");