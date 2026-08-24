ALTER TABLE "questions" DROP CONSTRAINT "questions_mode_relations_check";--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_original_responsibility_check" CHECK ("questions"."quiz_mode" <> 'original_style'
        or "questions"."editorial_status" = 'draft'
        or (
          "questions"."created_by_user_id" is not null
          and "questions"."clean_room_attested_at" is not null
        ));--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_mode_relations_check" CHECK ((
        "questions"."quiz_mode" = 'dry_law'
        and "questions"."legal_article_id" is not null
        and "questions"."exam_edition_id" is null
        and "questions"."style_bank_id" is null
      ) or (
        "questions"."quiz_mode" = 'original_style'
        and "questions"."legal_article_id" is not null
        and "questions"."subject_id" is not null
        and "questions"."exam_edition_id" is null
        and "questions"."style_bank_id" is not null
        and "questions"."source_rights" = 'original_authorial'
        and nullif(btrim("questions"."learning_objective"), '') is not null
      ) or (
        "questions"."quiz_mode" = 'previous_exam'
        and "questions"."subject_id" is not null
        and "questions"."exam_edition_id" is not null
        and "questions"."style_bank_id" is null
        and "questions"."source_rights" = 'licensed'
      ));