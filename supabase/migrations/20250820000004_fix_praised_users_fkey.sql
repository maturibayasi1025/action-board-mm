-- praised_user_idの外部キー制約を修正してprivate_usersを参照するようにする

-- 既存の外部キー制約を削除
ALTER TABLE public.user_mission_praised_users
DROP CONSTRAINT IF EXISTS user_mission_praised_users_praised_user_id_fkey;

-- private_usersテーブルを参照する新しい外部キー制約を追加
ALTER TABLE public.user_mission_praised_users
ADD CONSTRAINT user_mission_praised_users_praised_user_id_fkey
FOREIGN KEY (praised_user_id) REFERENCES public.private_users(id) ON DELETE CASCADE;