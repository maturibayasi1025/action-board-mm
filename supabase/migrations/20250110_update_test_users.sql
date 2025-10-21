-- =====================================================
-- テストユーザーのパスワード更新用マイグレーション
--
-- 注意: このスクリプトは既存のユーザーを削除して再作成します
-- 本番環境での実行には十分注意してください
-- =====================================================

-- 1. 既存のテストユーザーデータを削除（必要に応じて）
-- 注意: これらのユーザーに関連するデータも削除される可能性があります
DELETE FROM xp_transactions WHERE user_id IN (
  '622d6984-2f8a-41df-9ac3-cd4dcceb8d19',
  '2c23c05b-8e25-4d0d-9e68-d3be74e4ae8f',
  'f47ac10b-58cc-4372-a567-0e02b2c3d479'
);

DELETE FROM user_levels WHERE user_id IN (
  '622d6984-2f8a-41df-9ac3-cd4dcceb8d19',
  '2c23c05b-8e25-4d0d-9e68-d3be74e4ae8f',
  'f47ac10b-58cc-4372-a567-0e02b2c3d479'
);

DELETE FROM private_users WHERE id IN (
  '622d6984-2f8a-41df-9ac3-cd4dcceb8d19',
  '2c23c05b-8e25-4d0d-9e68-d3be74e4ae8f',
  'f47ac10b-58cc-4372-a567-0e02b2c3d479'
);

DELETE FROM auth.users WHERE id IN (
  '622d6984-2f8a-41df-9ac3-cd4dcceb8d19',
  '2c23c05b-8e25-4d0d-9e68-d3be74e4ae8f',
  'f47ac10b-58cc-4372-a567-0e02b2c3d479'
);

-- 2. 新しいテストユーザーを追加
INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data, email_change, email_change_token_new, recovery_token, confirmation_token, confirmation_sent_at, created_at, updated_at)
VALUES
  ('00000000-0000-0000-0000-000000000000', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'authenticated', 'authenticated', 'hakura@maisonmarc.com', crypt('Hakura$Secure2024', gen_salt('bf')), now(), now(), '{"provider": "email", "providers": ["email"]}', '{"email_verified": true}', '', '', '', '', now(), now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'b2c3d4e5-f6a7-8901-bcde-f23456789012', 'authenticated', 'authenticated', 's.igari@maisonmarc.com', crypt('IgariShun%Pass123', gen_salt('bf')), now(), now(), '{"provider": "email", "providers": ["email"]}', '{"email_verified": true}', '', '', '', '', now(), now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'c3d4e5f6-a7b8-9012-cdef-345678901234', 'authenticated', 'authenticated', 'y.yanase@maisonmarc.com', crypt('Yanase&Yuya2024', gen_salt('bf')), now(), now(), '{"provider": "email", "providers": ["email"]}', '{"email_verified": true}', '', '', '', '', now(), now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'd4e5f6a7-b8c9-d0e1-f234-567890123456', 'authenticated', 'authenticated', 'f.furuno@maisonmarc.com', crypt('FurunoRyota*456', gen_salt('bf')), now(), now(), '{"provider": "email", "providers": ["email"]}', '{"email_verified": true}', '', '', '', '', now(), now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'e5f6a7b8-c9d0-e1f2-3456-789012345678', 'authenticated', 'authenticated', 'k.itaka@maisonmarc.com', crypt('ItakaKouichi#789', gen_salt('bf')), now(), now(), '{"provider": "email", "providers": ["email"]}', '{"email_verified": true}', '', '', '', '', now(), now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'f6a7b8c9-d0e1-f234-5678-901234567890', 'authenticated', 'authenticated', 'y.yamada@maisonmarc.com', crypt('YamadaKazu@2024', gen_salt('bf')), now(), now(), '{"provider": "email", "providers": ["email"]}', '{"email_verified": true}', '', '', '', '', now(), now(), now()),
  ('00000000-0000-0000-0000-000000000000', '11223344-5566-7788-99aa-bbccddeeff00', 'authenticated', 'authenticated', 'y.yamaguchi@maisonmarc.com', crypt('YamaguchiYuji!321', gen_salt('bf')), now(), now(), '{"provider": "email", "providers": ["email"]}', '{"email_verified": true}', '', '', '', '', now(), now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'b2c3d4e5-f6a7-2345-6789-012345678901', 'authenticated', 'authenticated', 's.kojima@maisonmarc.com', crypt('KojimaShota$567', gen_salt('bf')), now(), now(), '{"provider": "email", "providers": ["email"]}', '{"email_verified": true}', '', '', '', '', now(), now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'c3d4e5f6-a7b8-3456-789a-123456789012', 'authenticated', 'authenticated', 'y.baba@maisonmarc.com', crypt('BabaYuudai#890', gen_salt('bf')), now(), now(), '{"provider": "email", "providers": ["email"]}', '{"email_verified": true}', '', '', '', '', now(), now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'd4e5f6a7-b8c9-4567-89ab-234567890123', 'authenticated', 'authenticated', 't.sekiguchi@maisonmarc.com', crypt('SekiguchiTaka%2024', gen_salt('bf')), now(), now(), '{"provider": "email", "providers": ["email"]}', '{"email_verified": true}', '', '', '', '', now(), now(), now())
ON CONFLICT (id) DO NOTHING;

-- 3. private_usersにユーザー情報を追加
INSERT INTO private_users (id, name, address_prefecture, date_of_birth, x_username)
VALUES
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', '葉倉歩', '東京都', '1990-05-10', 'hakura_ayumu'),
  ('b2c3d4e5-f6a7-8901-bcde-f23456789012', '猪狩俊', '東京都', '1988-09-20', 'igari_shun'),
  ('c3d4e5f6-a7b8-9012-cdef-345678901234', '柳瀬裕也', '東京都', '1992-03-15', 'yanase_yuya'),
  ('d4e5f6a7-b8c9-d0e1-f234-567890123456', '古野良太', '東京都', '1990-05-10', 'furuno_ryota'),
  ('e5f6a7b8-c9d0-e1f2-3456-789012345678', '位高光一', '東京都', '1988-09-20', 'itaka_kouichi'),
  ('f6a7b8c9-d0e1-f234-5678-901234567890', '山田一貴', '東京都', '1992-03-15', 'yamada_kazutaka'),
  ('11223344-5566-7788-99aa-bbccddeeff00', '山口裕二', '東京都', '1992-03-15', 'yamaguchi_yuji'),
  ('b2c3d4e5-f6a7-2345-6789-012345678901', '小嶋翔太', '東京都', '1992-03-15', 'kojima_shota'),
  ('c3d4e5f6-a7b8-3456-789a-123456789012', '馬場雄大', '東京都', '1992-03-15', 'baba_yuudai'),
  ('d4e5f6a7-b8c9-4567-89ab-234567890123', '関口貴大', '東京都', '1992-03-15', 'sekiguchi_takahiro')
ON CONFLICT (id) DO NOTHING;

-- 4. user_levelsに初期レベルを設定
INSERT INTO user_levels (user_id, xp, level, updated_at)
VALUES
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 0, 1, now()),
  ('b2c3d4e5-f6a7-8901-bcde-f23456789012', 0, 1, now()),
  ('c3d4e5f6-a7b8-9012-cdef-345678901234', 0, 1, now()),
  ('d4e5f6a7-b8c9-d0e1-f234-567890123456', 0, 1, now()),
  ('e5f6a7b8-c9d0-e1f2-3456-789012345678', 0, 1, now()),
  ('f6a7b8c9-d0e1-f234-5678-901234567890', 0, 1, now()),
  ('11223344-5566-7788-99aa-bbccddeeff00', 0, 1, now()),
  ('b2c3d4e5-f6a7-2345-6789-012345678901', 0, 1, now()),
  ('c3d4e5f6-a7b8-3456-789a-123456789012', 0, 1, now()),
  ('d4e5f6a7-b8c9-4567-89ab-234567890123', 0, 1, now())
ON CONFLICT (user_id) DO NOTHING;