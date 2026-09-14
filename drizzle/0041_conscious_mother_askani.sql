ALTER TABLE "exam_license_requests" ADD CONSTRAINT "exam_license_requests_independent_review_check" CHECK ("exam_license_requests"."status" not in ('granted_pending_review','granted','denied') or (
        "exam_license_requests"."reviewed_by_user_id" is not null
        and "exam_license_requests"."reviewed_by_user_id" <> "exam_license_requests"."initiated_by_user_id"
      ));