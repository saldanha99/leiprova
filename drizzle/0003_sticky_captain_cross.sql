CREATE TABLE "rate_limit_counters" (
	"scope" text NOT NULL,
	"subject_hash" text NOT NULL,
	"window_started_at" timestamp with time zone NOT NULL,
	"request_count" integer DEFAULT 1 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rate_limit_counters_pkey" PRIMARY KEY("scope","subject_hash","window_started_at"),
	CONSTRAINT "rate_limit_counters_scope_check" CHECK (char_length("rate_limit_counters"."scope") between 1 and 80),
	CONSTRAINT "rate_limit_counters_subject_hash_check" CHECK ("rate_limit_counters"."subject_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "rate_limit_counters_count_check" CHECK ("rate_limit_counters"."request_count" > 0),
	CONSTRAINT "rate_limit_counters_expiry_check" CHECK ("rate_limit_counters"."expires_at" > "rate_limit_counters"."window_started_at")
);
--> statement-breakpoint
CREATE INDEX "rate_limit_counters_expires_at_idx" ON "rate_limit_counters" USING btree ("expires_at");