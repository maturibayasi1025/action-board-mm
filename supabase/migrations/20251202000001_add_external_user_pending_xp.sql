-- 外部ユーザー用ポイント保留テーブルを作成
CREATE TABLE IF NOT EXISTS public.external_user_pending_xp (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  external_user_name text NOT NULL,
  user_mission_id uuid NOT NULL REFERENCES public.user_missions(id) ON DELETE CASCADE,
  xp_amount integer NOT NULL,
  source_type text NOT NULL DEFAULT 'USER_MISSION_PRAISED_EXTERNAL',
  description text,
  claimed_at timestamp with time zone,
  claimed_by_user_id uuid REFERENCES auth.users(id),
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- インデックスを追加
CREATE INDEX idx_external_user_pending_xp_name ON public.external_user_pending_xp(external_user_name);
CREATE INDEX idx_external_user_pending_xp_mission ON public.external_user_pending_xp(user_mission_id);
CREATE INDEX idx_external_user_pending_xp_claimed ON public.external_user_pending_xp(claimed_at);
CREATE INDEX idx_external_user_pending_xp_user ON public.external_user_pending_xp(claimed_by_user_id);

-- RLSポリシー: external_user_pending_xp
ALTER TABLE public.external_user_pending_xp ENABLE ROW LEVEL SECURITY;

-- 未付与のポイントは誰でも閲覧可能（ユーザー登録時に検索するため）
CREATE POLICY "unclaimed_pending_xp_viewable" ON public.external_user_pending_xp
  FOR SELECT USING (claimed_at IS NULL);

-- ユーザーは自分の名前で検索可能
CREATE POLICY "users_can_view_own_pending_xp" ON public.external_user_pending_xp
  FOR SELECT USING (
    claimed_by_user_id = auth.uid() OR claimed_at IS NULL
  );

-- システムのみが挿入可能（グッジョブ作成時に自動挿入）
CREATE POLICY "system_can_insert_pending_xp" ON public.external_user_pending_xp
  FOR INSERT WITH CHECK (false);

-- ユーザーは自分の名前の保留ポイントを付与済みに更新可能
CREATE POLICY "users_can_claim_own_pending_xp" ON public.external_user_pending_xp
  FOR UPDATE USING (
    claimed_at IS NULL
    AND external_user_name IN (
      SELECT name FROM public.private_users WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    claimed_by_user_id = auth.uid()
    AND claimed_at IS NOT NULL
  );

-- xp_transactionsのsource_type制約を更新してUSER_MISSION_PRAISED_EXTERNALを追加
ALTER TABLE public.xp_transactions 
DROP CONSTRAINT IF EXISTS xp_transactions_source_type_check;

ALTER TABLE public.xp_transactions 
ADD CONSTRAINT xp_transactions_source_type_check 
CHECK (source_type IN (
  'MISSION_COMPLETION', 
  'BONUS', 
  'PENALTY', 
  'MISSION_CANCELLATION', 
  'USER_MISSION_LIKES', 
  'USER_MISSION_LIKE_GIVEN',
  'USER_MISSION_CREATION',
  'USER_MISSION_PRAISED',
  'USER_MISSION_PRAISED_EXTERNAL'
));

-- コメントを追加
COMMENT ON TABLE public.external_user_pending_xp IS '外部ユーザー用の保留ポイント（登録後に付与される）';
COMMENT ON COLUMN public.external_user_pending_xp.external_user_name IS '外部ユーザーの名前（登録時に名前で検索）';
COMMENT ON COLUMN public.external_user_pending_xp.claimed_at IS 'ポイントが付与された日時（NULLの場合は未付与）';
COMMENT ON COLUMN public.external_user_pending_xp.claimed_by_user_id IS 'ポイントを受け取ったユーザーID';

