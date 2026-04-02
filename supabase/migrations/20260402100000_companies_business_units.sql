-- 会社・事業部マスタとユーザーへの事業部割り当て

-- 1. companies
CREATE TABLE public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.companies IS '会社マスタ。将来の会社単位属性の拡張先。';
COMMENT ON COLUMN public.companies.slug IS 'URLやコード用の省略子。NULL可';

CREATE INDEX companies_active_order_idx
  ON public.companies (is_active, display_order, name);

-- 2. business_units
CREATE TABLE public.business_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  parent_id UUID REFERENCES public.business_units (id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT business_units_company_name_unique UNIQUE (company_id, name)
);

COMMENT ON TABLE public.business_units IS '会社配下の事業部・単位。ユーザーはこの行に紐づく。';
COMMENT ON COLUMN public.business_units.parent_id IS '将来の階層用。当面は NULL で運用。';

CREATE INDEX business_units_company_idx ON public.business_units (company_id);
CREATE INDEX business_units_active_order_idx
  ON public.business_units (company_id, is_active, display_order, name);

-- 3. private_users / public_user_profiles
ALTER TABLE public.private_users
  ADD COLUMN business_unit_id UUID REFERENCES public.business_units (id) ON DELETE SET NULL;

COMMENT ON COLUMN public.private_users.business_unit_id IS '所属事業部（マスタ参照）。NULL可';

ALTER TABLE public.public_user_profiles
  ADD COLUMN business_unit_id UUID REFERENCES public.business_units (id) ON DELETE SET NULL;

COMMENT ON COLUMN public.public_user_profiles.business_unit_id IS '所属事業部（private_users から同期）。表示用';

CREATE INDEX private_users_business_unit_id_idx ON public.private_users (business_unit_id);
CREATE INDEX public_user_profiles_business_unit_id_idx ON public.public_user_profiles (business_unit_id);

-- 4. 公開プロフィール同期トリガー（business_unit_id を含める）
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
    business_unit_id
  )
  VALUES (
    NEW.id,
    NEW.name,
    NEW.address_prefecture,
    NEW.x_username,
    NEW.avatar_url,
    NEW.created_at,
    NEW.business_unit_id
  )
  ON CONFLICT (id) DO UPDATE
  SET
    name = EXCLUDED.name,
    address_prefecture = EXCLUDED.address_prefecture,
    x_username = EXCLUDED.x_username,
    avatar_url = EXCLUDED.avatar_url,
    created_at = EXCLUDED.created_at,
    business_unit_id = EXCLUDED.business_unit_id;

  PERFORM set_config('my.is_trigger', 'false', true);
  RETURN NEW;
END;
$$;

-- 5. RLS: 有効な行は誰でも参照可（公開プロフィールから join するため anon 含む）
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_units ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read_active_companies"
  ON public.companies
  FOR SELECT
  TO public
  USING (is_active = true);

CREATE POLICY "read_active_business_units"
  ON public.business_units
  FOR SELECT
  TO public
  USING (is_active = true);

-- 書き込みはサービスロール等バイパスのみ（ポリシーなし）
