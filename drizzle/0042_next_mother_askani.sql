ALTER TABLE "contest_opportunities" DROP CONSTRAINT "contest_opportunities_independent_review_check";--> statement-breakpoint
ALTER TABLE "contest_product_exam_references" DROP CONSTRAINT "contest_product_exam_references_independent_review_check";--> statement-breakpoint
ALTER TABLE "exam_edition_documents" DROP CONSTRAINT "exam_edition_documents_independent_review_check";--> statement-breakpoint
ALTER TABLE "exam_license_requests" DROP CONSTRAINT "exam_license_requests_independent_review_check";--> statement-breakpoint
ALTER TABLE "opportunity_analysis_snapshots" DROP CONSTRAINT "opportunity_analysis_snapshots_independent_review_check";--> statement-breakpoint
ALTER TABLE "opportunity_document_snapshots" DROP CONSTRAINT "opportunity_document_snapshots_independent_review_check";--> statement-breakpoint
ALTER TABLE "questions" DROP CONSTRAINT "questions_previous_exam_independent_review_check";--> statement-breakpoint
ALTER TABLE "contest_product_exam_references" ADD CONSTRAINT "contest_product_exam_references_initiator_check" CHECK ("contest_product_exam_references"."status" <> 'approved' or "contest_product_exam_references"."initiated_by_user_id" is not null);--> statement-breakpoint
ALTER TABLE "exam_edition_documents" ADD CONSTRAINT "exam_edition_documents_initiator_check" CHECK ("exam_edition_documents"."status" <> 'approved' or "exam_edition_documents"."initiated_by_user_id" is not null);--> statement-breakpoint
ALTER TABLE "exam_license_requests" ADD CONSTRAINT "exam_license_requests_reviewer_check" CHECK ("exam_license_requests"."status" not in ('granted_pending_review','granted','denied')
        or "exam_license_requests"."reviewed_by_user_id" is not null);--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_previous_exam_review_check" CHECK ("questions"."quiz_mode" <> 'previous_exam'
        or "questions"."editorial_status" <> 'reviewed'
        or (
          "questions"."created_by_user_id" is not null
          and "questions"."reviewed_by_user_id" is not null
          and "questions"."submitted_at" is not null
          and nullif(btrim("questions"."review_notes"), '') is not null
          and char_length(btrim("questions"."review_notes")) between 20 and 1500
        ));