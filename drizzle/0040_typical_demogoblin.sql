CREATE TABLE "exam_license_requests" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "exam_license_requests_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"public_id" text NOT NULL,
	"exam_edition_id" bigint NOT NULL,
	"bank_id" bigint NOT NULL,
	"status" text DEFAULT 'prepared' NOT NULL,
	"recipient_emails" jsonb NOT NULL,
	"subject" text NOT NULL,
	"request_body" text NOT NULL,
	"scope_fingerprint" text NOT NULL,
	"requested_at" timestamp with time zone,
	"last_follow_up_at" timestamp with time zone,
	"next_follow_up_at" timestamp with time zone,
	"follow_up_count" smallint DEFAULT 0 NOT NULL,
	"last_provider_message_id" text,
	"response_reference" text,
	"response_checksum_sha256" text,
	"response_received_at" timestamp with time zone,
	"granted_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"initiated_by_user_id" bigint NOT NULL,
	"reviewed_by_user_id" bigint,
	"reviewed_at" timestamp with time zone,
	"review_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "exam_license_requests_public_id_unique" UNIQUE("public_id"),
	CONSTRAINT "exam_license_requests_public_id_check" CHECK ("exam_license_requests"."public_id" ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'),
	CONSTRAINT "exam_license_requests_status_check" CHECK ("exam_license_requests"."status" in ('prepared','awaiting_response','granted_pending_review','granted','denied','expired','manual_review','cancelled')),
	CONSTRAINT "exam_license_requests_recipients_check" CHECK (jsonb_typeof("exam_license_requests"."recipient_emails") = 'array'
        and jsonb_array_length("exam_license_requests"."recipient_emails") between 1 and 8),
	CONSTRAINT "exam_license_requests_text_check" CHECK (char_length(btrim("exam_license_requests"."subject")) between 10 and 300
        and char_length(btrim("exam_license_requests"."request_body")) between 200 and 12000),
	CONSTRAINT "exam_license_requests_fingerprint_check" CHECK ("exam_license_requests"."scope_fingerprint" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "exam_license_requests_follow_up_check" CHECK ("exam_license_requests"."follow_up_count" between 0 and 3
        and ("exam_license_requests"."requested_at" is not null or "exam_license_requests"."follow_up_count" = 0)
        and ("exam_license_requests"."last_follow_up_at" is null or "exam_license_requests"."requested_at" is not null)),
	CONSTRAINT "exam_license_requests_response_check" CHECK ((
        "exam_license_requests"."response_reference" is null
        and "exam_license_requests"."response_checksum_sha256" is null
        and "exam_license_requests"."response_received_at" is null
        and "exam_license_requests"."granted_at" is null
      ) or (
        nullif(btrim("exam_license_requests"."response_reference"), '') is not null
        and "exam_license_requests"."response_reference" ~* '^https://[a-z0-9.-]+(?:/|$)'
        and "exam_license_requests"."response_checksum_sha256" ~ '^[a-f0-9]{64}$'
        and "exam_license_requests"."response_received_at" is not null
      )),
	CONSTRAINT "exam_license_requests_decision_check" CHECK ("exam_license_requests"."status" not in ('granted_pending_review','granted','denied','expired') or (
        "exam_license_requests"."response_reference" is not null
        and "exam_license_requests"."response_checksum_sha256" is not null
        and "exam_license_requests"."response_received_at" is not null
        and "exam_license_requests"."reviewed_by_user_id" is not null
        and "exam_license_requests"."reviewed_at" is not null
        and nullif(btrim("exam_license_requests"."review_notes"), '') is not null
        and char_length(btrim("exam_license_requests"."review_notes")) between 20 and 2000
      )),
	CONSTRAINT "exam_license_requests_grant_check" CHECK ("exam_license_requests"."status" not in ('granted_pending_review','granted') or "exam_license_requests"."granted_at" is not null),
	CONSTRAINT "exam_license_requests_period_check" CHECK ("exam_license_requests"."expires_at" is null or (
        "exam_license_requests"."granted_at" is not null and "exam_license_requests"."expires_at" > "exam_license_requests"."granted_at"
      ))
);
--> statement-breakpoint
ALTER TABLE "exam_license_requests" ADD CONSTRAINT "exam_license_requests_exam_edition_id_exam_editions_id_fk" FOREIGN KEY ("exam_edition_id") REFERENCES "public"."exam_editions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_license_requests" ADD CONSTRAINT "exam_license_requests_bank_id_quiz_banks_id_fk" FOREIGN KEY ("bank_id") REFERENCES "public"."quiz_banks"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_license_requests" ADD CONSTRAINT "exam_license_requests_initiated_by_user_id_users_id_fk" FOREIGN KEY ("initiated_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_license_requests" ADD CONSTRAINT "exam_license_requests_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "exam_license_requests_edition_uidx" ON "exam_license_requests" USING btree ("exam_edition_id");--> statement-breakpoint
CREATE INDEX "exam_license_requests_due_idx" ON "exam_license_requests" USING btree ("next_follow_up_at","created_at") WHERE "exam_license_requests"."status" in ('prepared', 'awaiting_response');--> statement-breakpoint
CREATE INDEX "exam_license_requests_bank_status_idx" ON "exam_license_requests" USING btree ("bank_id","status");--> statement-breakpoint
CREATE INDEX "exam_license_requests_initiated_by_idx" ON "exam_license_requests" USING btree ("initiated_by_user_id");--> statement-breakpoint
CREATE INDEX "exam_license_requests_reviewed_by_idx" ON "exam_license_requests" USING btree ("reviewed_by_user_id");