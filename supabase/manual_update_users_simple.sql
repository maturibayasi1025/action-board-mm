-- =====================================================
-- Supabase Dashboard SQL Editor用スクリプト（簡易版）
--
-- 使用方法:
-- 1. Supabase Dashboardにログイン
-- 2. SQL Editorを開く
-- 3. このスクリプトを貼り付けて実行
--
-- 注意: 本番環境での実行前に必ずバックアップを取得してください
-- =====================================================

-- ユーザーを個別に追加（エラーが特定しやすい）

-- 1. hakura@maisonmarc.com
INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, email_change, email_change_token_new, recovery_token, confirmation_token, confirmation_sent_at, created_at, updated_at)
VALUES ('00000000-0000-0000-0000-000000000000', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'authenticated', 'authenticated', 'hakura@maisonmarc.com', crypt('Hakura$Secure2024', gen_salt('bf')), now(), '{"provider": "email", "providers": ["email"]}'::jsonb, '{"email_verified": true}'::jsonb, '', '', '', '', now(), now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO private_users (id, name, address_prefecture, date_of_birth, x_username)
VALUES ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', '葉倉歩', '東京都', '1990-05-10', 'hakura_ayumu')
ON CONFLICT (id) DO NOTHING;

INSERT INTO user_levels (user_id, xp, level, updated_at)
VALUES ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 0, 1, now())
ON CONFLICT (user_id) DO NOTHING;

-- 2. s.igari@maisonmarc.com
INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES ('00000000-0000-0000-0000-000000000000', 'b2c3d4e5-f6a7-8901-bcde-f23456789012', 'authenticated', 'authenticated', 's.igari@maisonmarc.com', crypt('IgariShun%Pass123', gen_salt('bf')), now(), '{"provider": "email", "providers": ["email"]}'::jsonb, '{"email_verified": true}'::jsonb, now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO private_users (id, name, address_prefecture, date_of_birth, x_username)
VALUES ('b2c3d4e5-f6a7-8901-bcde-f23456789012', '猪狩俊', '東京都', '1988-09-20', 'igari_shun')
ON CONFLICT (id) DO NOTHING;

INSERT INTO user_levels (user_id, xp, level, updated_at)
VALUES ('b2c3d4e5-f6a7-8901-bcde-f23456789012', 0, 1, now())
ON CONFLICT (user_id) DO NOTHING;

-- 3. y.yanase@maisonmarc.com
INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES ('00000000-0000-0000-0000-000000000000', 'c3d4e5f6-a7b8-9012-cdef-345678901234', 'authenticated', 'authenticated', 'y.yanase@maisonmarc.com', crypt('Yanase&Yuya2024', gen_salt('bf')), now(), '{"provider": "email", "providers": ["email"]}'::jsonb, '{"email_verified": true}'::jsonb, now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO private_users (id, name, address_prefecture, date_of_birth, x_username)
VALUES ('c3d4e5f6-a7b8-9012-cdef-345678901234', '柳瀬裕也', '東京都', '1992-03-15', 'yanase_yuya')
ON CONFLICT (id) DO NOTHING;

INSERT INTO user_levels (user_id, xp, level, updated_at)
VALUES ('c3d4e5f6-a7b8-9012-cdef-345678901234', 0, 1, now())
ON CONFLICT (user_id) DO NOTHING;

-- 4. f.furuno@maisonmarc.com
INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES ('00000000-0000-0000-0000-000000000000', 'd4e5f6a7-b8c9-d0e1-f234-567890123456', 'authenticated', 'authenticated', 'f.furuno@maisonmarc.com', crypt('FurunoRyota*456', gen_salt('bf')), now(), '{"provider": "email", "providers": ["email"]}'::jsonb, '{"email_verified": true}'::jsonb, now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO private_users (id, name, address_prefecture, date_of_birth, x_username)
VALUES ('d4e5f6a7-b8c9-d0e1-f234-567890123456', '古野良太', '東京都', '1990-05-10', 'furuno_ryota')
ON CONFLICT (id) DO NOTHING;

INSERT INTO user_levels (user_id, xp, level, updated_at)
VALUES ('d4e5f6a7-b8c9-d0e1-f234-567890123456', 0, 1, now())
ON CONFLICT (user_id) DO NOTHING;

-- 5. k.itaka@maisonmarc.com
INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES ('00000000-0000-0000-0000-000000000000', 'e5f6a7b8-c9d0-e1f2-3456-789012345678', 'authenticated', 'authenticated', 'k.itaka@maisonmarc.com', crypt('ItakaKouichi#789', gen_salt('bf')), now(), '{"provider": "email", "providers": ["email"]}'::jsonb, '{"email_verified": true}'::jsonb, now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO private_users (id, name, address_prefecture, date_of_birth, x_username)
VALUES ('e5f6a7b8-c9d0-e1f2-3456-789012345678', '位高光一', '東京都', '1988-09-20', 'itaka_kouichi')
ON CONFLICT (id) DO NOTHING;

INSERT INTO user_levels (user_id, xp, level, updated_at)
VALUES ('e5f6a7b8-c9d0-e1f2-3456-789012345678', 0, 1, now())
ON CONFLICT (user_id) DO NOTHING;

-- 6. y.yamada@maisonmarc.com
INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES ('00000000-0000-0000-0000-000000000000', 'f6a7b8c9-d0e1-f234-5678-901234567890', 'authenticated', 'authenticated', 'y.yamada@maisonmarc.com', crypt('YamadaKazu@2024', gen_salt('bf')), now(), '{"provider": "email", "providers": ["email"]}'::jsonb, '{"email_verified": true}'::jsonb, now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO private_users (id, name, address_prefecture, date_of_birth, x_username)
VALUES ('f6a7b8c9-d0e1-f234-5678-901234567890', '山田一貴', '東京都', '1992-03-15', 'yamada_kazutaka')
ON CONFLICT (id) DO NOTHING;

INSERT INTO user_levels (user_id, xp, level, updated_at)
VALUES ('f6a7b8c9-d0e1-f234-5678-901234567890', 0, 1, now())
ON CONFLICT (user_id) DO NOTHING;

-- 7. y.yamaguchi@maisonmarc.com (UUID修正済み)
INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES ('00000000-0000-0000-0000-000000000000', '11223344-5566-7788-99aa-bbccddeeff00', 'authenticated', 'authenticated', 'y.yamaguchi@maisonmarc.com', crypt('YamaguchiYuji!321', gen_salt('bf')), now(), '{"provider": "email", "providers": ["email"]}'::jsonb, '{"email_verified": true}'::jsonb, now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO private_users (id, name, address_prefecture, date_of_birth, x_username)
VALUES ('11223344-5566-7788-99aa-bbccddeeff00', '山口佑二', '東京都', '1992-03-15', 'yamaguchi_yuji')
ON CONFLICT (id) DO NOTHING;

INSERT INTO user_levels (user_id, xp, level, updated_at)
VALUES ('11223344-5566-7788-99aa-bbccddeeff00', 0, 1, now())
ON CONFLICT (user_id) DO NOTHING;

-- 8. s.kojima@maisonmarc.com
INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES ('00000000-0000-0000-0000-000000000000', 'b2c3d4e5-f6a7-2345-6789-012345678901', 'authenticated', 'authenticated', 's.kojima@maisonmarc.com', crypt('KojimaShota$567', gen_salt('bf')), now(), '{"provider": "email", "providers": ["email"]}'::jsonb, '{"email_verified": true}'::jsonb, now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO private_users (id, name, address_prefecture, date_of_birth, x_username)
VALUES ('b2c3d4e5-f6a7-2345-6789-012345678901', '小嶋翔太', '東京都', '1992-03-15', 'kojima_shota')
ON CONFLICT (id) DO NOTHING;

INSERT INTO user_levels (user_id, xp, level, updated_at)
VALUES ('b2c3d4e5-f6a7-2345-6789-012345678901', 0, 1, now())
ON CONFLICT (user_id) DO NOTHING;

-- 9. y.baba@maisonmarc.com
INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES ('00000000-0000-0000-0000-000000000000', 'c3d4e5f6-a7b8-3456-789a-123456789012', 'authenticated', 'authenticated', 'y.baba@maisonmarc.com', crypt('BabaYuudai#890', gen_salt('bf')), now(), '{"provider": "email", "providers": ["email"]}'::jsonb, '{"email_verified": true}'::jsonb, now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO private_users (id, name, address_prefecture, date_of_birth, x_username)
VALUES ('c3d4e5f6-a7b8-3456-789a-123456789012', '馬場雄大', '東京都', '1992-03-15', 'baba_yuudai')
ON CONFLICT (id) DO NOTHING;

INSERT INTO user_levels (user_id, xp, level, updated_at)
VALUES ('c3d4e5f6-a7b8-3456-789a-123456789012', 0, 1, now())
ON CONFLICT (user_id) DO NOTHING;

-- 10. t.sekiguchi@maisonmarc.com
INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES ('00000000-0000-0000-0000-000000000000', 'd4e5f6a7-b8c9-4567-89ab-234567890123', 'authenticated', 'authenticated', 't.sekiguchi@maisonmarc.com', crypt('SekiguchiTaka%2024', gen_salt('bf')), now(), '{"provider": "email", "providers": ["email"]}'::jsonb, '{"email_verified": true}'::jsonb, now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO private_users (id, name, address_prefecture, date_of_birth, x_username)
VALUES ('d4e5f6a7-b8c9-4567-89ab-234567890123', '関口貴大', '東京都', '1992-03-15', 'sekiguchi_takahiro')
ON CONFLICT (id) DO NOTHING;

INSERT INTO user_levels (user_id, xp, level, updated_at)
VALUES ('d4e5f6a7-b8c9-4567-89ab-234567890123', 0, 1, now())
ON CONFLICT (user_id) DO NOTHING;

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