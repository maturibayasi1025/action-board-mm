-- private_usersテーブルにRLSポリシーを追加
-- 認証されたユーザーが他のユーザーの基本情報（id, name）を読み取れるポリシー

-- 既存のポリシーがある場合は削除
DROP POLICY IF EXISTS "authenticated_users_can_view_basic_info" ON public.private_users;

-- 認証されたユーザーは他のユーザーの基本情報を閲覧可能
CREATE POLICY "authenticated_users_can_view_basic_info" ON public.private_users
  FOR SELECT 
  USING (auth.role() = 'authenticated');

-- 自分のデータは完全にアクセス可能（既存ポリシーがない場合のため）
DROP POLICY IF EXISTS "users_can_manage_own_data" ON public.private_users;
CREATE POLICY "users_can_manage_own_data" ON public.private_users
  FOR ALL
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);