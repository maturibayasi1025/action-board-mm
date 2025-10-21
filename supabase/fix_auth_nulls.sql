-- =====================================================
-- Supabase auth.users テーブルのNULL値修正スクリプト
--
-- 問題: confirmation_token等がNULLになっているとSupabase認証でエラーが発生
-- 解決: 対象カラムを空文字列('')に更新
-- =====================================================

-- 既存ユーザーのNULLフィールドを空文字列に更新
UPDATE auth.users
SET
  email_change = COALESCE(email_change, ''),
  email_change_token_new = COALESCE(email_change_token_new, ''),
  recovery_token = COALESCE(recovery_token, ''),
  confirmation_token = COALESCE(confirmation_token, '')
WHERE
  email_change IS NULL
  OR email_change_token_new IS NULL
  OR recovery_token IS NULL
  OR confirmation_token IS NULL;

-- maisonmarc.comドメインのユーザーに対する確認
UPDATE auth.users
SET
  email_change = '',
  email_change_token_new = '',
  recovery_token = '',
  confirmation_token = '',
  confirmation_sent_at = now()
WHERE email LIKE '%@maisonmarc.com'
  AND (
    email_change IS NULL
    OR email_change_token_new IS NULL
    OR recovery_token IS NULL
    OR confirmation_token IS NULL
    OR confirmation_sent_at IS NULL
  );

-- 修正結果を確認
SELECT
  email,
  CASE
    WHEN email_change IS NULL THEN 'NULL'
    ELSE 'OK'
  END as email_change_status,
  CASE
    WHEN email_change_token_new IS NULL THEN 'NULL'
    ELSE 'OK'
  END as email_change_token_new_status,
  CASE
    WHEN recovery_token IS NULL THEN 'NULL'
    ELSE 'OK'
  END as recovery_token_status,
  CASE
    WHEN confirmation_token IS NULL THEN 'NULL'
    ELSE 'OK'
  END as confirmation_token_status
FROM auth.users
WHERE email LIKE '%@maisonmarc.com'
ORDER BY email;