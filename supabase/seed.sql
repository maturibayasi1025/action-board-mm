-- auth.usersテーブルにユーザーを追加（外部キー制約のため）
INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data, email_change, email_change_token_new, recovery_token, confirmation_token, confirmation_sent_at, created_at, updated_at)
VALUES
  -- 新規追加ユーザー
  ('00000000-0000-0000-0000-000000000000', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'authenticated', 'authenticated', 'test-user-1@example.com', crypt('TestPassword123!', gen_salt('bf')), now(), now(), '{"provider": "email", "providers": ["email"]}', '{"email_verified": true}', '', '', '', '', now(), now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'b2c3d4e5-f6a7-8901-bcde-f23456789012', 'authenticated', 'authenticated', 'test-user-2@example.com', crypt('TestPassword123!', gen_salt('bf')), now(), now(), '{"provider": "email", "providers": ["email"]}', '{"email_verified": true}', '', '', '', '', now(), now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'c3d4e5f6-a7b8-9012-cdef-345678901234', 'authenticated', 'authenticated', 'test-user-3@example.com', crypt('TestPassword123!', gen_salt('bf')), now(), now(), '{"provider": "email", "providers": ["email"]}', '{"email_verified": true}', '', '', '', '', now(), now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'd4e5f6a7-b8c9-d0e1-f234-567890123456', 'authenticated', 'authenticated', 'test-user-4@example.com', crypt('TestPassword123!', gen_salt('bf')), now(), now(), '{"provider": "email", "providers": ["email"]}', '{"email_verified": true}', '', '', '', '', now(), now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'e5f6a7b8-c9d0-e1f2-3456-789012345678', 'authenticated', 'authenticated', 'test-user-5@example.com', crypt('TestPassword123!', gen_salt('bf')), now(), now(), '{"provider": "email", "providers": ["email"]}', '{"email_verified": true}', '', '', '', '', now(), now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'f6a7b8c9-d0e1-f234-5678-901234567890', 'authenticated', 'authenticated', 'test-user-6@example.com', crypt('TestPassword123!', gen_salt('bf')), now(), now(), '{"provider": "email", "providers": ["email"]}', '{"email_verified": true}', '', '', '', '', now(), now(), now()),
  ('00000000-0000-0000-0000-000000000000', '11223344-5566-7788-99aa-bbccddeeff00', 'authenticated', 'authenticated', 'test-user-7@example.com', crypt('TestPassword123!', gen_salt('bf')), now(), now(), '{"provider": "email", "providers": ["email"]}', '{"email_verified": true}', '', '', '', '', now(), now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'b2c3d4e5-f6a7-2345-6789-012345678901', 'authenticated', 'authenticated', 'test-user-8@example.com', crypt('TestPassword123!', gen_salt('bf')), now(), now(), '{"provider": "email", "providers": ["email"]}', '{"email_verified": true}', '', '', '', '', now(), now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'c3d4e5f6-a7b8-3456-789a-123456789012', 'authenticated', 'authenticated', 'test-user-9@example.com', crypt('TestPassword123!', gen_salt('bf')), now(), now(), '{"provider": "email", "providers": ["email"]}', '{"email_verified": true}', '', '', '', '', now(), now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'd4e5f6a7-b8c9-4567-89ab-234567890123', 'authenticated', 'authenticated', 'test-user-10@example.com', crypt('TestPassword123!', gen_salt('bf')), now(), now(), '{"provider": "email", "providers": ["email"]}', '{"email_verified": true}', '', '', '', '', now(), now(), now()),
  
  ('00000000-0000-0000-0000-000000000000', '12345678-9012-3456-7890-123456789012', 'authenticated', 'authenticated', 'test-user-11@example.com', crypt('TestPassword123!', gen_salt('bf')), now(), now(), '{"provider": "email", "providers": ["email"]}', '{"email_verified": true}', '', '', '', '', now(), now(), now()),
  ('00000000-0000-0000-0000-000000000000', '23456789-0123-4567-8901-234567890123', 'authenticated', 'authenticated', 'test-user-12@example.com', crypt('TestPassword123!', gen_salt('bf')), now(), now(), '{"provider": "email", "providers": ["email"]}', '{"email_verified": true}', '', '', '', '', now(), now(), now()),
  ('00000000-0000-0000-0000-000000000000', '34567890-1234-5678-9012-345678901234', 'authenticated', 'authenticated', 'test-user-13@example.com', crypt('TestPassword123!', gen_salt('bf')), now(), now(), '{"provider": "email", "providers": ["email"]}', '{"email_verified": true}', '', '', '', '', now(), now(), now()),
  ('00000000-0000-0000-0000-000000000000', '45678901-2345-6789-0123-456789012345', 'authenticated', 'authenticated', 'test-user-14@example.com', crypt('TestPassword123!', gen_salt('bf')), now(), now(), '{"provider": "email", "providers": ["email"]}', '{"email_verified": true}', '', '', '', '', now(), now(), now()),
  ('00000000-0000-0000-0000-000000000000', '56789012-3456-7890-1234-567890123456', 'authenticated', 'authenticated', 'test-user-15@example.com', crypt('TestPassword123!', gen_salt('bf')), now(), now(), '{"provider": "email", "providers": ["email"]}', '{"email_verified": true}', '', '', '', '', now(), now(), now()),
  ('00000000-0000-0000-0000-000000000000', '67890123-4567-8901-2345-678901234567', 'authenticated', 'authenticated', 'test-user-16@example.com', crypt('TestPassword123!', gen_salt('bf')), now(), now(), '{"provider": "email", "providers": ["email"]}', '{"email_verified": true}', '', '', '', '', now(), now(), now()),
  ('00000000-0000-0000-0000-000000000000', '78901234-5678-9012-3456-789012345678', 'authenticated', 'authenticated', 'test-user-17@example.com', crypt('TestPassword123!', gen_salt('bf')), now(), now(), '{"provider": "email", "providers": ["email"]}', '{"email_verified": true}', '', '', '', '', now(), now(), now()),
  ('00000000-0000-0000-0000-000000000000', '89012345-6789-0123-4567-890123456789', 'authenticated', 'authenticated', 'test-user-18@example.com', crypt('TestPassword123!', gen_salt('bf')), now(), now(), '{"provider": "email", "providers": ["email"]}', '{"email_verified": true}', '', '', '', '', now(), now(), now()),
  ('00000000-0000-0000-0000-000000000000', '90123456-7890-1234-5678-901234567890', 'authenticated', 'authenticated', 'test-user-19@example.com', crypt('TestPassword123!', gen_salt('bf')), now(), now(), '{"provider": "email", "providers": ["email"]}', '{"email_verified": true}', '', '', '', '', now(), now(), now()),
  ('00000000-0000-0000-0000-000000000000', '01234567-8901-2345-6789-012345678901', 'authenticated', 'authenticated', 'test-user-20@example.com', crypt('TestPassword123!', gen_salt('bf')), now(), now(), '{"provider": "email", "providers": ["email"]}', '{"email_verified": true}', '', '', '', '', now(), now(), now()),
  ('00000000-0000-0000-0000-000000000000', '43956344-5666-7928-9913-b5a27de46c00', 'authenticated', 'authenticated', 'test-user-21@example.com', crypt('TestPassword123!', gen_salt('bf')), now(), now(), '{"provider": "email", "providers": ["email"]}', '{"email_verified": true}', '', '', '', '', now(), now(), now()),
  ('00000000-0000-0000-0000-000000000000', '22334455-6677-8899-aa00-bb1122334455', 'authenticated', 'authenticated', 'test-user-22@example.com', crypt('TestPassword123!', gen_salt('bf')), now(), now(), '{"provider": "email", "providers": ["email"]}', '{"email_verified": true}', '', '', '', '', now(), now(), now()),
  ('00000000-0000-0000-0000-000000000000', '33445566-7788-9900-aa11-bb2233445566', 'authenticated', 'authenticated', 'test-user-23@example.com', crypt('TestPassword123!', gen_salt('bf')), now(), now(), '{"provider": "email", "providers": ["email"]}', '{"email_verified": true}', '', '', '', '', now(), now(), now()),
  ('00000000-0000-0000-0000-000000000000', '44556677-8899-0011-aa22-bb3344556677', 'authenticated', 'authenticated', 'test-user-24@example.com', crypt('TestPassword123!', gen_salt('bf')), now(), now(), '{"provider": "email", "providers": ["email"]}', '{"email_verified": true}', '', '', '', '', now(), now(), now()),
  ('00000000-0000-0000-0000-000000000000', '55667788-9900-1122-aa33-bb4455667788', 'authenticated', 'authenticated', 'test-user-25@example.com', crypt('TestPassword123!', gen_salt('bf')), now(), now(), '{"provider": "email", "providers": ["email"]}', '{"email_verified": true}', '', '', '', '', now(), now(), now()),
  ('00000000-0000-0000-0000-000000000000', '66778899-0011-2233-aa44-bb5566778899', 'authenticated', 'authenticated', 'test-user-26@example.com', crypt('TestPassword123!', gen_salt('bf')), now(), now(), '{"provider": "email", "providers": ["email"]}', '{"email_verified": true}', '', '', '', '', now(), now(), now()),
  ('00000000-0000-0000-0000-000000000000', '77889900-1122-3344-aa55-bb6677889900', 'authenticated', 'authenticated', 'test-user-27@example.com', crypt('TestPassword123!', gen_salt('bf')), now(), now(), '{"provider": "email", "providers": ["email"]}', '{"email_verified": true}', '', '', '', '', now(), now(), now()),
  ('00000000-0000-0000-0000-000000000000', '88990011-2233-4455-aa66-bb7788990011', 'authenticated', 'authenticated', 'test-user-28@example.com', crypt('TestPassword123!', gen_salt('bf')), now(), now(), '{"provider": "email", "providers": ["email"]}', '{"email_verified": true}', '', '', '', '', now(), now(), now()),
  ('00000000-0000-0000-0000-000000000000', '99001122-3344-5566-aa77-bb8899001122', 'authenticated', 'authenticated', 'test-user-29@example.com', crypt('TestPassword123!', gen_salt('bf')), now(), now(), '{"provider": "email", "providers": ["email"]}', '{"email_verified": true}', '', '', '', '', now(), now(), now()),
  ('00000000-0000-0000-0000-000000000000', '00112233-4455-6677-aa88-bb9900112233', 'authenticated', 'authenticated', 'test-user-30@example.com', crypt('TestPassword123!', gen_salt('bf')), now(), now(), '{"provider": "email", "providers": ["email"]}', '{"email_verified": true}', '', '', '', '', now(), now(), now()),
  ('00000000-0000-0000-0000-000000000000', '00112233-4455-6677-aa89-bb9900112233', 'authenticated', 'authenticated', 'test-user-31@example.com', crypt('TestPassword123!', gen_salt('bf')), now(), now(), '{"provider": "email", "providers": ["email"]}', '{"email_verified": true}', '', '', '', '', now(), now(), now())
ON CONFLICT (id) DO NOTHING;
-- ユーザー
INSERT INTO private_users (id, name, address_prefecture, date_of_birth, x_username)
VALUES
  -- 新規追加ユーザー
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', '葉倉歩', '東京都', '1990-05-10', 'hakura_ayumu'),
  ('b2c3d4e5-f6a7-8901-bcde-f23456789012', '猪狩俊', '東京都', '1988-09-20', 'igari_shun'),
  ('c3d4e5f6-a7b8-9012-cdef-345678901234', '柳瀬裕也', '東京都', '1992-03-15', 'yanase_yuya'),
  ('d4e5f6a7-b8c9-d0e1-f234-567890123456', '古野良太', '東京都', '1990-05-10', 'furuno_ryota'),
  ('e5f6a7b8-c9d0-e1f2-3456-789012345678', '位高光一', '東京都', '1988-09-20', 'itaka_kouichi'),
  ('f6a7b8c9-d0e1-f234-5678-901234567890', '山田一貴', '東京都', '1992-03-15', 'yamada_kazutaka'),
  ('11223344-5566-7788-99aa-bbccddeeff00', '山口裕二', '東京都', '1992-03-15', 'yamaguchi_yuji'),
  ('b2c3d4e5-f6a7-2345-6789-012345678901', '小嶋翔太', '東京都', '1992-03-15', 'kojima_shota'),
  ('c3d4e5f6-a7b8-3456-789a-123456789012', '馬場雄大', '東京都', '1992-03-15', 'baba_yuudai'),
  ('d4e5f6a7-b8c9-4567-89ab-234567890123', '関口貴大', '東京都', '1992-03-15', 'sekiguchi_takahiro'),
  ('12345678-9012-3456-7890-123456789012', '酒井悠人', '東京都', '1992-03-15', 'sakai_yuto'),
  ('23456789-0123-4567-8901-234567890123', '藤井大雅', '東京都', '1992-03-15', 'fujii_taiga'),
  ('34567890-1234-5678-9012-345678901234', '竹下徹', '東京都', '1992-03-15', 'takeshita_toru'),
  ('45678901-2345-6789-0123-456789012345', '島田瞳', '東京都', '1992-03-15', 'shimada_hitomi'),
  ('56789012-3456-7890-1234-567890123456', '下平智也', '東京都', '1992-03-15', 'shimodaira_tomoya'),
  ('67890123-4567-8901-2345-678901234567', '高橋聖', '東京都', '1992-03-15', 'takahashi_akira'),
  ('78901234-5678-9012-3456-789012345678', '古井和真', '東京都', '1992-03-15', 'furui_kazuma'),
  ('89012345-6789-0123-4567-890123456789', '依藤葵', '東京都', '1992-03-15', 'yorifuji_aoi'),
  ('90123456-7890-1234-5678-901234567890', '小張恵未', '東京都', '1992-03-15', 'kobari_emi'),
  ('01234567-8901-2345-6789-012345678901', '伊藤宏', '東京都', '1992-03-15', 'itou_hiroshi'),
  ('43956344-5666-7928-9913-b5a27de46c00', '近藤美葵', '東京都', '1992-03-15', 'kondo_miki'),
  ('22334455-6677-8899-aa00-bb1122334455', '荒木星七', '東京都', '1992-03-15', 'araki_sena'),
  ('33445566-7788-9900-aa11-bb2233445566', '日髙希星', '東京都', '1992-03-15', 'hidaka_kira'),
  ('44556677-8899-0011-aa22-bb3344556677', '林真樹', '東京都', '1992-03-15', 'hayashi_maki'),
  ('55667788-9900-1122-aa33-bb4455667788', '佐藤澪', '東京都', '1992-03-15', 'sato_rei'),
  ('66778899-0011-2233-aa44-bb5566778899', '竹原大智', '東京都', '1992-03-15', 'takehara_taichi'),
  ('77889900-1122-3344-aa55-bb6677889900', '山中崇生', '東京都', '1992-03-15', 'yamanaka_takao'),
  ('88990011-2233-4455-aa66-bb7788990011', '森田陽介', '東京都', '1992-03-15', 'morita_yosuke'),
  ('99001122-3344-5566-aa77-bb8899001122', '古渡真紀', '東京都', '1992-03-15', 'furuhashi_maki'),
  ('00112233-4455-6677-aa88-bb9900112233', '櫻井大稀', '東京都', '1992-03-15', 'sakurai_hiroki'),
  ('00112233-4455-6677-aa89-bb9900112233', '芦川茉奈美', '東京都', '1992-03-15', 'ashikawa_manami')
ON CONFLICT (id) DO NOTHING;
-- ユーザーレベル情報（XPとレベル設定）
INSERT INTO user_levels (user_id, xp, level, updated_at)
VALUES
  -- 初期レベル設定
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 0, 1, '2025-06-05T10:00:00Z'),
  ('b2c3d4e5-f6a7-8901-bcde-f23456789012', 0, 1, '2025-06-05T11:00:00Z'),
  ('c3d4e5f6-a7b8-9012-cdef-345678901234', 0, 1, '2025-06-05T12:00:00Z'),
  ('d4e5f6a7-b8c9-d0e1-f234-567890123456', 0, 1, '2025-06-05T12:00:00Z'),
  ('e5f6a7b8-c9d0-e1f2-3456-789012345678', 0, 1, '2025-06-05T12:00:00Z'),
  ('f6a7b8c9-d0e1-f234-5678-901234567890', 0, 1, '2025-06-05T12:00:00Z'),
  ('11223344-5566-7788-99aa-bbccddeeff00', 0, 1, '2025-06-05T12:00:00Z'),
  ('b2c3d4e5-f6a7-2345-6789-012345678901', 0, 1, '2025-06-05T12:00:00Z'),
  ('c3d4e5f6-a7b8-3456-789a-123456789012', 0, 1, '2025-06-05T12:00:00Z'),
  ('d4e5f6a7-b8c9-4567-89ab-234567890123', 0, 1, '2025-06-05T12:00:00Z'),
  ('12345678-9012-3456-7890-123456789012', 0, 1, '2025-06-05T12:00:00Z'),
  ('23456789-0123-4567-8901-234567890123', 0, 1, '2025-06-05T12:00:00Z'),
  ('34567890-1234-5678-9012-345678901234', 0, 1, '2025-06-05T12:00:00Z'),
  ('45678901-2345-6789-0123-456789012345', 0, 1, '2025-06-05T12:00:00Z'),
  ('56789012-3456-7890-1234-567890123456', 0, 1, '2025-06-05T12:00:00Z'),
  ('67890123-4567-8901-2345-678901234567', 0, 1, '2025-06-05T12:00:00Z'),
  ('78901234-5678-9012-3456-789012345678', 0, 1, '2025-06-05T12:00:00Z'),
  ('89012345-6789-0123-4567-890123456789', 0, 1, '2025-06-05T12:00:00Z'),
  ('90123456-7890-1234-5678-901234567890', 0, 1, '2025-06-05T12:00:00Z'),
  ('01234567-8901-2345-6789-012345678901', 0, 1, '2025-06-05T12:00:00Z'),
  ('22334455-6677-8899-aa00-bb1122334455', 0, 1, '2025-06-05T12:00:00Z'),
  ('33445566-7788-9900-aa11-bb2233445566', 0, 1, '2025-06-05T12:00:00Z'),
  ('44556677-8899-0011-aa22-bb3344556677', 0, 1, '2025-06-05T12:00:00Z'),
  ('55667788-9900-1122-aa33-bb4455667788', 0, 1, '2025-06-05T12:00:00Z'),
  ('66778899-0011-2233-aa44-bb5566778899', 0, 1, '2025-06-05T12:00:00Z'),
  ('77889900-1122-3344-aa55-bb6677889900', 0, 1, '2025-06-05T12:00:00Z'),
  ('88990011-2233-4455-aa66-bb7788990011', 0, 1, '2025-06-05T12:00:00Z'),
  ('99001122-3344-5566-aa77-bb8899001122', 0, 1, '2025-06-05T12:00:00Z'),
  ('00112233-4455-6677-aa88-bb9900112233', 0, 1, '2025-06-05T12:00:00Z'),
  ('00112233-4455-6677-aa89-bb9900112233', 0, 1, '2025-06-05T12:00:00Z')
ON CONFLICT (user_id) DO NOTHING;

-- グッジョブ
INSERT INTO missions (id, title, icon_url, content, difficulty, event_date, required_artifact_type, max_achievement_count, slug)
VALUES
  ('e2898d7e-903f-4f9a-8b1b-93f783c9afac', '(seed) ゴミ拾いをしよう (成果物不要)', NULL, '近所のゴミを拾ってみよう！清掃活動の報告は任意です。', 1, NULL, 'NONE', NULL, 'seed-cleanup'),
  ('2246205f-933f-4a86-83af-dbf6bb6cde90', '(seed) 活動ブログを書こう (リンク提出)', '/img/mission_fallback.svg', 'あなたの活動についてブログ記事を書き、URLを提出してください。', 2, NULL, 'LINK', 10, 'seed-activity-blog'),
  ('3346205f-933f-4a86-83af-dbf6bb6cde91', '(seed) 今日のベストショット (画像提出)', '/img/mission_fallback.svg', '今日の活動で見つけた素晴らしい瞬間を写真で共有してください。', 3, '2025-06-01', 'IMAGE', NULL, 'seed-best-shot'),
  ('4446205f-933f-4a86-83af-dbf6bb6cde92', '(seed) 発見！地域の宝 (位置情報付き画像)', '/img/mission_fallback.svg', 'あなたの地域で見つけた素敵な場所や物を、位置情報付きの写真で教えてください。', 4, NULL, 'IMAGE_WITH_GEOLOCATION', 5, 'seed-local-treasure'),
  ('5546205f-933f-4a86-83af-dbf6bb6cde93', '(seed) 日付付きグッジョブ１ (成果物不要, 上限1回)', '/img/mission_fallback.svg', 'テスト用のグッジョブです。<a href="/">link test</a>', 5, '2025-05-01', 'NONE', 1, 'seed-date-mission-1'),
  ('e5348472-d054-4ef4-81af-772c6323b669', '(seed) Xのニックネームを入力しよう(テキスト提出)', NULL, 'Xのニックネームを入力しよう', 1, NULL, 'TEXT', NULL, 'seed-x-nickname');

--★#278対応にて、achievementsとmission_artifactsのuser_idのFKをpublic_user_profileからauth.usersへ変更
--★seed.sql実行時点でauth.usersデータを作れず、上記2テーブルがFK違反になることから、INSERT処理はコメントアウト

-- (オプション) mission_artifacts と mission_artifact_geolocations のサンプルデータ
-- これらはアプリケーションロジック経由で作成されるのが主だが、テスト用に直接挿入も可能
--INSERT INTO mission_artifacts (achievement_id, user_id, artifact_type, link_url, description) VALUES ('953bcc49-56c4-4913-8ce4-f6d721e3c4ef', '2c23c05b-8e25-4d0d-9e68-d3be74e4ae8f', 'LINK', 'https://example.com/my-activity-blog', '活動報告ブログです');

-- グッジョブ達成（複数ユーザーの多様な達成パターン）
--INSERT INTO achievements (id, mission_id, user_id)
--VALUES
  -- 安野たかひろの達成（トップユーザーらしく多数達成）
--  ('17ea2e6e-9ccf-4d2d-a3b4-f34d1a612439', 'e2898d7e-903f-4f9a-8b1b-93f783c9afac', '622d6984-2f8a-41df-9ac3-cd4dcceb8d19'),
--  ('27ea2e6e-9ccf-4d2d-a3b4-f34d1a612440', '2246205f-933f-4a86-83af-dbf6bb6cde90', '622d6984-2f8a-41df-9ac3-cd4dcceb8d19'),
--  ('37ea2e6e-9ccf-4d2d-a3b4-f34d1a612441', '3346205f-933f-4a86-83af-dbf6bb6cde91', '622d6984-2f8a-41df-9ac3-cd4dcceb8d19'),
  
  -- 田中花子の達成
-- ('953bcc49-56c4-4913-8ce4-f6d721e3c4ef', '2246205f-933f-4a86-83af-dbf6bb6cde90', '2c23c05b-8e25-4d0d-9e68-d3be74e4ae8f'),
  
  -- 佐藤太郎の達成（2位らしく積極的）
--  ('47ea2e6e-9ccf-4d2d-a3b4-f34d1a612442', 'e2898d7e-903f-4f9a-8b1b-93f783c9afac', 'f47ac10b-58cc-4372-a567-0e02b2c3d479'),
--  ('57ea2e6e-9ccf-4d2d-a3b4-f34d1a612443', 'e5348472-d054-4ef4-81af-772c6323b669', 'f47ac10b-58cc-4372-a567-0e02b2c3d479'),
  
  -- 鈴木美咲の達成
--  ('67ea2e6e-9ccf-4d2d-a3b4-f34d1a612444', 'e2898d7e-903f-4f9a-8b1b-93f783c9afac', '6ba7b810-9dad-11d1-80b4-00c04fd430c8'),
--  ('77ea2e6e-9ccf-4d2d-a3b4-f34d1a612445', '3346205f-933f-4a86-83af-dbf6bb6cde91', '6ba7b810-9dad-11d1-80b4-00c04fd430c8'),
  
  -- 高橋健一の達成
--  ('87ea2e6e-9ccf-4d2d-a3b4-f34d1a612446', 'e5348472-d054-4ef4-81af-772c6323b669', '6ba7b811-9dad-11d1-80b4-00c04fd430c8'),
  
  -- 山田次郎の達成
--  ('97ea2e6e-9ccf-4d2d-a3b4-f34d1a612447', 'e2898d7e-903f-4f9a-8b1b-93f783c9afac', '6ba7b813-9dad-11d1-80b4-00c04fd430c8'),
  
  -- 小林直人の達成
--  ('a7ea2e6e-9ccf-4d2d-a3b4-f34d1a612448', 'e5348472-d054-4ef4-81af-772c6323b669', '6ba7b815-9dad-11d1-80b4-00c04fd430c8');

-- XPトランザクション履歴（グッジョブ達成に対応）
-- 初期状態では空
  
-- グッジョブ成果物のサンプルデータ
--INSERT INTO mission_artifacts (achievement_id, user_id, artifact_type, link_url, description) 
--VALUES 
--  ('953bcc49-56c4-4913-8ce4-f6d721e3c4ef', '2c23c05b-8e25-4d0d-9e68-d3be74e4ae8f', 'LINK', 'https://example.com/my-activity-blog', '活動報告ブログです'),
--  ('27ea2e6e-9ccf-4d2d-a3b4-f34d1a612440', '622d6984-2f8a-41df-9ac3-cd4dcceb8d19', 'LINK', 'https://example.com/anno-blog', '政治活動についての考察記事');

-- イベント
INSERT INTO events (id, title, url, starts_at)
VALUES
  ('d8314e09-6647-44ca-93c1-08c51707982b', '地域清掃イベント', 'https://example.com/event1', '2025-05-01T10:00:00Z');

-- 日次アクション数
INSERT INTO daily_action_summary (date, count) VALUES
  ('2025-05-01', 10);

-- 日次ダッシュボード登録人数
INSERT INTO daily_dashboard_registration_summary (date, count) VALUES
  ('2025-05-01', 12);

-- 都道府県別登録人数
INSERT INTO daily_dashboard_registration_by_prefecture_summary (date, prefecture, count) VALUES
  ('2025-05-01', '東京都', 3),
  ('2025-05-01', '大阪府', 2),
  ('2025-05-01', '神奈川県', 1),
  ('2025-05-01', '愛知県', 1),
  ('2025-05-01', '福岡県', 1),
  ('2025-05-01', '北海道', 1),
  ('2025-05-01', '京都府', 1),
  ('2025-05-01', '宮城県', 1),
  ('2025-05-01', '広島県', 1),
  ('2025-05-01', '沖縄県', 1);


-- missionsテーブルのフューチャードフラグをON
update public.missions
set is_featured = true
where id in (
  'e2898d7e-903f-4f9a-8b1b-93f783c9afac',
  '4446205f-933f-4a86-83af-dbf6bb6cde92'
);

-- ポスティングシェイプのサンプルデータ
INSERT INTO posting_shapes (id, type, coordinates, properties, created_at, updated_at)
VALUES
  -- 東京エリア（新宿区全域をカバーする大きなポリゴン）
  ('c04bdb2e-053c-4b9c-95c3-83db26492d7b', 'polygon', 
   '{"type":"Polygon","coordinates":[[[139.6917,35.7020],[139.7317,35.7020],[139.7317,35.6620],[139.6917,35.6620],[139.6917,35.7020]]]}',
   '{"_shapeId":"c04bdb2e-053c-4b9c-95c3-83db26492d7b","originalType":"Polygon"}',
   '2025-06-02 07:37:29.534', '2025-06-02 07:37:29.534'),
  
  -- 東京エリア（世田谷区全域をカバーする大きなポリゴン）
  ('a0bd1c29-5be9-480a-85e1-6823f232939a', 'polygon',
   '{"type":"Polygon","coordinates":[[[139.6117,35.6620],[139.6617,35.6620],[139.6617,35.6120],[139.6117,35.6120],[139.6117,35.6620]]]}',
   '{"originalType":"Polygon"}',
   '2025-06-11 21:29:03.136', '2025-06-11 21:29:03.136'),
  
  -- 福岡エリア（博多区周辺の大きなポリゴン）
  ('98388127-ea99-4659-acba-80b61b44fe23', 'polygon',
   '{"type":"Polygon","coordinates":[[[130.3900,33.6100],[130.4300,33.6100],[130.4300,33.5700],[130.3900,33.5700],[130.3900,33.6100]]]}',
   '{"originalType":"Polygon"}',
   '2025-06-10 14:06:46.592', '2025-06-10 14:06:46.592'),
  
  -- 岡山エリア（岡山市中心部の大きなポリゴン）
  ('74aa7806-69e4-4380-a642-ce31f47ecad9', 'polygon',
   '{"type":"Polygon","coordinates":[[[133.8900,34.6900],[133.9400,34.6900],[133.9400,34.6400],[133.8900,34.6400],[133.8900,34.6900]]]}',
   '{"originalType":"Polygon"}',
   '2025-06-11 13:51:46.686', '2025-06-11 13:51:46.686'),
  
  -- 大阪エリア（梅田周辺の大きなポリゴン）
  ('b1234567-89ab-cdef-0123-456789abcdef', 'polygon',
   '{"type":"Polygon","coordinates":[[[135.4800,34.7200],[135.5200,34.7200],[135.5200,34.6800],[135.4800,34.6800],[135.4800,34.7200]]]}',
   '{"originalType":"Polygon"}',
   '2025-06-12 10:15:00.000', '2025-06-12 10:15:00.000'),
  
  -- 名古屋エリア（名古屋駅周辺の大きなポリゴン）
  ('c2345678-90bc-def0-1234-567890bcdef0', 'polygon',
   '{"type":"Polygon","coordinates":[[[136.8600,35.1900],[136.9000,35.1900],[136.9000,35.1500],[136.8600,35.1500],[136.8600,35.1900]]]}',
   '{"originalType":"Polygon"}',
   '2025-06-13 15:30:45.123', '2025-06-13 15:30:45.123'),
  
  -- テキストタイプのエントリ（東京エリア）
  ('f5678901-23ef-0123-4567-890123ef0123', 'text',
   '{"type":"Point","coordinates":[139.6950,35.6950]}',
   '{"text":"新宿エリア","originalType":"Text"}',
   '2025-06-14 09:30:00.000', '2025-06-14 09:30:00.000'),
  
  ('17890123-4501-2345-6789-012345012345', 'text',
   '{"type":"Point","coordinates":[139.6350,35.6350]}',
   '{"text":"世田谷区","originalType":"Text"}',
   '2025-06-14 10:00:00.000', '2025-06-14 10:00:00.000');

-- ポスター掲示板の情報

INSERT INTO poster_boards (name, lat, long, prefecture, status, number, address, city) VALUES
-- Tokyo boards
('東京駅前掲示板', 35.6812, 139.7671, '東京都', 'not_yet', '10-1', '千代田区丸の内1-9-1', '千代田区'),
('新宿駅南口掲示板', 35.6896, 139.7006, '東京都', 'done', '10-2', '新宿区新宿3-38-1', '新宿区'),
('渋谷駅ハチ公前掲示板', 35.6590, 139.7005, '東京都', 'done', '10-3', '渋谷区道玄坂2-1', '渋谷区'),
('池袋駅東口掲示板', 35.7295, 139.7104, '東京都', 'not_yet', '10-4', '豊島区南池袋1-28-2', '豊島区'),
('上野駅公園口掲示板', 35.7141, 139.7774, '東京都', 'reserved', '10-5', '台東区上野7-1-1', '台東区'),

-- Osaka boards
('大阪駅前掲示板', 34.7024, 135.4959, '大阪府', 'not_yet', '27-1', '北区梅田3-1-1', '大阪市北区'),
('なんば駅前掲示板', 34.6666, 135.5011, '大阪府', 'done', '27-2', '中央区難波5-1-60', '大阪市中央区'),
('天王寺駅前掲示板', 34.6465, 135.5133, '大阪府', 'error_damaged', '27-3', '天王寺区悲田院町10-45', '大阪市天王寺区'),

-- Kyoto boards (Note: Kyoto is not in the prefecture_enum, using nearby osaka)
('京都駅前掲示板', 34.9859, 135.7585, '大阪府', 'done', '27-4', '下京区烏丸通塩小路下る', '京都市下京区'),
('四条河原町掲示板', 35.0034, 135.7689, '大阪府', 'done', '27-5', '中京区河原町四条上る', '京都市中京区'),

-- Hokkaido boards
('札幌駅前掲示板', 43.0687, 141.3507, '北海道', 'not_yet', '01-1', '北区北七条西4丁目', '札幌市北区'),
('すすきの交差点掲示板', 43.0556, 141.3529, '北海道', 'reserved', '01-2', '中央区南四条西4丁目', '札幌市中央区'),

-- Fukuoka boards
('博多駅前掲示板', 33.5903, 130.4208, '福岡県', 'done', '40-1', '博多区博多駅中央街1-1', '福岡市博多区'),
('天神駅前掲示板', 33.5911, 130.3983, '福岡県', 'not_yet', '40-2', '中央区天神2丁目11-1', '福岡市中央区')
ON CONFLICT DO NOTHING;

-- eNPS質問（運用文言・5問。マイグレーション後も db reset で最新に揃える）
INSERT INTO enps_questions (id, question_text, question_type, display_order, is_required, is_active, parent_question_id)
VALUES
  (
    '11111111-1111-1111-1111-111111111111',
    'あなたの家族や友人から「MMグループで働きたい」と言われた時、推奨する度合いはどのくらいですか？ 10点満点で回答ください。',
    'score_0_10',
    1,
    true,
    true,
    NULL
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    'Q1でその点数を付けた理由について、10点との差分埋めるにはどうしたらいいと思うかを記載ください。(10点の方はその理由を記載ください。)',
    'text',
    2,
    true,
    true,
    '11111111-1111-1111-1111-111111111111'
  ),
  (
    '33333333-3333-3333-3333-333333333333',
    'あなたの家族や友人から「所属会社で働きたい」と言われた時、推奨する度合いはどのくらいですか？ 10点満点で回答ください。',
    'score_0_10',
    3,
    true,
    true,
    NULL
  ),
  (
    '44444444-4444-4444-4444-444444444444',
    'Q3でその点数を付けた理由について、10点との差分埋めるにはどうしたらいいと思うかを記載ください。(10点の方はその理由を記載ください。)',
    'text',
    4,
    true,
    true,
    '33333333-3333-3333-3333-333333333333'
  ),
  (
    '55555555-5555-5555-5555-555555555555',
    '「eNPSアンケートをグループ全体に対してなぜやっているか」自分なりの今の考え・回答を教えてください。',
    'text',
    5,
    true,
    true,
    NULL
  )
ON CONFLICT (id) DO UPDATE SET
  question_text = EXCLUDED.question_text,
  question_type = EXCLUDED.question_type,
  display_order = EXCLUDED.display_order,
  is_required = EXCLUDED.is_required,
  is_active = EXCLUDED.is_active,
  parent_question_id = EXCLUDED.parent_question_id,
  updated_at = now();

-- eNPSアンケートのシードデータ
-- アンケート定義（3ヶ月分）
INSERT INTO enps_surveys (id, title, description, year_month, start_date, end_date, is_active, slack_notified_at)
VALUES
  -- 2025年12月度（終了済み）
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '月次NPSアンケート / 2025年12月度',
    '月次のeNPSについてのアンケートです！詳細は社内報をご確認ください！5分程度で済むかと思いますので、忌憚なきご意見をお願いいたします！',
    '2025-12',
    '2025-12-01T00:00:00Z',
    '2025-12-31T23:59:59Z',
    true,
    '2025-11-25T10:00:00Z'
  ),
  -- 2026年1月度（実施中）
  (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    '月次NPSアンケート / 2026年1月度',
    '月次のeNPSについてのアンケートです！詳細は社内報をご確認ください！5分程度で済むかと思いますので、忌憚なきご意見をお願いいたします！',
    '2026-01',
    '2026-01-01T00:00:00Z',
    '2026-01-31T23:59:59Z',
    true,
    '2025-12-25T10:00:00Z'
  ),
  -- 2026年2月度（未開始）
  (
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    '月次NPSアンケート / 2026年2月度',
    '月次のeNPSについてのアンケートです！詳細は社内報をご確認ください！5分程度で済むかと思いますので、忌憚なきご意見をお願いいたします！',
    '2026-02',
    '2026-02-01T00:00:00Z',
    '2026-02-28T23:59:59Z',
    true,
    NULL
  )
ON CONFLICT (id) DO NOTHING;

-- 2026年1月度の回答データ（10名分、各5問）
-- 推奨者 (9-10点): 4名
-- 中立者 (7-8点): 3名
-- 批判者 (0-6点): 3名
-- NPS = (40% - 30%) = +10

INSERT INTO enps_responses (survey_id, user_id, question_id, score_value, text_value, created_at)
VALUES
  -- ユーザー1: 推奨者 (10点)
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', '11111111-1111-1111-1111-111111111111', 10, NULL, '2026-01-05T10:00:00Z'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', '22222222-2222-2222-2222-222222222222', NULL, '素晴らしい職場環境で、チームワークも良好です。特に福利厚生が充実している点が魅力です。', '2026-01-05T10:00:00Z'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', '33333333-3333-3333-3333-333333333333', 9, NULL, '2026-01-05T10:00:00Z'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', '44444444-4444-4444-4444-444444444444', NULL, '成長機会が多く、やりがいのある仕事ができています。', '2026-01-05T10:00:00Z'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', '55555555-5555-5555-5555-555555555555', NULL, '組織の温度感を把握し、改善につなげるためだと理解しています。', '2026-01-05T10:00:00Z'),

  -- ユーザー2: 推奨者 (9点)
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'b2c3d4e5-f6a7-8901-bcde-f23456789012', '11111111-1111-1111-1111-111111111111', 9, NULL, '2026-01-06T11:00:00Z'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'b2c3d4e5-f6a7-8901-bcde-f23456789012', '22222222-2222-2222-2222-222222222222', NULL, '良い環境ですが、コミュニケーションの改善の余地があります。', '2026-01-06T11:00:00Z'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'b2c3d4e5-f6a7-8901-bcde-f23456789012', '33333333-3333-3333-3333-333333333333', 10, NULL, '2026-01-06T11:00:00Z'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'b2c3d4e5-f6a7-8901-bcde-f23456789012', '44444444-4444-4444-4444-444444444444', NULL, '所属会社は非常に良い環境で、満足しています。', '2026-01-06T11:00:00Z'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'b2c3d4e5-f6a7-8901-bcde-f23456789012', '55555555-5555-5555-5555-555555555555', NULL, '全社で働きがいの定点観測をして、経営と現場のギャップを減らすためだと思います。', '2026-01-06T11:00:00Z'),

  -- ユーザー3: 推奨者 (10点)
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'c3d4e5f6-a7b8-9012-cdef-345678901234', '11111111-1111-1111-1111-111111111111', 10, NULL, '2026-01-07T12:00:00Z'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'c3d4e5f6-a7b8-9012-cdef-345678901234', '22222222-2222-2222-2222-222222222222', NULL, '最高の職場です。働きやすさと成長機会のバランスが取れています。', '2026-01-07T12:00:00Z'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'c3d4e5f6-a7b8-9012-cdef-345678901234', '33333333-3333-3333-3333-333333333333', 9, NULL, '2026-01-07T12:00:00Z'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'c3d4e5f6-a7b8-9012-cdef-345678901234', '44444444-4444-4444-4444-444444444444', NULL, '良い環境ですが、もう少し柔軟な働き方ができるとさらに良いです。', '2026-01-07T12:00:00Z'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'c3d4e5f6-a7b8-9012-cdef-345678901234', '55555555-5555-5555-5555-555555555555', NULL, '従業員体験を可視化し、施策の優先順位を決める材料にしているのではないかと感じます。', '2026-01-07T12:00:00Z'),

  -- ユーザー4: 推奨者 (9点)
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'd4e5f6a7-b8c9-d0e1-f234-567890123456', '11111111-1111-1111-1111-111111111111', 9, NULL, '2026-01-08T13:00:00Z'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'd4e5f6a7-b8c9-d0e1-f234-567890123456', '22222222-2222-2222-2222-222222222222', NULL, '全体的に良いですが、ワークライフバランスの改善を期待します。', '2026-01-08T13:00:00Z'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'd4e5f6a7-b8c9-d0e1-f234-567890123456', '33333333-3333-3333-3333-333333333333', 8, NULL, '2026-01-08T13:00:00Z'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'd4e5f6a7-b8c9-d0e1-f234-567890123456', '44444444-4444-4444-4444-444444444444', NULL, '所属会社は良いですが、もう少し成長機会があると良いです。', '2026-01-08T13:00:00Z'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'd4e5f6a7-b8c9-d0e1-f234-567890123456', '55555555-5555-5555-5555-555555555555', NULL, 'グループ横断で比較し、各社が学び合うためのきっかけになっていると思います。', '2026-01-08T13:00:00Z'),

  -- ユーザー5: 中立者 (8点)
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'e5f6a7b8-c9d0-e1f2-3456-789012345678', '11111111-1111-1111-1111-111111111111', 8, NULL, '2026-01-09T14:00:00Z'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'e5f6a7b8-c9d0-e1f2-3456-789012345678', '22222222-2222-2222-2222-222222222222', NULL, '良い点もありますが、改善の余地があります。特にコミュニケーションと意思決定プロセスの透明性を高めると良いと思います。', '2026-01-09T14:00:00Z'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'e5f6a7b8-c9d0-e1f2-3456-789012345678', '33333333-3333-3333-3333-333333333333', 7, NULL, '2026-01-09T14:00:00Z'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'e5f6a7b8-c9d0-e1f2-3456-789012345678', '44444444-4444-4444-4444-444444444444', NULL, '所属会社は普通ですが、もう少し柔軟性があると良いです。', '2026-01-09T14:00:00Z'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'e5f6a7b8-c9d0-e1f2-3456-789012345678', '55555555-5555-5555-5555-555555555555', NULL, '経営と現場の対話の土台をつくるため、という認識です。', '2026-01-09T14:00:00Z'),

  -- ユーザー6: 中立者 (7点)
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'f6a7b8c9-d0e1-f234-5678-901234567890', '11111111-1111-1111-1111-111111111111', 7, NULL, '2026-01-10T15:00:00Z'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'f6a7b8c9-d0e1-f234-5678-901234567890', '22222222-2222-2222-2222-222222222222', NULL, '改善が必要な点がいくつかあります。特にプロジェクト管理とリソース配分の見直しが必要です。', '2026-01-10T15:00:00Z'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'f6a7b8c9-d0e1-f234-5678-901234567890', '33333333-3333-3333-3333-333333333333', 8, NULL, '2026-01-10T15:00:00Z'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'f6a7b8c9-d0e1-f234-5678-901234567890', '44444444-4444-4444-4444-444444444444', NULL, '所属会社は悪くないですが、もっとチャレンジングな機会があると良いです。', '2026-01-10T15:00:00Z'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'f6a7b8c9-d0e1-f234-5678-901234567890', '55555555-5555-5555-5555-555555555555', NULL, '離職やエンゲージメントの早期検知につなげたいのだと考えています。', '2026-01-10T15:00:00Z'),

  -- ユーザー7: 中立者 (8点)
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11223344-5566-7788-99aa-bbccddeeff00', '11111111-1111-1111-1111-111111111111', 8, NULL, '2026-01-11T16:00:00Z'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11223344-5566-7788-99aa-bbccddeeff00', '22222222-2222-2222-2222-222222222222', NULL, '良い環境ですが、もっと多様性と包括性を高めると良いと思います。', '2026-01-11T16:00:00Z'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11223344-5566-7788-99aa-bbccddeeff00', '33333333-3333-3333-3333-333333333333', 7, NULL, '2026-01-11T16:00:00Z'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11223344-5566-7788-99aa-bbccddeeff00', '44444444-4444-4444-4444-444444444444', NULL, '所属会社は普通ですが、もっと明確なキャリアパスがあると良いです。', '2026-01-11T16:00:00Z'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11223344-5566-7788-99aa-bbccddeeff00', '55555555-5555-5555-5555-555555555555', NULL, '数字でトレンドを追い、改善サイクルを回すためだと理解しています。', '2026-01-11T16:00:00Z'),

  -- ユーザー8: 批判者 (6点)
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'b2c3d4e5-f6a7-2345-6789-012345678901', '11111111-1111-1111-1111-111111111111', 6, NULL, '2026-01-12T17:00:00Z'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'b2c3d4e5-f6a7-2345-6789-012345678901', '22222222-2222-2222-2222-222222222222', NULL, '改善が必要な点が多くあります。特に意思決定プロセスの遅さと、情報共有の不足が課題です。', '2026-01-12T17:00:00Z'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'b2c3d4e5-f6a7-2345-6789-012345678901', '33333333-3333-3333-3333-333333333333', 5, NULL, '2026-01-12T17:00:00Z'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'b2c3d4e5-f6a7-2345-6789-012345678901', '44444444-4444-4444-4444-444444444444', NULL, '所属会社は改善の余地が大きいです。特にマネジメントスタイルと組織文化の見直しが必要です。', '2026-01-12T17:00:00Z'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'b2c3d4e5-f6a7-2345-6789-012345678901', '55555555-5555-5555-5555-555555555555', NULL, '声を拾い、具体的なアクションに落とし込むための仕組みだと思います。', '2026-01-12T17:00:00Z'),

  -- ユーザー9: 批判者 (5点)
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'c3d4e5f6-a7b8-3456-789a-123456789012', '11111111-1111-1111-1111-111111111111', 5, NULL, '2026-01-13T18:00:00Z'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'c3d4e5f6-a7b8-3456-789a-123456789012', '22222222-2222-2222-2222-222222222222', NULL, '多くの課題があります。特にワークライフバランス、給与、成長機会の不足が問題です。', '2026-01-13T18:00:00Z'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'c3d4e5f6-a7b8-3456-789a-123456789012', '33333333-3333-3333-3333-333333333333', 4, NULL, '2026-01-13T18:00:00Z'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'c3d4e5f6-a7b8-3456-789a-123456789012', '44444444-4444-4444-4444-444444444444', NULL, '所属会社は大きな改善が必要です。特に組織構造とマネジメントの見直しが急務です。', '2026-01-13T18:00:00Z'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'c3d4e5f6-a7b8-3456-789a-123456789012', '55555555-5555-5555-5555-555555555555', NULL, 'グループ全体の方向性と現場感覚をすり合わせるためではないかと感じます。', '2026-01-13T18:00:00Z'),

  -- ユーザー10: 批判者 (4点)
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'd4e5f6a7-b8c9-4567-89ab-234567890123', '11111111-1111-1111-1111-111111111111', 4, NULL, '2026-01-14T19:00:00Z'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'd4e5f6a7-b8c9-4567-89ab-234567890123', '22222222-2222-2222-2222-222222222222', NULL, '深刻な問題が複数あります。特にコミュニケーション、意思決定、リソース配分の見直しが必要です。', '2026-01-14T19:00:00Z'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'd4e5f6a7-b8c9-4567-89ab-234567890123', '33333333-3333-3333-3333-333333333333', 3, NULL, '2026-01-14T19:00:00Z'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'd4e5f6a7-b8c9-4567-89ab-234567890123', '44444444-4444-4444-4444-444444444444', NULL, '所属会社は大幅な改善が必要です。組織文化とマネジメントスタイルの根本的な見直しが求められます。', '2026-01-14T19:00:00Z'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'd4e5f6a7-b8c9-4567-89ab-234567890123', '55555555-5555-5555-5555-555555555555', NULL, '透明性を高め、改善の優先順位を議論するためのインプットだと考えています。', '2026-01-14T19:00:00Z')
ON CONFLICT (survey_id, user_id, question_id) DO NOTHING;
