ALTER TABLE "questions" DROP CONSTRAINT "questions_previous_exam_provenance_check";--> statement-breakpoint
ALTER TABLE "quiz_session_answers" DROP CONSTRAINT "quiz_session_answers_session_id_quiz_sessions_id_fk";
--> statement-breakpoint
ALTER TABLE "quiz_session_answers" DROP CONSTRAINT "quiz_session_answers_question_id_questions_id_fk";
--> statement-breakpoint
ALTER TABLE "quiz_session_answers" DROP CONSTRAINT "quiz_session_answers_selected_option_id_question_options_id_fk";
--> statement-breakpoint
ALTER TABLE "exam_editions" ADD COLUMN "duration_minutes" integer;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "original_question_order" integer;--> statement-breakpoint
CREATE UNIQUE INDEX "question_options_id_question_uidx" ON "question_options" USING btree ("id","question_id");--> statement-breakpoint
ALTER TABLE "quiz_session_answers" ADD CONSTRAINT "quiz_session_answers_session_question_fk" FOREIGN KEY ("session_id","question_id") REFERENCES "public"."quiz_session_questions"("session_id","question_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_session_answers" ADD CONSTRAINT "quiz_session_answers_option_question_fk" FOREIGN KEY ("selected_option_id","question_id") REFERENCES "public"."question_options"("id","question_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "questions_exam_original_order_uidx" ON "questions" USING btree ("exam_edition_id","original_question_order") WHERE "questions"."exam_edition_id" is not null and "questions"."original_question_order" is not null;--> statement-breakpoint
ALTER TABLE "exam_editions" ADD CONSTRAINT "exam_editions_duration_check" CHECK ("exam_editions"."duration_minutes" is null or "exam_editions"."duration_minutes" > 0);--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_previous_exam_provenance_check" CHECK ("questions"."quiz_mode" <> 'previous_exam' or (
        nullif(btrim("questions"."source_title"), '') is not null
        and nullif(btrim("questions"."source_url"), '') is not null
        and nullif(btrim("questions"."source_rights_holder"), '') is not null
        and nullif(btrim("questions"."license_basis"), '') is not null
        and nullif(btrim("questions"."license_reference"), '') is not null
        and nullif(btrim("questions"."original_question_number"), '') is not null
        and "questions"."original_question_order" > 0
        and "questions"."licensed_at" is not null
      ));
