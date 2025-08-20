-- xp_transactionsのsource_type制約を更新してUSER_MISSION_CREATIONとUSER_MISSION_PRAISEDを追加
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
  'USER_MISSION_PRAISED'
));

-- ユーザーグッジョブ作成・賞賛関連のXPトランザクション挿入を許可するポリシーを追加
CREATE POLICY "Users can insert user mission creation XP transactions"
ON xp_transactions FOR INSERT
WITH CHECK (
  auth.uid() = user_id AND 
  source_type IN ('USER_MISSION_CREATION', 'USER_MISSION_PRAISED')
);

-- コメントを追加
COMMENT ON POLICY "Users can insert user mission creation XP transactions" ON xp_transactions
IS 'ユーザーは自分のユーザーグッジョブ作成・賞賛関連のXPトランザクションを挿入可能';

-- 制約のコメントを更新
COMMENT ON CONSTRAINT xp_transactions_source_type_check ON xp_transactions IS 
'MISSION_COMPLETION: グッジョブ達成時のXP付与, 
BONUS: ボーナスXP付与, 
PENALTY: 罰則によるXP減算, 
MISSION_CANCELLATION: グッジョブ提出取り消しによるXP減算,
USER_MISSION_LIKES: ユーザーグッジョブのいいね獲得,
USER_MISSION_LIKE_GIVEN: ユーザーグッジョブへのいいね付与,
USER_MISSION_CREATION: ユーザーグッジョブ作成,
USER_MISSION_PRAISED: ユーザーグッジョブで賞賛される';

-- 貢献者へのポイント付与を許可するポリシー
CREATE POLICY "Allow praised user XP transactions"
ON xp_transactions FOR INSERT
WITH CHECK (
  source_type = 'USER_MISSION_PRAISED' AND
  EXISTS (
    SELECT 1 FROM user_mission_praised_users ump
    JOIN user_missions um ON um.id = ump.user_mission_id
    WHERE ump.praised_user_id = xp_transactions.user_id
    AND um.created_by = auth.uid()
  )
);
