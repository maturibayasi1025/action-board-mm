-- eNPS 会社別レポート: 月次集計スナップショットと自由記述のAI分析結果
--
-- 集計を締切後に確定保存する。所属（会社・事業部）は集計時点の値を文字列で凍結するため、
-- 異動があっても過去月のレポート数値は変化しない。

CREATE TABLE enps_monthly_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    survey_id UUID NOT NULL REFERENCES enps_surveys(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES enps_questions(id) ON DELETE CASCADE,
    scope TEXT NOT NULL CHECK (scope IN ('group', 'company', 'business_unit')),
    company_name TEXT NOT NULL,
    business_unit_name TEXT NOT NULL,
    target_count INTEGER NOT NULL,
    respondent_count INTEGER NOT NULL,
    promoters INTEGER NOT NULL,
    passives INTEGER NOT NULL,
    detractors INTEGER NOT NULL,
    nps_respondent_base INTEGER,
    nps_imputed_base INTEGER,
    computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT enps_monthly_snapshots_unique
        UNIQUE (survey_id, question_id, scope, company_name, business_unit_name),
    CONSTRAINT enps_monthly_snapshots_scope_names CHECK (
        (scope = 'group' AND company_name = '' AND business_unit_name = '')
        OR (scope = 'company' AND company_name <> '' AND business_unit_name = '')
        OR (scope = 'business_unit' AND company_name <> '')
    )
);

CREATE INDEX idx_enps_monthly_snapshots_survey ON enps_monthly_snapshots(survey_id);
CREATE INDEX idx_enps_monthly_snapshots_scope ON enps_monthly_snapshots(scope, company_name);
CREATE INDEX idx_enps_monthly_snapshots_question ON enps_monthly_snapshots(question_id, scope);

COMMENT ON TABLE enps_monthly_snapshots IS 'eNPS月次集計の確定スナップショット（会社別レポート用）';
COMMENT ON COLUMN enps_monthly_snapshots.scope IS '集計単位。group=グループ全体、company=会社全体、business_unit=事業部';
COMMENT ON COLUMN enps_monthly_snapshots.company_name IS '集計時点の会社名を凍結したもの（group スコープは空文字）';
COMMENT ON COLUMN enps_monthly_snapshots.business_unit_name IS '集計時点の事業部名を凍結したもの（group/company スコープは空文字）';
COMMENT ON COLUMN enps_monthly_snapshots.target_count IS '回答対象者数（グローバル除外を引いた母数）。回答率の分母';
COMMENT ON COLUMN enps_monthly_snapshots.respondent_count IS '実際にスコアを回答した人数。回答率の分子';
COMMENT ON COLUMN enps_monthly_snapshots.nps_respondent_base IS '回答者のみを母数とするNPS。回答者0人なら NULL';
COMMENT ON COLUMN enps_monthly_snapshots.nps_imputed_base IS '未回答を0点として補完したNPS。対象者0人なら NULL';

CREATE TABLE enps_report_ai_summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    survey_id UUID NOT NULL REFERENCES enps_surveys(id) ON DELETE CASCADE,
    company_name TEXT NOT NULL,
    model TEXT NOT NULL,
    payload JSONB NOT NULL,
    input_response_count INTEGER NOT NULL,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT enps_report_ai_summaries_unique UNIQUE (survey_id, company_name)
);

CREATE INDEX idx_enps_report_ai_summaries_survey ON enps_report_ai_summaries(survey_id);

COMMENT ON TABLE enps_report_ai_summaries IS 'eNPS自由記述のAI分析結果（テーマ分類・代表コメント・改善アクション案）';
COMMENT ON COLUMN enps_report_ai_summaries.company_name IS '対象の会社名。空文字はグループ全体';
COMMENT ON COLUMN enps_report_ai_summaries.input_response_count IS '要約の入力に使った自由記述の件数';

-- 管理レポートはサービスロール経由でのみ読むため、ポリシーは作成しない
ALTER TABLE enps_monthly_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE enps_report_ai_summaries ENABLE ROW LEVEL SECURITY;
