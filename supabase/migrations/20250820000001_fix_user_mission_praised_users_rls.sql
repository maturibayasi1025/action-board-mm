-- 既存のRLSポリシーを削除
DROP POLICY IF EXISTS "mission_creator_can_add_praised_users" ON public.user_mission_praised_users;
DROP POLICY IF EXISTS "mission_creator_can_delete_praised_users" ON public.user_mission_praised_users;

-- 修正版：グッジョブ作成者は賞賛対象者を追加可能（承認状態を問わず）
CREATE POLICY "mission_creator_can_add_praised_users" ON public.user_mission_praised_users
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_missions
      WHERE user_missions.id = user_mission_praised_users.user_mission_id
      AND created_by = auth.uid()
    )
  );

-- 修正版：グッジョブ作成者は賞賛対象者を削除可能（承認状態を問わず）
CREATE POLICY "mission_creator_can_delete_praised_users" ON public.user_mission_praised_users
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.user_missions
      WHERE user_missions.id = user_mission_praised_users.user_mission_id
      AND created_by = auth.uid()
    )
  );