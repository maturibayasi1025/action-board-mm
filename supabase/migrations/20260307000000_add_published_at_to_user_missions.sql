-- published_at: 公開日時（承認済みになった瞬間の日時）
-- created_at は下書き作成日時のまま、日次判定は published_at を基準にする
ALTER TABLE public.user_missions
ADD COLUMN IF NOT EXISTS published_at timestamp with time zone;

-- 既存の承認済みデータを backfill: approved_at を published_at にコピー
UPDATE public.user_missions
SET published_at = approved_at
WHERE status = 'approved' AND approved_at IS NOT NULL AND published_at IS NULL;

-- 日次検索用インデックス（published_at 基準のクエリを高速化）
CREATE INDEX IF NOT EXISTS idx_user_missions_published_at
ON public.user_missions(published_at DESC)
WHERE status = 'approved';

COMMENT ON COLUMN public.user_missions.published_at IS '公開日時（承認済みになった瞬間）。1日1グッジョブ判定・共有グッジョブ解放の基準に使用。';
