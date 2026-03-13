-- いいね可能期間を公開日から7日間に制限
DROP POLICY IF EXISTS "users_can_like_approved_missions" ON public.user_mission_likes;
CREATE POLICY "users_can_like_approved_missions" ON public.user_mission_likes
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.user_missions
      WHERE user_missions.id = user_mission_likes.user_mission_id
        AND status = 'approved'
        AND created_by != auth.uid()
        AND (
          published_at IS NULL
          OR published_at >= NOW() - INTERVAL '7 days'
        )
    )
  );

DROP POLICY IF EXISTS "users_can_unlike" ON public.user_mission_likes;
CREATE POLICY "users_can_unlike" ON public.user_mission_likes
  FOR DELETE USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.user_missions
      WHERE user_missions.id = user_mission_likes.user_mission_id
        AND (
          published_at IS NULL
          OR published_at >= NOW() - INTERVAL '7 days'
        )
    )
  );
