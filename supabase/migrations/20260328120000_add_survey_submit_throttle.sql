-- アンケート回答送信のレート制限用メタ（サーバーアクションが upsert する）

CREATE TABLE survey_submit_throttle (
    survey_id UUID NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    last_submitted_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (survey_id, user_id)
);

COMMENT ON TABLE survey_submit_throttle IS 'アンケート回答の最終送信時刻（eNPS/表彰で survey_id を共有しない前提の単純な PK）';
COMMENT ON COLUMN survey_submit_throttle.survey_id IS 'アンケートID（enps_surveys または award_surveys）';
COMMENT ON COLUMN survey_submit_throttle.user_id IS 'ユーザーID';
COMMENT ON COLUMN survey_submit_throttle.last_submitted_at IS '最終送信成功時刻';

CREATE INDEX idx_survey_submit_throttle_user_id ON survey_submit_throttle(user_id);

ALTER TABLE survey_submit_throttle ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select their own survey submit throttle rows"
    ON survey_submit_throttle FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own survey submit throttle rows"
    ON survey_submit_throttle FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own survey submit throttle rows"
    ON survey_submit_throttle FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
