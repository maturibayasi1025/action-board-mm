-- Slack メンバー ID（U…）を保持し、メンション解決を名前推測に頼らないようにする
ALTER TABLE public.private_users
  ADD COLUMN IF NOT EXISTS slack_user_id text;

COMMENT ON COLUMN public.private_users.slack_user_id IS 'Slack workspace のメンバー ID（U で始まる）。メンション解決・Webhook 連携用。NULL 可';

CREATE UNIQUE INDEX IF NOT EXISTS private_users_slack_user_id_unique
  ON public.private_users (slack_user_id)
  WHERE slack_user_id IS NOT NULL;
