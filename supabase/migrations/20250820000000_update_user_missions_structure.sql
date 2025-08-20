-- 郵便番号カラムを削除
ALTER TABLE private_users DROP COLUMN IF EXISTS postcode;

-- praised_person_nameカラムを削除（複数選択対応のため）
ALTER TABLE user_missions DROP COLUMN IF EXISTS praised_person_name;

-- 賞賛対象者を管理する新しいテーブルを作成
CREATE TABLE IF NOT EXISTS public.user_mission_praised_users (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_mission_id uuid NOT NULL REFERENCES public.user_missions(id) ON DELETE CASCADE,
  praised_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(user_mission_id, praised_user_id)
);

-- インデックスを追加
CREATE INDEX idx_user_mission_praised_users_mission ON public.user_mission_praised_users(user_mission_id);
CREATE INDEX idx_user_mission_praised_users_user ON public.user_mission_praised_users(praised_user_id);

-- RLSポリシー: user_mission_praised_users
ALTER TABLE public.user_mission_praised_users ENABLE ROW LEVEL SECURITY;

-- 賞賛対象者は関連するグッジョブが閲覧可能な場合に閲覧可能
CREATE POLICY "praised_users_viewable_with_mission" ON public.user_mission_praised_users
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_missions
      WHERE user_missions.id = user_mission_praised_users.user_mission_id
      AND (status = 'approved' OR created_by = auth.uid())
    )
  );

-- グッジョブ作成者は賞賛対象者を追加可能
CREATE POLICY "mission_creator_can_add_praised_users" ON public.user_mission_praised_users
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_missions
      WHERE user_missions.id = user_mission_praised_users.user_mission_id
      AND created_by = auth.uid()
      AND status = 'pending'
    )
  );

-- グッジョブ作成者は賞賛対象者を削除可能
CREATE POLICY "mission_creator_can_delete_praised_users" ON public.user_mission_praised_users
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.user_missions
      WHERE user_missions.id = user_mission_praised_users.user_mission_id
      AND created_by = auth.uid()
      AND status = 'pending'
    )
  );

-- Slack通知設定テーブルを作成
CREATE TABLE IF NOT EXISTS public.slack_notifications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type text NOT NULL CHECK (event_type IN ('user_mission_created', 'user_mission_liked')),
  event_id uuid NOT NULL,
  payload jsonb NOT NULL,
  sent_at timestamp with time zone,
  error text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- インデックスを追加
CREATE INDEX idx_slack_notifications_event ON public.slack_notifications(event_type, event_id);
CREATE INDEX idx_slack_notifications_sent ON public.slack_notifications(sent_at);

-- RLSは無効（管理用テーブル）
ALTER TABLE public.slack_notifications ENABLE ROW LEVEL SECURITY;

-- システムのみがアクセス可能
CREATE POLICY "system_only" ON public.slack_notifications
  FOR ALL USING (false);