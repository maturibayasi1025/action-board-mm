-- missionsテーブルに重要グッジョブ関連のカラムを追加

-- 重要グッジョブフラグ
ALTER TABLE public.missions
ADD COLUMN is_important BOOLEAN NOT NULL DEFAULT false;

-- 表示開始日時（NULL可）
ALTER TABLE public.missions
ADD COLUMN important_display_start_date TIMESTAMPTZ;

-- 表示終了日時（NULL可）
ALTER TABLE public.missions
ADD COLUMN important_display_end_date TIMESTAMPTZ;

-- カラムにコメントを追加
COMMENT ON COLUMN missions.is_important IS '重要グッジョブかどうかのフラグ。trueの場合、重要グッジョブとして表示される';
COMMENT ON COLUMN missions.important_display_start_date IS '重要グッジョブの表示開始日時。NULLの場合は常に表示される';
COMMENT ON COLUMN missions.important_display_end_date IS '重要グッジョブの表示終了日時。NULLの場合は常に表示される';

-- インデックスを追加（重要グッジョブの検索を高速化）
CREATE INDEX idx_missions_is_important ON public.missions(is_important) WHERE is_important = true;
CREATE INDEX idx_missions_important_dates ON public.missions(important_display_start_date, important_display_end_date) WHERE is_important = true;

-- 期間設定のバリデーション（開始日 < 終了日）
ALTER TABLE public.missions
ADD CONSTRAINT check_important_dates_validity
CHECK (
  (important_display_start_date IS NULL AND important_display_end_date IS NULL) OR
  (important_display_start_date IS NULL) OR
  (important_display_end_date IS NULL) OR
  (important_display_start_date <= important_display_end_date)
);

