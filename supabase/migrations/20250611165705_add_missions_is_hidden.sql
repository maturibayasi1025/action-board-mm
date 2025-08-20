-- missionsテーブルに非表示フラグを追加
ALTER TABLE public.missions
ADD COLUMN is_hidden BOOLEAN NOT NULL DEFAULT false;

-- is_hiddenカラムにコメントを追加
COMMENT ON COLUMN missions.is_hidden IS 'グッジョブを非表示にするかどうかのフラグ。trueの場合、グッジョブ一覧に表示されない';