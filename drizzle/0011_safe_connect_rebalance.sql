CREATE OR REPLACE FUNCTION "check_stripe_connect_batch_trigger"() RETURNS trigger
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
$$;
