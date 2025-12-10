-- user_missionsテーブルにimage_pathsカラム（JSONB型）を追加
-- 複数画像に対応するため配列形式で保存

ALTER TABLE public.user_missions
ADD COLUMN IF NOT EXISTS image_paths JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.user_missions.image_paths IS 'グッジョブに添付された画像のパス配列（Supabase Storage内のパス）';

-- 既存データのimage_pathsを空配列で初期化
UPDATE public.user_missions
SET image_paths = '[]'::jsonb
WHERE image_paths IS NULL;

-- image_pathsが配列であることを保証する制約を追加
ALTER TABLE public.user_missions
ADD CONSTRAINT check_image_paths_is_array
CHECK (jsonb_typeof(image_paths) = 'array');

-- グッジョブ画像用のストレージバケットを作成
INSERT INTO storage.buckets (id, name)
VALUES (
  'user_mission_images',
  'user_mission_images'
) ON CONFLICT (id) DO NOTHING;

-- user_mission_images バケットのRLSポリシー
-- 認証ユーザーは、自身のuser_idをパスに含むオブジェクトのみ挿入可能
CREATE POLICY "Users can upload their own user mission images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'user_mission_images' AND
    (storage.foldername(name))[1] = auth.uid()::text -- パスの第一階層がuser_id
  );

-- 承認済みグッジョブの画像は誰でも参照可能（パブリック）
CREATE POLICY "Anyone can view approved user mission images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'user_mission_images');

-- 認証ユーザーは、自身のuser_idをパスに含むオブジェクトのみ更新可能
CREATE POLICY "Users can update their own user mission images"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'user_mission_images' AND
    (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'user_mission_images' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- 認証ユーザーは、自身のuser_idをパスに含むオブジェクトのみ削除可能
CREATE POLICY "Users can delete their own user mission images"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'user_mission_images' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

