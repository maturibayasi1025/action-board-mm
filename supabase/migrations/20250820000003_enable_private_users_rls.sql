-- private_usersテーブルのRLSを有効にし、適切なポリシーを設定

-- RLSを有効にする
ALTER TABLE public.private_users ENABLE ROW LEVEL SECURITY;

-- 既存のポリシーがある場合は削除
DROP POLICY IF EXISTS "authenticated_users_can_view_basic_info" ON public.private_users;
DROP POLICY IF EXISTS "users_can_manage_own_data" ON public.private_users;

-- 認証されたユーザーは他のユーザーの基本情報（id, name）を閲覧可能
CREATE POLICY "authenticated_users_can_view_basic_info" ON public.private_users
  FOR SELECT 
  USING (auth.role() = 'authenticated');

-- 自分のデータは完全にアクセス可能
CREATE POLICY "users_can_manage_own_data" ON public.private_users
  FOR ALL
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);