ALTER TABLE "questions" DROP CONSTRAINT "questions_previous_exam_provenance_check";--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_previous_exam_provenance_check" CHECK ("questions"."quiz_mode" <> 'previous_exam' or (
        nullif(btrim("questions"."source_title"), '') is not null
        and nullif(btrim("questions"."source_url"), '') is not null
        and nullif(btrim("questions"."source_rights_holder"), '') is not null
        and nullif(btrim("questions"."license_basis"), '') is not null
        and nullif(btrim("questions"."license_reference"), '') is not null
        and nullif(btrim("questions"."original_question_number"), '') is not null
        and "questions"."original_question_order" is not null
        and "questions"."original_question_order" > 0
        and "questions"."licensed_at" is not null
      ));