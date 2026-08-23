ALTER TABLE "stripe_connect_transfer_batches" DROP CONSTRAINT "stripe_connect_transfer_batches_checkout_attempt_id_unique";--> statement-breakpoint
ALTER TABLE "stripe_connect_split_rules" DROP CONSTRAINT "stripe_connect_split_rules_charge_model_check";--> statement-breakpoint
ALTER TABLE "stripe_connect_transfers" DROP CONSTRAINT "stripe_connect_transfers_batch_id_stripe_connect_transfer_batches_id_fk";
--> statement-breakpoint
ALTER TABLE "stripe_connect_transfers" DROP CONSTRAINT "stripe_connect_transfers_partner_id_stripe_connect_partners_id_fk";
--> statement-breakpoint
ALTER TABLE "stripe_connect_split_rules" ALTER COLUMN "charge_model" SET DEFAULT 'separate_charges_and_transfers';--> statement-breakpoint
ALTER TABLE "stripe_connect_transfer_batches" ALTER COLUMN "checkout_attempt_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "stripe_connect_transfer_batches" ADD COLUMN "source_event_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "stripe_connect_transfer_batches" ADD COLUMN "provider_invoice_id" text;--> statement-breakpoint
ALTER TABLE "stripe_connect_transfers" ADD COLUMN "rule_id" bigint NOT NULL;--> statement-breakpoint
ALTER TABLE "stripe_connect_transfer_batches" ADD CONSTRAINT "stripe_connect_transfer_batches_source_event_id_stripe_events_event_id_fk" FOREIGN KEY ("source_event_id") REFERENCES "public"."stripe_events"("event_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "stripe_connect_transfer_batches_identity_uidx" ON "stripe_connect_transfer_batches" USING btree ("id","rule_id","currency");--> statement-breakpoint
ALTER TABLE "stripe_connect_transfers" ADD CONSTRAINT "stripe_connect_transfers_batch_rule_currency_fk" FOREIGN KEY ("batch_id","rule_id","currency") REFERENCES "public"."stripe_connect_transfer_batches"("id","rule_id","currency") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stripe_connect_transfers" ADD CONSTRAINT "stripe_connect_transfers_rule_partner_fk" FOREIGN KEY ("rule_id","partner_id") REFERENCES "public"."stripe_connect_split_allocations"("rule_id","partner_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "stripe_connect_transfer_batches_checkout_attempt_idx" ON "stripe_connect_transfer_batches" USING btree ("checkout_attempt_id");--> statement-breakpoint
CREATE INDEX "stripe_connect_transfers_rule_partner_idx" ON "stripe_connect_transfers" USING btree ("rule_id","partner_id");--> statement-breakpoint
ALTER TABLE "stripe_connect_transfer_batches" ADD CONSTRAINT "stripe_connect_transfer_batches_source_event_id_unique" UNIQUE("source_event_id");--> statement-breakpoint
ALTER TABLE "stripe_connect_transfer_batches" ADD CONSTRAINT "stripe_connect_transfer_batches_provider_invoice_id_unique" UNIQUE("provider_invoice_id");--> statement-breakpoint
ALTER TABLE "stripe_connect_split_rules" ADD CONSTRAINT "stripe_connect_split_rules_charge_model_check" CHECK ("stripe_connect_split_rules"."charge_model" = 'separate_charges_and_transfers');--> statement-breakpoint
ALTER TABLE "stripe_connect_transfer_batches" ADD CONSTRAINT "stripe_connect_transfer_batches_provider_reference_check" CHECK ("stripe_connect_transfer_batches"."provider_payment_intent_id" is not null
        or "stripe_connect_transfer_batches"."provider_invoice_id" is not null
        or "stripe_connect_transfer_batches"."provider_charge_id" is not null);--> statement-breakpoint
CREATE FUNCTION "assert_stripe_connect_batch_balanced"("target_batch_id" text) RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  batch_status text;
  expected_amount integer;
  actual_amount bigint;
  transfer_count bigint;
  invalid_status_count bigint;
BEGIN
  SELECT status, partner_amount_cents
  INTO batch_status, expected_amount
  FROM stripe_connect_transfer_batches
  WHERE id = target_batch_id;

  IF NOT FOUND OR batch_status <> 'completed' THEN
    RETURN;
  END IF;

  SELECT
    COALESCE(SUM(amount_cents), 0),
    COUNT(*),
    COUNT(*) FILTER (WHERE status <> 'succeeded')
  INTO actual_amount, transfer_count, invalid_status_count
  FROM stripe_connect_transfers
  WHERE batch_id = target_batch_id;

  IF actual_amount <> expected_amount
    OR (expected_amount > 0 AND transfer_count = 0)
    OR invalid_status_count > 0 THEN
    RAISE EXCEPTION 'stripe connect batch % is not balanced', target_batch_id
      USING ERRCODE = '23514';
  END IF;
END;
$$;--> statement-breakpoint
CREATE FUNCTION "check_stripe_connect_batch_trigger"() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM assert_stripe_connect_batch_balanced(OLD.batch_id);
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.batch_id IS DISTINCT FROM NEW.batch_id THEN
    PERFORM assert_stripe_connect_batch_balanced(OLD.batch_id);
  END IF;

  PERFORM assert_stripe_connect_batch_balanced(NEW.batch_id);
  RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE FUNCTION "check_stripe_connect_batch_row_trigger"() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM assert_stripe_connect_batch_balanced(
    CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END
  );
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE CONSTRAINT TRIGGER "stripe_connect_transfers_balance_trigger"
AFTER INSERT OR UPDATE OR DELETE ON "stripe_connect_transfers"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "check_stripe_connect_batch_trigger"();--> statement-breakpoint
CREATE CONSTRAINT TRIGGER "stripe_connect_batches_balance_trigger"
AFTER INSERT OR UPDATE OR DELETE ON "stripe_connect_transfer_batches"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "check_stripe_connect_batch_row_trigger"();
