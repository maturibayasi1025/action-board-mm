-- 未回答者一覧・Slack リマインドから除外するユーザーを全アンケート共通で保持する

CREATE TABLE public.unanswered_survey_global_exclusions (
    user_id UUID NOT NULL PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.unanswered_survey_global_exclusions IS 'アンケート未回答の催促対象から除外するユーザー（グローバル）。回答の可否や集計には影響しない。';

COMMENT ON COLUMN public.unanswered_survey_global_exclusions.user_id IS '除外するユーザーID';
COMMENT ON COLUMN public.unanswered_survey_global_exclusions.created_at IS '除外設定日時(UTC)';

ALTER TABLE public.unanswered_survey_global_exclusions ENABLE ROW LEVEL SECURITY;
