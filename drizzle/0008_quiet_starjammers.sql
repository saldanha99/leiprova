ALTER TABLE "quiz_sessions" ADD COLUMN "deadline_at" timestamp with time zone;--> statement-breakpoint
UPDATE "quiz_sessions"
SET "deadline_at" = least(
  "started_at" + ("requested_count" * interval '90 seconds'),
  "expires_at"
)
WHERE "timed" = true AND "deadline_at" IS NULL;--> statement-breakpoint
ALTER TABLE "quiz_sessions" ADD CONSTRAINT "quiz_sessions_deadline_check" CHECK (("quiz_sessions"."timed" and "quiz_sessions"."deadline_at" is not null
        and "quiz_sessions"."deadline_at" > "quiz_sessions"."started_at"
        and "quiz_sessions"."deadline_at" <= "quiz_sessions"."expires_at")
        or (not "quiz_sessions"."timed" and "quiz_sessions"."deadline_at" is null));
