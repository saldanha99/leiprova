-- Avanço de fase pelas datas oficiais já revisadas (28/09/2026).
-- Sem esta exceção, um edital revisado ficava parado em "inscrições abertas"
-- depois do último dia de inscrição e sumia do catálogo público. A trava segue
-- bloqueando qualquer outra mudança material, inclusive outras trocas de fase.
CREATE OR REPLACE FUNCTION "prevent_reviewed_contest_opportunity_mutation"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  sao_paulo_today date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  date_driven_advance boolean;
BEGIN
  IF OLD."editorial_status" = 'reviewed'
    AND NEW."editorial_status" = 'reviewed'
    AND (
      NEW."category_id" IS DISTINCT FROM OLD."category_id"
      OR NEW."career_track_id" IS DISTINCT FROM OLD."career_track_id"
      OR NEW."specialization_id" IS DISTINCT FROM OLD."specialization_id"
      OR NEW."jurisdiction_code" IS DISTINCT FROM OLD."jurisdiction_code"
      OR NEW."scope" IS DISTINCT FROM OLD."scope"
      OR NEW."cycle_year" IS DISTINCT FROM OLD."cycle_year"
      OR NEW."institution_acronym" IS DISTINCT FROM OLD."institution_acronym"
      OR NEW."institution_name" IS DISTINCT FROM OLD."institution_name"
      OR NEW."role_name" IS DISTINCT FROM OLD."role_name"
      OR NEW."official_notice_number" IS DISTINCT FROM OLD."official_notice_number"
      OR NEW."title" IS DISTINCT FROM OLD."title"
      OR NEW."summary" IS DISTINCT FROM OLD."summary"
      OR NEW."official_url" IS DISTINCT FROM OLD."official_url"
      OR NEW."announced_at" IS DISTINCT FROM OLD."announced_at"
      OR NEW."notice_published_at" IS DISTINCT FROM OLD."notice_published_at"
      OR NEW."registration_starts_at" IS DISTINCT FROM OLD."registration_starts_at"
      OR NEW."registration_ends_at" IS DISTINCT FROM OLD."registration_ends_at"
      OR NEW."exam_date" IS DISTINCT FROM OLD."exam_date"
      OR NEW."source_checked_at" IS DISTINCT FROM OLD."source_checked_at"
      OR NEW."reviewed_by_user_id" IS DISTINCT FROM OLD."reviewed_by_user_id"
      OR NEW."reviewed_at" IS DISTINCT FROM OLD."reviewed_at"
    ) THEN
      RAISE EXCEPTION 'Alterações materiais exigem retornar a oportunidade para revisão.'
        USING ERRCODE = '23514';
  END IF;

  IF OLD."editorial_status" = 'reviewed'
    AND NEW."editorial_status" = 'reviewed'
    AND (
      NEW."lifecycle_status" IS DISTINCT FROM OLD."lifecycle_status"
      OR NEW."status_as_of" IS DISTINCT FROM OLD."status_as_of"
    ) THEN
    -- Datas nulas nunca autorizam o avanço: COALESCE fecha o caso em falso.
    date_driven_advance := COALESCE(
      NEW."status_as_of" = sao_paulo_today
      AND OLD."status_as_of" <= sao_paulo_today
      AND (
        (
          OLD."lifecycle_status" = 'registration_open'
          AND NEW."lifecycle_status" = 'registration_closed'
          AND OLD."registration_ends_at" < sao_paulo_today
        )
        OR (
          OLD."lifecycle_status" IN (
            'notice_published',
            'registration_open',
            'registration_closed',
            'exam_scheduled'
          )
          AND NEW."lifecycle_status" = 'exam_held'
          AND OLD."exam_date" < sao_paulo_today
        )
      ),
      false
    );
    IF NOT date_driven_advance THEN
      RAISE EXCEPTION 'Alterações materiais exigem retornar a oportunidade para revisão.'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
