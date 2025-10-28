-- 古いRLSポリシーを削除してポリシー競合を解消
-- private_usersテーブルに対する古いポリシー（20250510122416で作成）を削除
-- 新しいポリシー（20250820000003で作成）のみを使用

-- 古いRLSポリシーを削除
DROP POLICY IF EXISTS "insert_own_user" ON public.private_users;
DROP POLICY IF EXISTS "select_own_user" ON public.private_users;
DROP POLICY IF EXISTS "update_own_user" ON public.private_users;

-- 新しいポリシーが正しく存在することを確認
-- （20250820000003で既に作成済みのため、確認のみ）
-- 1. "authenticated_users_can_view_basic_info" - SELECT用
-- 2. "users_can_manage_own_data" - ALL操作用

-- コメント追加（ドキュメント目的）
COMMENT ON POLICY "authenticated_users_can_view_basic_info" ON public.private_users IS 
'認証されたユーザーは他のユーザーの基本情報（id, name）を閲覧可能。Edge Runtime環境でも動作する。';

COMMENT ON POLICY "users_can_manage_own_data" ON public.private_users IS 
'ユーザーは自分自身のデータに対して全ての操作（SELECT, INSERT, UPDATE, DELETE）が可能。auth.uid()で本人確認。';

