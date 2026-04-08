-- =====================================================
-- 特定ユーザーのメールアドレス・パスワードを変更する（手動実行用）
--
-- 実行場所: Supabase Dashboard → SQL Editor（または psql）
-- 本番で使う前にバックアップを取得してください。
--
-- パスワードは平文を SQL に書かず、実行直前に置き換えるか、
-- ダッシュボードの Authentication → Users から変更する方法も検討してください。
-- =====================================================

-- pgcrypto（crypt / gen_salt）は Supabase では通常有効です。
-- CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- プレースホルダを実値に置き換えてから 1 ブロックで実行
-- ---------------------------------------------------------------------------

BEGIN;

-- 対象の特定: id または 変更前メールのどちらかで絞る
-- （両方コメントアウトして片方だけ使ってもよい）

UPDATE auth.users
SET
  email = 'new-email@example.com',
  encrypted_password = crypt('REPLACE_WITH_NEW_PLAIN_PASSWORD', gen_salt('bf')),
  email_change = '',
  email_change_token_new = '',
  updated_at = now()
WHERE id = '00000000-0000-0000-0000-000000000000'::uuid;
-- または: WHERE email = 'old-email@example.com';

-- メールプロバイダの identity 情報を auth.users と揃える（メール変更時は推奨）
-- 上の UPDATE で id を特定できた場合、同じ user_id で実行
-- identity の email は JSON の「文字列」として入れる（to_jsonb はダッシュボードの SQL で失敗することがある）
-- auth.users の新メールと同じ文字列を、外側は単引用符・内側は JSON 用の二重引用符で書く
UPDATE auth.identities
SET
  identity_data = jsonb_set(
    jsonb_set(
      identity_data,
      '{email}',
      '"new-email@example.com"'::jsonb
    ),
    '{email_verified}',
    'true'::jsonb
  ),
  updated_at = now()
WHERE user_id = '00000000-0000-0000-0000-000000000000'::uuid
  AND provider = 'email';

COMMIT;

-- 確認用（必要に応じて）
-- SELECT id, email, updated_at FROM auth.users WHERE email = 'new-email@example.com';
-- SELECT id, provider, identity_data FROM auth.identities WHERE user_id = '...';
