-- xp_transactionsのsource_type制約を更新してUSER_MISSION_LIKESを追加
ALTER TABLE public.xp_transactions 
DROP CONSTRAINT IF EXISTS xp_transactions_source_type_check;

ALTER TABLE public.xp_transactions 
ADD CONSTRAINT xp_transactions_source_type_check 
CHECK (source_type IN ('MISSION_COMPLETION', 'BONUS', 'PENALTY', 'MISSION_CANCELLATION', 'USER_MISSION_LIKES'));