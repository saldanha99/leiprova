ALTER TABLE "opportunity_document_snapshots" DROP CONSTRAINT "opportunity_document_snapshots_independent_review_check";--> statement-breakpoint
ALTER TABLE "opportunity_document_snapshots" ADD COLUMN "approval_basis" text DEFAULT 'independent_review' NOT NULL;--> statement-breakpoint
ALTER TABLE "opportunity_document_snapshots" ADD CONSTRAINT "opportunity_document_snapshots_approval_basis_check" CHECK ("opportunity_document_snapshots"."approval_basis" in ('independent_review', 'owner_override'));--> statement-breakpoint
ALTER TABLE "opportunity_document_snapshots" ADD CONSTRAINT "opportunity_document_snapshots_independent_review_check" CHECK ("opportunity_document_snapshots"."status" <> 'approved'
        or "opportunity_document_snapshots"."initiated_by_user_id" is null
        or "opportunity_document_snapshots"."reviewed_by_user_id" <> "opportunity_document_snapshots"."initiated_by_user_id"
        or ("opportunity_document_snapshots"."approval_basis" = 'owner_override'
          and "opportunity_document_snapshots"."authorization_scope" = 'owner-approval-2026-09-01'
          and "opportunity_document_snapshots"."authorized_by_user_id" is not null
          and "opportunity_document_snapshots"."authorized_by_user_id" = "opportunity_document_snapshots"."reviewed_by_user_id"));