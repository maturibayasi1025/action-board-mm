-- =====================================================
-- Supabase Dashboard SQL Editor用スクリプト
--
-- 使用方法:
-- 1. Supabase Dashboardにログイン
-- 2. SQL Editorを開く
-- 3. このスクリプトを貼り付けて実行
--
-- 注意: 本番環境での実行前に必ずバックアップを取得してください
-- =====================================================

-- ==========================================
-- オプション1: パスワードのみ更新（推奨）
-- 既存ユーザーが存在する場合はこちらを使用
-- ==========================================

-- 既存ユーザーのパスワードを更新する場合（例）
-- UPDATE auth.users
-- SET encrypted_password = crypt('新しいパスワード', gen_salt('bf'))
-- WHERE email = 'hakura@maisonmarc.com';

-- ==========================================
-- オプション2: 新規ユーザー作成
-- ユーザーが存在しない場合はこちらを使用
-- ==========================================

BEGIN;

-- auth.usersに新規ユーザーを追加
DO $$
DECLARE
  user_record RECORD;
BEGIN
  FOR user_record IN
    SELECT * FROM (VALUES
      ('a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid, 'hakura@maisonmarc.com', 'Hakura$Secure2024'),
      ('b2c3d4e5-f6a7-8901-bcde-f23456789012'::uuid, 's.igari@maisonmarc.com', 'IgariShun%Pass123'),
      ('c3d4e5f6-a7b8-9012-cdef-345678901234'::uuid, 'y.yanase@maisonmarc.com', 'Yanase&Yuya2024'),
      ('d4e5f6a7-b8c9-d0e1-f234-567890123456'::uuid, 'f.furuno@maisonmarc.com', 'FurunoRyota*456'),
      ('e5f6a7b8-c9d0-e1f2-3456-789012345678'::uuid, 'k.itaka@maisonmarc.com', 'ItakaKouichi#789'),
      ('f6a7b8c9-d0e1-f234-5678-901234567890'::uuid, 'k.yamada@maisonmarc.com', 'YamadaKazu@2024'),
      ('11223344-5566-7788-99aa-bbccddeeff00'::uuid, 'y.yamaguchi@maisonmarc.com', 'YamaguchiYuji!321'),
      ('b2c3d4e5-f6a7-2345-6789-012345678901'::uuid, 's.kojima@maisonmarc.com', 'KojimaShota$567'),
      ('c3d4e5f6-a7b8-3456-789a-123456789012'::uuid, 'y.baba@maisonmarc.com', 'BabaYuudai#890'),
      ('d4e5f6a7-b8c9-4567-89ab-234567890123'::uuid, 't.sekiguchi@maisonmarc.com', 'SekiguchiTaka%2024')
    ) AS t(id, email, password)
  LOOP
    -- 既存のユーザーをチェック
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = user_record.id OR email = user_record.email) THEN
      INSERT INTO auth.users (
        instance_id,
        id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        raw_app_meta_data,
        raw_user_meta_data,
        email_change,
        email_change_token_new,
        recovery_token,
        confirmation_token,
        confirmation_sent_at,
        created_at,
        updated_at
      )
      VALUES (
        '00000000-0000-0000-0000-000000000000',
        user_record.id,
        'authenticated',
        'authenticated',
        user_record.email,
        crypt(user_record.password, gen_salt('bf')),
        now(),
        '{"provider": "email", "providers": ["email"]}'::jsonb,
        '{"email_verified": true}'::jsonb,
        '',
        '',
        '',
        '',
        now(),
        now(),
        now()
      );
    END IF;
  END LOOP;
END $$;

-- private_usersにユーザー情報を追加
INSERT INTO private_users (id, name, address_prefecture, date_of_birth, x_username)
SELECT
  id,
  name,
  address_prefecture,
  date_of_birth,
  x_username
FROM (VALUES
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid, '葉倉歩', '東京都', '1990-05-10'::date, 'hakura_ayumu'),
  ('b2c3d4e5-f6a7-8901-bcde-f23456789012'::uuid, '猪狩俊', '東京都', '1988-09-20'::date, 'igari_shun'),
  ('c3d4e5f6-a7b8-9012-cdef-345678901234'::uuid, '柳瀬裕也', '東京都', '1992-03-15'::date, 'yanase_yuya'),
  ('d4e5f6a7-b8c9-d0e1-f234-567890123456'::uuid, '古野良太', '東京都', '1990-05-10'::date, 'furuno_ryota'),
  ('e5f6a7b8-c9d0-e1f2-3456-789012345678'::uuid, '位高光一', '東京都', '1988-09-20'::date, 'itaka_kouichi'),
  ('f6a7b8c9-d0e1-f234-5678-901234567890'::uuid, '山田一貴', '東京都', '1992-03-15'::date, 'yamada_kazutaka'),
  ('11223344-5566-7788-99aa-bbccddeeff00'::uuid, '山口佑二', '東京都', '1992-03-15'::date, 'yamaguchi_yuji'),
  ('b2c3d4e5-f6a7-2345-6789-012345678901'::uuid, '小嶋翔太', '東京都', '1992-03-15'::date, 'kojima_shota'),
  ('c3d4e5f6-a7b8-3456-789a-123456789012'::uuid, '馬場雄大', '東京都', '1992-03-15'::date, 'baba_yuudai'),
  ('d4e5f6a7-b8c9-4567-89ab-234567890123'::uuid, '関口貴大', '東京都', '1992-03-15'::date, 'sekiguchi_takahiro')
) AS new_users(id, name, address_prefecture, date_of_birth, x_username)
WHERE NOT EXISTS (
  SELECT 1 FROM private_users WHERE private_users.id = new_users.id
);

-- user_levelsに初期レベルを設定
INSERT INTO user_levels (user_id, xp, level, updated_at)
SELECT
  id,
  0,
  1,
  now()
FROM (VALUES
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid),
  ('b2c3d4e5-f6a7-8901-bcde-f23456789012'::uuid),
  ('c3d4e5f6-a7b8-9012-cdef-345678901234'::uuid),
  ('d4e5f6a7-b8c9-d0e1-f234-567890123456'::uuid),
  ('e5f6a7b8-c9d0-e1f2-3456-789012345678'::uuid),
  ('f6a7b8c9-d0e1-f234-5678-901234567890'::uuid),
  ('11223344-5566-7788-99aa-bbccddeeff00'::uuid),
  ('b2c3d4e5-f6a7-2345-6789-012345678901'::uuid),
  ('c3d4e5f6-a7b8-3456-789a-123456789012'::uuid),
  ('d4e5f6a7-b8c9-4567-89ab-234567890123'::uuid)
) AS user_ids(id)
WHERE NOT EXISTS (
  SELECT 1 FROM user_levels WHERE user_levels.user_id = user_ids.id
);

COMMIT;

-- 作成されたユーザーを確認
SELECT
  au.email,
  pu.name,
  pu.x_username,
  ul.level,
  ul.xp
FROM auth.users au
LEFT JOIN private_users pu ON au.id = pu.id
LEFT JOIN user_levels ul ON au.id = ul.user_id
WHERE au.email LIKE '%@maisonmarc.com'
ORDER BY au.created_at DESC;