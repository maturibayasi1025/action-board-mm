-- ユーザー作成グッジョブテーブル
CREATE TABLE IF NOT EXISTS public.user_missions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  content text NOT NULL,
  praised_person_name text NOT NULL, -- 賞賛に値する人名
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  rejection_reason text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  approved_at timestamp with time zone,
  approved_by uuid REFERENCES auth.users(id),
  -- 公開グッジョブに昇格した場合のリンク
  public_mission_id uuid REFERENCES public.missions(id),
  -- いいね数（キャッシュ用）
  likes_count integer DEFAULT 0 NOT NULL
);

-- MVV項目テーブル
CREATE TABLE IF NOT EXISTS public.user_mission_mvv_items (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_mission_id uuid NOT NULL REFERENCES public.user_missions(id) ON DELETE CASCADE,
  mvv_type text NOT NULL CHECK (mvv_type IN ('passionate_execution', 'supreme_relationships', 'happiness_circulation')),
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(user_mission_id, mvv_type)
);

-- いいねテーブル
CREATE TABLE IF NOT EXISTS public.user_mission_likes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_mission_id uuid NOT NULL REFERENCES public.user_missions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(user_mission_id, user_id)
);

-- インデックス
CREATE INDEX idx_user_missions_created_by ON public.user_missions(created_by);
CREATE INDEX idx_user_missions_status ON public.user_missions(status);
CREATE INDEX idx_user_missions_created_at ON public.user_missions(created_at DESC);
CREATE INDEX idx_user_mission_mvv_items_mission ON public.user_mission_mvv_items(user_mission_id);
CREATE INDEX idx_user_mission_likes_mission ON public.user_mission_likes(user_mission_id);
CREATE INDEX idx_user_mission_likes_user ON public.user_mission_likes(user_id);

-- RLSポリシー: user_missions
ALTER TABLE public.user_missions ENABLE ROW LEVEL SECURITY;

-- 全てのユーザーが承認済みグッジョブを閲覧可能
CREATE POLICY "approved_missions_are_viewable_by_everyone" ON public.user_missions
  FOR SELECT USING (status = 'approved');

-- ユーザーは自分が作成したグッジョブを閲覧可能
CREATE POLICY "users_can_view_own_missions" ON public.user_missions
  FOR SELECT USING (auth.uid() = created_by);

-- ユーザーは新しいグッジョブを作成可能
CREATE POLICY "users_can_create_missions" ON public.user_missions
  FOR INSERT WITH CHECK (auth.uid() = created_by AND status = 'pending');

-- ユーザーは自分のpendingグッジョブを更新可能
CREATE POLICY "users_can_update_own_pending_missions" ON public.user_missions
  FOR UPDATE USING (auth.uid() = created_by AND status = 'pending')
  WITH CHECK (auth.uid() = created_by AND status = 'pending');

-- ユーザーは自分のpendingグッジョブを削除可能
CREATE POLICY "users_can_delete_own_pending_missions" ON public.user_missions
  FOR DELETE USING (auth.uid() = created_by AND status = 'pending');

-- RLSポリシー: user_mission_mvv_items
ALTER TABLE public.user_mission_mvv_items ENABLE ROW LEVEL SECURITY;

-- MVV項目は関連するグッジョブが閲覧可能な場合に閲覧可能
CREATE POLICY "mvv_items_viewable_with_mission" ON public.user_mission_mvv_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_missions
      WHERE user_missions.id = user_mission_mvv_items.user_mission_id
      AND (status = 'approved' OR created_by = auth.uid())
    )
  );

-- グッジョブ作成者はMVV項目を作成可能
CREATE POLICY "mission_creator_can_create_mvv_items" ON public.user_mission_mvv_items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_missions
      WHERE user_missions.id = user_mission_mvv_items.user_mission_id
      AND created_by = auth.uid()
      AND status = 'pending'
    )
  );

-- グッジョブ作成者はMVV項目を削除可能
CREATE POLICY "mission_creator_can_delete_mvv_items" ON public.user_mission_mvv_items
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.user_missions
      WHERE user_missions.id = user_mission_mvv_items.user_mission_id
      AND created_by = auth.uid()
      AND status = 'pending'
    )
  );

-- RLSポリシー: user_mission_likes
ALTER TABLE public.user_mission_likes ENABLE ROW LEVEL SECURITY;

-- 承認済みグッジョブのいいねは誰でも閲覧可能
CREATE POLICY "likes_viewable_for_approved_missions" ON public.user_mission_likes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_missions
      WHERE user_missions.id = user_mission_likes.user_mission_id
      AND status = 'approved'
    )
  );

-- ユーザーは承認済みグッジョブにいいね可能
CREATE POLICY "users_can_like_approved_missions" ON public.user_mission_likes
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM public.user_missions
      WHERE user_missions.id = user_mission_likes.user_mission_id
      AND status = 'approved'
      AND created_by != auth.uid()
    )
  );

-- ユーザーは自分のいいねを削除可能
CREATE POLICY "users_can_unlike" ON public.user_mission_likes
  FOR DELETE USING (auth.uid() = user_id);

-- いいね数を更新するトリガー関数
CREATE OR REPLACE FUNCTION update_user_mission_likes_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.user_missions
    SET likes_count = likes_count + 1
    WHERE id = NEW.user_mission_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.user_missions
    SET likes_count = likes_count - 1
    WHERE id = OLD.user_mission_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- いいね数更新トリガー
CREATE TRIGGER update_likes_count_on_like
AFTER INSERT OR DELETE ON public.user_mission_likes
FOR EACH ROW EXECUTE FUNCTION update_user_mission_likes_count();

-- updated_atを自動更新するトリガー
CREATE TRIGGER update_user_missions_updated_at
BEFORE UPDATE ON public.user_missions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();