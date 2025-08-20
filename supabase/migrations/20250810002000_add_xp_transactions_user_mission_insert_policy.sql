-- ユーザーグッジョブ関連のXPトランザクション挿入を許可するポリシーを追加
CREATE POLICY "Users can insert user mission XP transactions"
    ON xp_transactions FOR INSERT
    WITH CHECK (
      auth.uid() = user_id AND 
      source_type IN ('USER_MISSION_LIKE_GIVEN', 'USER_MISSION_LIKES')
    );

-- コメントを追加
COMMENT ON POLICY "Users can insert user mission XP transactions" ON xp_transactions
IS 'ユーザーは自分のユーザーグッジョブ関連のXPトランザクション（いいね付与・受取）を挿入可能';