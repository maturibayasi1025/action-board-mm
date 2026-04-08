-- 表彰 / eNPS: 管理者承認つき期限後提出（付与テーブル + 回答に遅延フラグ + RPC 拡張）

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 付与（表彰）
CREATE TABLE award_late_submission_grants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    survey_id UUID NOT NULL REFERENCES award_surveys(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    CONSTRAINT award_late_grants_token_hash_unique UNIQUE (token_hash)
);

CREATE INDEX idx_award_late_grants_survey_user ON award_late_submission_grants(survey_id, user_id);
CREATE INDEX idx_award_late_grants_expires ON award_late_submission_grants(expires_at) WHERE used_at IS NULL;

COMMENT ON TABLE award_late_submission_grants IS '表彰アンケート期限後回答のワンタイム付与（監査用）';

-- 付与（eNPS）
CREATE TABLE enps_late_submission_grants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    survey_id UUID NOT NULL REFERENCES enps_surveys(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    CONSTRAINT enps_late_grants_token_hash_unique UNIQUE (token_hash)
);

CREATE INDEX idx_enps_late_grants_survey_user ON enps_late_submission_grants(survey_id, user_id);
CREATE INDEX idx_enps_late_grants_expires ON enps_late_submission_grants(expires_at) WHERE used_at IS NULL;

COMMENT ON TABLE enps_late_submission_grants IS 'eNPSアンケート期限後回答のワンタイム付与（監査用）';

ALTER TABLE award_responses
    ADD COLUMN is_late_submission BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN award_responses.is_late_submission IS '期限後（管理者承認付き）で提出された回答か';

ALTER TABLE enps_responses
    ADD COLUMN is_late_submission BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN enps_responses.is_late_submission IS '期限後（管理者承認付き）で提出された回答か';

ALTER TABLE award_late_submission_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE enps_late_submission_grants ENABLE ROW LEVEL SECURITY;

-- replace_enps_responses: 任意の遅延付与パラメータを追加（既存の2引数呼び出しはそのまま）

CREATE OR REPLACE FUNCTION public.replace_enps_responses(
  p_survey_id uuid,
  p_rows jsonb,
  p_grant_id uuid DEFAULT NULL,
  p_grant_token text DEFAULT NULL
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
  v_late boolean := false;
  v_grant_token_trim text;
  v_hash text;
  v_grant_row_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  v_grant_token_trim := NULLIF(trim(both from COALESCE(p_grant_token, '')), '');

  IF p_grant_id IS NULL AND v_grant_token_trim IS NULL THEN
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
    v_late := false;
  ELSIF p_grant_id IS NOT NULL AND v_grant_token_trim IS NOT NULL THEN
    v_late := true;
    v_hash := encode(digest(convert_to(v_grant_token_trim, 'UTF8'), 'sha256'), 'hex');

    IF EXISTS (
      SELECT 1 FROM enps_responses r
      WHERE r.survey_id = p_survey_id AND r.user_id = v_uid
    ) THEN
      RAISE EXCEPTION 'late grant not allowed: already responded';
    END IF;

    SELECT g.id INTO v_grant_row_id
    FROM enps_late_submission_grants g
    WHERE g.id = p_grant_id
      AND g.survey_id = p_survey_id
      AND g.user_id = v_uid
      AND g.token_hash = v_hash
      AND g.used_at IS NULL
      AND g.expires_at >= now()
    FOR UPDATE;

    IF v_grant_row_id IS NULL THEN
      RAISE EXCEPTION 'invalid late grant';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM enps_surveys s
      WHERE s.id = p_survey_id
        AND s.is_active = true
        AND s.start_date <= now()
        AND s.end_date < now()
    ) THEN
      RAISE EXCEPTION 'survey not available for late';
    END IF;
  ELSE
    RAISE EXCEPTION 'invalid grant parameters';
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

  INSERT INTO enps_responses (survey_id, user_id, question_id, score_value, text_value, is_late_submission)
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
  SELECT p_survey_id, v_uid, o.qid, o.sv, o.tv, v_late FROM ok_rows o;

  IF p_grant_id IS NOT NULL AND v_grant_token_trim IS NOT NULL THEN
    UPDATE enps_late_submission_grants
    SET used_at = now()
    WHERE id = p_grant_id AND survey_id = p_survey_id AND user_id = v_uid;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.replace_enps_responses(uuid, jsonb, uuid, text) IS 'eNPS回答をトランザクションで置換（auth.uid() のみ）。任意で期限後付与トークン。';

-- replace_award_responses

CREATE OR REPLACE FUNCTION public.replace_award_responses(
  p_survey_id uuid,
  p_rows jsonb,
  p_grant_id uuid DEFAULT NULL,
  p_grant_token text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_ok int;
  v_late boolean := false;
  v_grant_token_trim text;
  v_hash text;
  v_grant_row_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  v_grant_token_trim := NULLIF(trim(both from COALESCE(p_grant_token, '')), '');

  IF p_grant_id IS NULL AND v_grant_token_trim IS NULL THEN
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
    v_late := false;
  ELSIF p_grant_id IS NOT NULL AND v_grant_token_trim IS NOT NULL THEN
    v_late := true;
    v_hash := encode(digest(convert_to(v_grant_token_trim, 'UTF8'), 'sha256'), 'hex');

    IF EXISTS (
      SELECT 1 FROM award_responses r
      WHERE r.survey_id = p_survey_id AND r.user_id = v_uid
    ) THEN
      RAISE EXCEPTION 'late grant not allowed: already responded';
    END IF;

    SELECT g.id INTO v_grant_row_id
    FROM award_late_submission_grants g
    WHERE g.id = p_grant_id
      AND g.survey_id = p_survey_id
      AND g.user_id = v_uid
      AND g.token_hash = v_hash
      AND g.used_at IS NULL
      AND g.expires_at >= now()
    FOR UPDATE;

    IF v_grant_row_id IS NULL THEN
      RAISE EXCEPTION 'invalid late grant';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM award_surveys s
      WHERE s.id = p_survey_id
        AND s.is_active = true
        AND s.start_date <= now()
        AND s.end_date < now()
    ) THEN
      RAISE EXCEPTION 'survey not available for late';
    END IF;
  ELSE
    RAISE EXCEPTION 'invalid grant parameters';
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

  INSERT INTO award_responses (survey_id, user_id, question_id, text_value, is_late_submission)
  WITH parsed AS (
    SELECT
      (elem->>'question_id')::uuid AS qid,
      NULLIF(trim(both from COALESCE(elem->>'text_value', '')), '') AS tv
    FROM jsonb_array_elements(COALESCE(p_rows, '[]'::jsonb)) AS elem
  ),
  ok_rows AS (SELECT * FROM parsed WHERE tv IS NOT NULL)
  SELECT p_survey_id, v_uid, o.qid, o.tv, v_late FROM ok_rows o;

  IF p_grant_id IS NOT NULL AND v_grant_token_trim IS NOT NULL THEN
    UPDATE award_late_submission_grants
    SET used_at = now()
    WHERE id = p_grant_id AND survey_id = p_survey_id AND user_id = v_uid;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.replace_award_responses(uuid, jsonb, uuid, text) IS '表彰アンケート回答をトランザクションで置換（auth.uid() のみ）。任意で期限後付与トークン。';
