-- 経営者からのユーザー招待を追跡する
CREATE TABLE public.user_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  invited_by UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  auth_user_id UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  business_unit_id UUID REFERENCES public.business_units (id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ
);

COMMENT ON TABLE public.user_invitations IS '経営者からのメール招待。書き込みはサービスロールのみ。';
COMMENT ON COLUMN public.user_invitations.email IS '招待先メールアドレス（アプリ側で小文字正規化）';
COMMENT ON COLUMN public.user_invitations.auth_user_id IS 'inviteUserByEmail で作られた Auth ユーザー';
COMMENT ON COLUMN public.user_invitations.business_unit_id IS '招待時に事前指定する所属事業部。NULL可';
COMMENT ON COLUMN public.user_invitations.status IS 'pending / accepted / cancelled';

CREATE UNIQUE INDEX user_invitations_pending_email_unique
  ON public.user_invitations (lower(email))
  WHERE status = 'pending';

CREATE INDEX user_invitations_status_created_idx
  ON public.user_invitations (status, created_at DESC);

CREATE INDEX user_invitations_auth_user_id_idx
  ON public.user_invitations (auth_user_id);

ALTER TABLE public.user_invitations ENABLE ROW LEVEL SECURITY;

-- 招待レコードは経営者画面（サービスロール）からのみ操作する。
-- anon / authenticated 向けポリシーは置かない。
