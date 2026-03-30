-- eNPS / 表彰アンケートの回答を DELETE→INSERT を同一トランザクションで実行し、競合時のデータ欠損を防ぐ

CREATE OR REPLACE FUNCTION public.replace_enps_responses(
  p_survey_id uuid,
  p_rows jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_bad int;
  v_ok int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM enps_surveys s
    WHERE s.id = p_survey_id
      AND s.is_active = true
      AND s.start_date <= now()
      AND s.end_date >= now()
  ) THEN
    RAISE EXCEPTION 'survey not available';
  END IF;

  WITH parsed AS (
    SELECT
      (elem->>'question_id')::uuid AS qid,
      CASE
        WHEN elem ? 'score_value' AND jsonb_typeof(elem->'score_value') = 'number' THEN (elem->>'score_value')::integer
        ELSE NULL::integer
      END AS sv,
      NULLIF(trim(both from COALESCE(elem->>'text_value', '')), '') AS tv
    FROM jsonb_array_elements(COALESCE(p_rows, '[]'::jsonb)) AS elem
  )
  SELECT COUNT(*) INTO v_bad FROM parsed WHERE sv IS NOT NULL AND tv IS NOT NULL;

  IF v_bad > 0 THEN
    RAISE EXCEPTION 'invalid response: score and text both set';
  END IF;

  WITH parsed AS (
    SELECT
      (elem->>'question_id')::uuid AS qid,
      CASE
        WHEN elem ? 'score_value' AND jsonb_typeof(elem->'score_value') = 'number' THEN (elem->>'score_value')::integer
        ELSE NULL::integer
      END AS sv,
      NULLIF(trim(both from COALESCE(elem->>'text_value', '')), '') AS tv
    FROM jsonb_array_elements(COALESCE(p_rows, '[]'::jsonb)) AS elem
  ),
  ok_rows AS (
    SELECT *
    FROM parsed
    WHERE (sv IS NOT NULL AND tv IS NULL) OR (sv IS NULL AND tv IS NOT NULL)
  )
  SELECT COUNT(*) INTO v_ok FROM ok_rows;

  IF v_ok = 0 THEN
    RAISE EXCEPTION 'no valid responses';
  END IF;

  IF EXISTS (
    WITH parsed AS (
      SELECT
        (elem->>'question_id')::uuid AS qid,
        CASE
          WHEN elem ? 'score_value' AND jsonb_typeof(elem->'score_value') = 'number' THEN (elem->>'score_value')::integer
          ELSE NULL::integer
        END AS sv,
        NULLIF(trim(both from COALESCE(elem->>'text_value', '')), '') AS tv
      FROM jsonb_array_elements(COALESCE(p_rows, '[]'::jsonb)) AS elem
    ),
    ok_rows AS (
      SELECT *
      FROM parsed
      WHERE (sv IS NOT NULL AND tv IS NULL) OR (sv IS NULL AND tv IS NOT NULL)
    )
    SELECT 1
    FROM ok_rows o
    WHERE NOT EXISTS (
      SELECT 1 FROM enps_questions q WHERE q.id = o.qid AND q.is_active = true
    )
  ) THEN
    RAISE EXCEPTION 'invalid question';
  END IF;

  DELETE FROM enps_responses
  WHERE survey_id = p_survey_id AND user_id = v_uid;

  INSERT INTO enps_responses (survey_id, user_id, question_id, score_value, text_value)
  WITH parsed AS (
    SELECT
      (elem->>'question_id')::uuid AS qid,
      CASE
        WHEN elem ? 'score_value' AND jsonb_typeof(elem->'score_value') = 'number' THEN (elem->>'score_value')::integer
        ELSE NULL::integer
      END AS sv,
      NULLIF(trim(both from COALESCE(elem->>'text_value', '')), '') AS tv
    FROM jsonb_array_elements(COALESCE(p_rows, '[]'::jsonb)) AS elem
  ),
  ok_rows AS (
    SELECT *
    FROM parsed
    WHERE (sv IS NOT NULL AND tv IS NULL) OR (sv IS NULL AND tv IS NOT NULL)
  )
  SELECT p_survey_id, v_uid, o.qid, o.sv, o.tv FROM ok_rows o;
END;
$$;

COMMENT ON FUNCTION public.replace_enps_responses(uuid, jsonb) IS 'eNPS回答をトランザクションで置換（auth.uid() のみ）';

CREATE OR REPLACE FUNCTION public.replace_award_responses(
  p_survey_id uuid,
  p_rows jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_ok int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM award_surveys s
    WHERE s.id = p_survey_id
      AND s.is_active = true
      AND s.start_date <= now()
      AND s.end_date >= now()
  ) THEN
    RAISE EXCEPTION 'survey not available';
  END IF;

  WITH parsed AS (
    SELECT
      (elem->>'question_id')::uuid AS qid,
      NULLIF(trim(both from COALESCE(elem->>'text_value', '')), '') AS tv
    FROM jsonb_array_elements(COALESCE(p_rows, '[]'::jsonb)) AS elem
  ),
  ok_rows AS (SELECT * FROM parsed WHERE tv IS NOT NULL)
  SELECT COUNT(*) INTO v_ok FROM ok_rows;

  IF v_ok = 0 THEN
    RAISE EXCEPTION 'no valid responses';
  END IF;

  IF EXISTS (
    WITH parsed AS (
      SELECT
        (elem->>'question_id')::uuid AS qid,
        NULLIF(trim(both from COALESCE(elem->>'text_value', '')), '') AS tv
      FROM jsonb_array_elements(COALESCE(p_rows, '[]'::jsonb)) AS elem
    ),
    ok_rows AS (SELECT * FROM parsed WHERE tv IS NOT NULL)
    SELECT 1
    FROM ok_rows o
    WHERE NOT EXISTS (
      SELECT 1 FROM award_questions q WHERE q.id = o.qid AND q.is_active = true
    )
  ) THEN
    RAISE EXCEPTION 'invalid question';
  END IF;

  DELETE FROM award_responses
  WHERE survey_id = p_survey_id AND user_id = v_uid;

  INSERT INTO award_responses (survey_id, user_id, question_id, text_value)
  WITH parsed AS (
    SELECT
      (elem->>'question_id')::uuid AS qid,
      NULLIF(trim(both from COALESCE(elem->>'text_value', '')), '') AS tv
    FROM jsonb_array_elements(COALESCE(p_rows, '[]'::jsonb)) AS elem
  ),
  ok_rows AS (SELECT * FROM parsed WHERE tv IS NOT NULL)
  SELECT p_survey_id, v_uid, o.qid, o.tv FROM ok_rows o;
END;
$$;

COMMENT ON FUNCTION public.replace_award_responses(uuid, jsonb) IS '表彰アンケート回答をトランザクションで置換（auth.uid() のみ）';

GRANT EXECUTE ON FUNCTION public.replace_enps_responses(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.replace_award_responses(uuid, jsonb) TO authenticated;
