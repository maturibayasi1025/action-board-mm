-- missionsテーブルに経営者のみがINSERT/UPDATE/DELETEできるRLSポリシーを追加
-- 経営者の判定は環境変数で管理されるため、RLSポリシーではservice_roleのみに許可
-- 実際の経営者チェックはアプリケーション層で行う

-- 既存のSELECTポリシーは維持（全ユーザーが閲覧可能）

-- INSERTポリシー: service_roleのみ許可（経営者はアプリケーション層でチェック）
CREATE POLICY "service_role_can_insert_missions"
  ON public.missions FOR INSERT
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- UPDATEポリシー: service_roleのみ許可（経営者はアプリケーション層でチェック）
CREATE POLICY "service_role_can_update_missions"
  ON public.missions FOR UPDATE
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- DELETEポリシー: service_roleのみ許可（経営者はアプリケーション層でチェック）
CREATE POLICY "service_role_can_delete_missions"
  ON public.missions FOR DELETE
  USING (auth.role() = 'service_role');

