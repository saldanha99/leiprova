ALTER TABLE "quiz_sessions" DROP CONSTRAINT "quiz_sessions_exam_edition_check";--> statement-breakpoint
ALTER TABLE "quiz_sessions" ADD CONSTRAINT "quiz_sessions_exam_edition_check" CHECK (
  "exam_edition_id" is null or (
    "exam_scope" = 'latest'
    and (
      "path" = 'career'
      or ("path" = 'bank' and "mode" = 'previous_exam')
    )
  )
);--> statement-breakpoint
ALTER TABLE "exam_editions" ADD COLUMN "source_external_id" text;--> statement-breakpoint
CREATE UNIQUE INDEX "quiz_career_specializations_id_career_uidx" ON "quiz_career_specializations" USING btree ("id","career_track_id");--> statement-breakpoint
ALTER TABLE "exam_editions" DROP CONSTRAINT "exam_editions_specialization_id_quiz_career_specializations_id_fk";
--> statement-breakpoint
ALTER TABLE "exam_editions" ADD CONSTRAINT "exam_editions_specialization_career_fk" FOREIGN KEY ("specialization_id","career_track_id") REFERENCES "public"."quiz_career_specializations"("id","career_track_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "exam_editions_bank_source_external_uidx" ON "exam_editions" USING btree ("bank_id","source_external_id") WHERE "exam_editions"."source_external_id" is not null;--> statement-breakpoint
ALTER TABLE "exam_editions" ADD CONSTRAINT "exam_editions_source_external_id_check" CHECK ("exam_editions"."source_external_id" is null or char_length(btrim("exam_editions"."source_external_id")) > 0);--> statement-breakpoint
ALTER TABLE "exam_editions" ADD CONSTRAINT "exam_editions_eligible_source_check" CHECK (
  "status" not in ('held', 'published') or (
    "official_url" is not null
    and char_length(btrim("official_url")) > 0
    and "source_checked_at" is not null
  )
);--> statement-breakpoint
CREATE OR REPLACE FUNCTION "prevent_non_draft_exam_edition_metadata_update"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD."status" <> 'draft' AND (
    NEW."title" IS DISTINCT FROM OLD."title"
    OR NEW."organizer" IS DISTINCT FROM OLD."organizer"
    OR NEW."jurisdiction" IS DISTINCT FROM OLD."jurisdiction"
    OR NEW."official_url" IS DISTINCT FROM OLD."official_url"
    OR NEW."exam_date" IS DISTINCT FROM OLD."exam_date"
    OR NEW."duration_minutes" IS DISTINCT FROM OLD."duration_minutes"
  ) THEN
    RAISE EXCEPTION 'Metadados públicos de uma edição não draft exigem nova revisão.'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER "exam_editions_non_draft_metadata_guard"
BEFORE UPDATE ON "exam_editions"
FOR EACH ROW
EXECUTE FUNCTION "prevent_non_draft_exam_edition_metadata_update"();
