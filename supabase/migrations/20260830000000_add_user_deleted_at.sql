-- 管理画面のユーザー削除を物理削除からソフト削除へ切り替える。
-- auth.admin.deleteUser は likes_count トリガーや RESTRICT FK で失敗しやすく、
-- 成功しても投稿グッジョブが CASCADE で消えるため、deleted_at で退会扱いにする。

ALTER TABLE public.private_users
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE public.public_user_profiles
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

COMMENT ON COLUMN public.private_users.deleted_at IS 'ソフト削除日時。NULL なら在籍中';
COMMENT ON COLUMN public.public_user_profiles.deleted_at IS 'ソフト削除日時（private_users から同期）';

CREATE INDEX IF NOT EXISTS private_users_deleted_at_idx
  ON public.private_users (deleted_at);

CREATE INDEX IF NOT EXISTS public_user_profiles_deleted_at_idx
  ON public.public_user_profiles (deleted_at);

CREATE OR REPLACE FUNCTION public.sync_public_user_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM set_config('my.is_trigger', 'true', true);

  INSERT INTO public.public_user_profiles (
    id,
    name,
    address_prefecture,
    x_username,
    avatar_url,
    created_at,
    business_unit_id,
    deleted_at
  )
  VALUES (
    NEW.id,
    NEW.name,
    NEW.address_prefecture,
    NEW.x_username,
    NEW.avatar_url,
    NEW.created_at,
    NEW.business_unit_id,
    NEW.deleted_at
  )
  ON CONFLICT (id) DO UPDATE
  SET
    name = EXCLUDED.name,
    address_prefecture = EXCLUDED.address_prefecture,
    x_username = EXCLUDED.x_username,
    avatar_url = EXCLUDED.avatar_url,
    created_at = EXCLUDED.created_at,
    business_unit_id = EXCLUDED.business_unit_id,
    deleted_at = EXCLUDED.deleted_at;

  PERFORM set_config('my.is_trigger', 'false', true);
  RETURN NEW;
END;
$$;

-- Auth ユーザー削除時に likes CASCADE で発火しても権限不足で失敗しないようにする
CREATE OR REPLACE FUNCTION public.update_user_mission_likes_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.user_missions
    SET likes_count = likes_count + 1
    WHERE id = NEW.user_mission_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.user_missions
    SET likes_count = likes_count - 1
    WHERE id = OLD.user_mission_id;
  END IF;
  RETURN NULL;
END;
$$;

-- 残っている NO ACTION FK を SET NULL にして、万一の物理削除でも先に止まりにくくする
ALTER TABLE public.user_missions
  DROP CONSTRAINT IF EXISTS user_missions_approved_by_fkey;
ALTER TABLE public.user_missions
  ADD CONSTRAINT user_missions_approved_by_fkey
  FOREIGN KEY (approved_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.external_user_pending_xp
  DROP CONSTRAINT IF EXISTS external_user_pending_xp_claimed_by_user_id_fkey;
ALTER TABLE public.external_user_pending_xp
  ADD CONSTRAINT external_user_pending_xp_claimed_by_user_id_fkey
  FOREIGN KEY (claimed_by_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE OR REPLACE VIEW public.user_ranking_view AS
SELECT
    ul.user_id,
    pup.name,
    pup.address_prefecture,
    ul.xp,
    ul.level,
    ul.updated_at,
    ROW_NUMBER() OVER (ORDER BY ul.xp DESC, ul.updated_at ASC) AS rank
FROM user_levels ul
JOIN public_user_profiles pup ON ul.user_id = pup.id
WHERE pup.deleted_at IS NULL
ORDER BY ul.xp DESC, ul.updated_at ASC;

COMMENT ON VIEW public.user_ranking_view IS '全ユーザーのXPベースランキング（ソフト削除ユーザーを除く）';
