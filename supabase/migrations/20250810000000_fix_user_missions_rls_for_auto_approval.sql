-- 既存のINSERTポリシーを削除
DROP POLICY IF EXISTS "users_can_create_missions" ON public.user_missions;

-- 新しいINSERTポリシー：ユーザーは自分が作成者となるグッジョブを作成可能（statusに関わらず）
CREATE POLICY "users_can_create_missions" ON public.user_missions
  FOR INSERT WITH CHECK (auth.uid() = created_by);

-- 既存のUPDATEポリシーを削除
DROP POLICY IF EXISTS "users_can_update_own_pending_missions" ON public.user_missions;

-- 新しいUPDATEポリシー：自分のグッジョブを更新可能（管理者でない場合はpendingのみ）
CREATE POLICY "users_can_update_own_missions" ON public.user_missions
  FOR UPDATE USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

-- MVV項目のINSERTポリシーも修正
DROP POLICY IF EXISTS "mission_creator_can_create_mvv_items" ON public.user_mission_mvv_items;

-- グッジョブ作成者はMVV項目を作成可能（statusに関わらず）
CREATE POLICY "mission_creator_can_create_mvv_items" ON public.user_mission_mvv_items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_missions
      WHERE user_missions.id = user_mission_mvv_items.user_mission_id
      AND created_by = auth.uid()
    )
  );

-- MVV項目のDELETEポリシーも修正
DROP POLICY IF EXISTS "mission_creator_can_delete_mvv_items" ON public.user_mission_mvv_items;

-- グッジョブ作成者はMVV項目を削除可能
CREATE POLICY "mission_creator_can_delete_mvv_items" ON public.user_mission_mvv_items
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.user_missions
      WHERE user_missions.id = user_mission_mvv_items.user_mission_id
      AND created_by = auth.uid()
    )
  );