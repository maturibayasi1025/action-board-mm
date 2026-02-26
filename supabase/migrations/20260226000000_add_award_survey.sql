-- 表彰アンケート機能のためのテーブル作成

-- アンケート定義テーブル
CREATE TABLE award_surveys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    year_month TEXT NOT NULL UNIQUE, -- 対象年月（例：2026-02）
    period_number INTEGER NOT NULL,  -- 期（例：11）2025年4月=1期として計算
    start_date TIMESTAMPTZ NOT NULL,
    end_date TIMESTAMPTZ NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    slack_notified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE award_surveys IS '表彰アンケート定義';
COMMENT ON COLUMN award_surveys.id IS 'アンケートID';
COMMENT ON COLUMN award_surveys.title IS 'アンケートタイトル（例：【表彰アンケート】11期／2026年02月度）';
COMMENT ON COLUMN award_surveys.description IS 'アンケート説明文';
COMMENT ON COLUMN award_surveys.year_month IS '対象年月（例：2026-02）UNIQUE制約';
COMMENT ON COLUMN award_surveys.period_number IS '期数（2025年4月=1期）';
COMMENT ON COLUMN award_surveys.start_date IS '回答開始日時';
COMMENT ON COLUMN award_surveys.end_date IS '回答終了日時';
COMMENT ON COLUMN award_surveys.is_active IS '有効フラグ';
COMMENT ON COLUMN award_surveys.slack_notified_at IS 'Slack通知日時';

-- 質問定義テーブル
CREATE TABLE award_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_text TEXT NOT NULL,
    question_type TEXT NOT NULL CHECK (question_type IN ('text', 'textarea')),
    question_group TEXT NOT NULL CHECK (question_group IN (
        'passionate_execution',
        'supreme_relations',
        'happiness_cycle',
        'team_value'
    )),
    display_order INTEGER NOT NULL DEFAULT 0,
    is_required BOOLEAN NOT NULL DEFAULT true,
    is_active BOOLEAN NOT NULL DEFAULT true,
    placeholder TEXT,  -- 例文（（例）○○のお客さまを...）
    help_text TEXT,    -- キーワードヒント（キーワード＝"幸せの追求"...）
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE award_questions IS '表彰アンケートの質問定義';
COMMENT ON COLUMN award_questions.id IS '質問ID';
COMMENT ON COLUMN award_questions.question_text IS '質問文';
COMMENT ON COLUMN award_questions.question_type IS '質問タイプ（text: 短文入力、textarea: 長文入力）';
COMMENT ON COLUMN award_questions.question_group IS '質問グループ（バリュー別セクション）';
COMMENT ON COLUMN award_questions.display_order IS '表示順序';
COMMENT ON COLUMN award_questions.is_required IS '必須フラグ';
COMMENT ON COLUMN award_questions.is_active IS '有効フラグ';
COMMENT ON COLUMN award_questions.placeholder IS 'プレースホルダー（例文）';
COMMENT ON COLUMN award_questions.help_text IS '補足説明（キーワードヒントなど）';

-- 回答テーブル
CREATE TABLE award_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    survey_id UUID NOT NULL REFERENCES award_surveys(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES award_questions(id) ON DELETE CASCADE,
    text_value TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(survey_id, user_id, question_id)
);

COMMENT ON TABLE award_responses IS '表彰アンケート回答';
COMMENT ON COLUMN award_responses.id IS '回答ID';
COMMENT ON COLUMN award_responses.survey_id IS 'アンケートID';
COMMENT ON COLUMN award_responses.user_id IS '回答者ID';
COMMENT ON COLUMN award_responses.question_id IS '質問ID';
COMMENT ON COLUMN award_responses.text_value IS 'テキスト回答';

-- インデックス作成
CREATE INDEX idx_award_surveys_year_month ON award_surveys(year_month);
CREATE INDEX idx_award_surveys_is_active ON award_surveys(is_active);
CREATE INDEX idx_award_questions_display_order ON award_questions(display_order);
CREATE INDEX idx_award_questions_is_active ON award_questions(is_active);
CREATE INDEX idx_award_questions_question_group ON award_questions(question_group);
CREATE INDEX idx_award_responses_survey_id ON award_responses(survey_id);
CREATE INDEX idx_award_responses_user_id ON award_responses(user_id);
CREATE INDEX idx_award_responses_question_id ON award_responses(question_id);
CREATE INDEX idx_award_responses_survey_user ON award_responses(survey_id, user_id);

-- updated_at自動更新トリガー（既存の update_updated_at_column 関数を再利用）
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_award_surveys_updated_at
    BEFORE UPDATE ON award_surveys
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_award_questions_updated_at
    BEFORE UPDATE ON award_questions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_award_responses_updated_at
    BEFORE UPDATE ON award_responses
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- RLS設定

-- award_surveys: 全ユーザーが有効なアンケートを読み取り可能
ALTER TABLE award_surveys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active award surveys"
    ON award_surveys FOR SELECT
    USING (is_active = true);

-- award_questions: 全ユーザーが有効な質問を読み取り可能
ALTER TABLE award_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active award questions"
    ON award_questions FOR SELECT
    USING (is_active = true);

-- award_responses: ユーザーは自分の回答のみ閲覧・作成・更新・削除可能
ALTER TABLE award_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own award responses"
    ON award_responses FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own award responses"
    ON award_responses FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own award responses"
    ON award_responses FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own award responses"
    ON award_responses FOR DELETE
    USING (auth.uid() = user_id);
