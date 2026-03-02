-- eNPSアンケート機能のためのテーブル作成

-- アンケート定義テーブル
CREATE TABLE enps_surveys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    year_month TEXT NOT NULL UNIQUE, -- 対象年月（例：2026-01）
    start_date TIMESTAMPTZ NOT NULL,
    end_date TIMESTAMPTZ NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    slack_notified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE enps_surveys IS 'eNPSアンケート定義';
COMMENT ON COLUMN enps_surveys.id IS 'アンケートID';
COMMENT ON COLUMN enps_surveys.title IS 'アンケートタイトル（例：月次NPSアンケート / 2026年1月度）';
COMMENT ON COLUMN enps_surveys.description IS 'アンケート説明文';
COMMENT ON COLUMN enps_surveys.year_month IS '対象年月（例：2026-01）UNIQUE制約';
COMMENT ON COLUMN enps_surveys.start_date IS '回答開始日時';
COMMENT ON COLUMN enps_surveys.end_date IS '回答終了日時';
COMMENT ON COLUMN enps_surveys.is_active IS '有効フラグ';
COMMENT ON COLUMN enps_surveys.slack_notified_at IS 'Slack通知日時';
COMMENT ON COLUMN enps_surveys.created_at IS '作成日時(UTC)';
COMMENT ON COLUMN enps_surveys.updated_at IS '更新日時(UTC)';

-- 質問定義テーブル（カスタマイズ可能）
CREATE TABLE enps_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_text TEXT NOT NULL,
    question_type TEXT NOT NULL CHECK (question_type IN ('score_0_10', 'text')),
    display_order INTEGER NOT NULL DEFAULT 0,
    is_required BOOLEAN NOT NULL DEFAULT true,
    is_active BOOLEAN NOT NULL DEFAULT true,
    parent_question_id UUID REFERENCES enps_questions(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE enps_questions IS 'eNPSアンケートの質問定義（カスタマイズ可能）';
COMMENT ON COLUMN enps_questions.id IS '質問ID';
COMMENT ON COLUMN enps_questions.question_text IS '質問文';
COMMENT ON COLUMN enps_questions.question_type IS '質問タイプ（score_0_10: 0-10点スコア、text: テキスト入力）';
COMMENT ON COLUMN enps_questions.display_order IS '表示順序';
COMMENT ON COLUMN enps_questions.is_required IS '必須フラグ';
COMMENT ON COLUMN enps_questions.is_active IS '有効フラグ';
COMMENT ON COLUMN enps_questions.parent_question_id IS '親質問ID（理由質問用）';
COMMENT ON COLUMN enps_questions.created_at IS '作成日時(UTC)';
COMMENT ON COLUMN enps_questions.updated_at IS '更新日時(UTC)';

-- 回答テーブル
CREATE TABLE enps_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    survey_id UUID NOT NULL REFERENCES enps_surveys(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES enps_questions(id) ON DELETE CASCADE,
    score_value INTEGER CHECK (score_value >= 0 AND score_value <= 10),
    text_value TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT enps_responses_score_or_text CHECK (
        (score_value IS NOT NULL AND text_value IS NULL) OR
        (score_value IS NULL AND text_value IS NOT NULL)
    ),
    UNIQUE(survey_id, user_id, question_id)
);

COMMENT ON TABLE enps_responses IS 'eNPSアンケート回答';
COMMENT ON COLUMN enps_responses.id IS '回答ID';
COMMENT ON COLUMN enps_responses.survey_id IS 'アンケートID';
COMMENT ON COLUMN enps_responses.user_id IS '回答者ID';
COMMENT ON COLUMN enps_responses.question_id IS '質問ID';
COMMENT ON COLUMN enps_responses.score_value IS 'スコア回答（0-10）';
COMMENT ON COLUMN enps_responses.text_value IS 'テキスト回答';
COMMENT ON COLUMN enps_responses.created_at IS '回答日時(UTC)';
COMMENT ON COLUMN enps_responses.updated_at IS '更新日時(UTC)';

-- インデックス作成
CREATE INDEX idx_enps_surveys_year_month ON enps_surveys(year_month);
CREATE INDEX idx_enps_surveys_is_active ON enps_surveys(is_active);
CREATE INDEX idx_enps_questions_display_order ON enps_questions(display_order);
CREATE INDEX idx_enps_questions_is_active ON enps_questions(is_active);
CREATE INDEX idx_enps_questions_parent_question_id ON enps_questions(parent_question_id);
CREATE INDEX idx_enps_responses_survey_id ON enps_responses(survey_id);
CREATE INDEX idx_enps_responses_user_id ON enps_responses(user_id);
CREATE INDEX idx_enps_responses_question_id ON enps_responses(question_id);
CREATE INDEX idx_enps_responses_survey_user ON enps_responses(survey_id, user_id);

-- updated_at自動更新トリガー関数（既存の関数があれば使用、なければ作成）
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- updated_at自動更新トリガー
CREATE TRIGGER update_enps_surveys_updated_at
    BEFORE UPDATE ON enps_surveys
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_enps_questions_updated_at
    BEFORE UPDATE ON enps_questions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_enps_responses_updated_at
    BEFORE UPDATE ON enps_responses
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- RLS設定

-- enps_surveys: 全ユーザーが有効なアンケートを読み取り可能、管理者のみ作成・更新可能
ALTER TABLE enps_surveys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active surveys"
    ON enps_surveys FOR SELECT
    USING (is_active = true);

-- enps_questions: 全ユーザーが有効な質問を読み取り可能、管理者のみ作成・更新可能
ALTER TABLE enps_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active questions"
    ON enps_questions FOR SELECT
    USING (is_active = true);

-- enps_responses: ユーザーは自分の回答のみ閲覧・作成・更新可能
ALTER TABLE enps_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own responses"
    ON enps_responses FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own responses"
    ON enps_responses FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own responses"
    ON enps_responses FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
