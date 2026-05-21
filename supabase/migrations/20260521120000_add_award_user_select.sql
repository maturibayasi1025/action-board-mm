-- 表彰アンケート: 他者指名を user_select（メンバー選択）に対応

-- question_type に user_select を追加
ALTER TABLE award_questions
  DROP CONSTRAINT IF EXISTS award_questions_question_type_check;

ALTER TABLE award_questions
  ADD CONSTRAINT award_questions_question_type_check
  CHECK (question_type IN ('text', 'textarea', 'user_select'));

COMMENT ON COLUMN award_questions.question_type IS
  '質問タイプ（text: 短文入力、textarea: 長文入力、user_select: メンバー選択）';

-- 指名回答用 user_id カラム
ALTER TABLE award_responses
  ADD COLUMN nominee_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN award_responses.nominee_user_id IS
  'user_select 設問で指名されたメンバーの user_id';

CREATE INDEX idx_award_responses_nominee_user_id
  ON award_responses(nominee_user_id)
  WHERE nominee_user_id IS NOT NULL;

-- 既存の他者指名3設問を user_select に更新
UPDATE award_questions
SET
  question_type = 'user_select',
  placeholder = NULL,
  help_text = 'リストからメンバーを選択してください'
WHERE id IN (
  'ae000001-0000-0000-0000-000000000002',
  'ae000002-0000-0000-0000-000000000002',
  'ae000003-0000-0000-0000-000000000002'
);

-- replace_award_responses: nominee_user_id 対応

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
      NULLIF(trim(both from COALESCE(elem->>'text_value', '')), '') AS tv,
      NULLIF(trim(both from COALESCE(elem->>'nominee_user_id', '')), '')::uuid AS nuid
    FROM jsonb_array_elements(COALESCE(p_rows, '[]'::jsonb)) AS elem
  ),
  ok_rows AS (
    SELECT *
    FROM parsed
    WHERE tv IS NOT NULL OR nuid IS NOT NULL
  )
  SELECT COUNT(*) INTO v_ok FROM ok_rows;

  IF v_ok = 0 THEN
    RAISE EXCEPTION 'no valid responses';
  END IF;

  -- 自己指名禁止
  IF EXISTS (
    WITH parsed AS (
      SELECT
        (elem->>'question_id')::uuid AS qid,
        NULLIF(trim(both from COALESCE(elem->>'nominee_user_id', '')), '')::uuid AS nuid
      FROM jsonb_array_elements(COALESCE(p_rows, '[]'::jsonb)) AS elem
    )
    SELECT 1 FROM parsed WHERE nuid = v_uid
  ) THEN
    RAISE EXCEPTION 'cannot nominate yourself';
  END IF;

  -- 設問タイプと回答形式の整合性
  IF EXISTS (
    WITH parsed AS (
      SELECT
        (elem->>'question_id')::uuid AS qid,
        NULLIF(trim(both from COALESCE(elem->>'text_value', '')), '') AS tv,
        NULLIF(trim(both from COALESCE(elem->>'nominee_user_id', '')), '')::uuid AS nuid
      FROM jsonb_array_elements(COALESCE(p_rows, '[]'::jsonb)) AS elem
    ),
    ok_rows AS (
      SELECT p.*, q.question_type AS qt
      FROM parsed p
      JOIN award_questions q ON q.id = p.qid AND q.is_active = true
      WHERE p.tv IS NOT NULL OR p.nuid IS NOT NULL
    )
    SELECT 1
    FROM ok_rows o
    WHERE (o.qt = 'user_select' AND o.nuid IS NULL)
       OR (o.qt IN ('text', 'textarea') AND o.tv IS NULL)
       OR (o.qt = 'user_select' AND o.tv IS NOT NULL)
  ) THEN
    RAISE EXCEPTION 'invalid response for question type';
  END IF;

  IF EXISTS (
    WITH parsed AS (
      SELECT
        (elem->>'question_id')::uuid AS qid,
        NULLIF(trim(both from COALESCE(elem->>'text_value', '')), '') AS tv,
        NULLIF(trim(both from COALESCE(elem->>'nominee_user_id', '')), '')::uuid AS nuid
      FROM jsonb_array_elements(COALESCE(p_rows, '[]'::jsonb)) AS elem
    ),
    ok_rows AS (
      SELECT * FROM parsed WHERE tv IS NOT NULL OR nuid IS NOT NULL
    )
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

  INSERT INTO award_responses (
    survey_id,
    user_id,
    question_id,
    text_value,
    nominee_user_id,
    is_late_submission
  )
  WITH parsed AS (
    SELECT
      (elem->>'question_id')::uuid AS qid,
      NULLIF(trim(both from COALESCE(elem->>'text_value', '')), '') AS tv,
      NULLIF(trim(both from COALESCE(elem->>'nominee_user_id', '')), '')::uuid AS nuid
    FROM jsonb_array_elements(COALESCE(p_rows, '[]'::jsonb)) AS elem
  ),
  ok_rows AS (
    SELECT * FROM parsed WHERE tv IS NOT NULL OR nuid IS NOT NULL
  )
  SELECT p_survey_id, v_uid, o.qid, o.tv, o.nuid, v_late FROM ok_rows o;

  IF p_grant_id IS NOT NULL AND v_grant_token_trim IS NOT NULL THEN
    UPDATE award_late_submission_grants
    SET used_at = now()
    WHERE id = p_grant_id AND survey_id = p_survey_id AND user_id = v_uid;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.replace_award_responses(uuid, jsonb, uuid, text) IS
  '表彰アンケート回答をトランザクションで置換（auth.uid() のみ）。user_select は nominee_user_id。任意で期限後付与トークン。';
