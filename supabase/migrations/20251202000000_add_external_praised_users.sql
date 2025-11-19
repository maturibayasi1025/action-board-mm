-- 外部ユーザー表彰用テーブルを作成
CREATE TABLE IF NOT EXISTS public.user_mission_praised_external_users (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_mission_id uuid NOT NULL REFERENCES public.user_missions(id) ON DELETE CASCADE,
  praised_person_name text NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(user_mission_id, praised_person_name)
);

-- インデックスを追加
CREATE INDEX idx_user_mission_praised_external_users_mission ON public.user_mission_praised_external_users(user_mission_id);
CREATE INDEX idx_user_mission_praised_external_users_name ON public.user_mission_praised_external_users(praised_person_name);

-- RLSポリシー: user_mission_praised_external_users
ALTER TABLE public.user_mission_praised_external_users ENABLE ROW LEVEL SECURITY;

-- 賞賛対象者は関連するグッジョブが閲覧可能な場合に閲覧可能
CREATE POLICY "external_praised_users_viewable_with_mission" ON public.user_mission_praised_external_users
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_missions
      WHERE user_missions.id = user_mission_praised_external_users.user_mission_id
      AND (status = 'approved' OR created_by = auth.uid())
    )
  );

-- グッジョブ作成者は賞賛対象者を追加可能
CREATE POLICY "mission_creator_can_add_external_praised_users" ON public.user_mission_praised_external_users
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_missions
      WHERE user_missions.id = user_mission_praised_external_users.user_mission_id
      AND created_by = auth.uid()
      AND status = 'pending'
    )
  );

-- グッジョブ作成者は賞賛対象者を削除可能
CREATE POLICY "mission_creator_can_delete_external_praised_users" ON public.user_mission_praised_external_users
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.user_missions
      WHERE user_missions.id = user_mission_praised_external_users.user_mission_id
      AND created_by = auth.uid()
      AND status = 'pending'
    )
  );

-- コメントを追加
COMMENT ON TABLE public.user_mission_praised_external_users IS '登録されていない外部ユーザーの表彰情報';
COMMENT ON COLUMN public.user_mission_praised_external_users.praised_person_name IS '外部ユーザーの名前';

