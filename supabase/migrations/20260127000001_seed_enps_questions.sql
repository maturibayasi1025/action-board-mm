-- eNPSアンケートの初期質問データ（固定IDを使用）

-- 質問1: MMグループで働きたいと推奨する度合い（0-10点）
INSERT INTO enps_questions (id, question_text, question_type, display_order, is_required, is_active, parent_question_id)
VALUES (
    '11111111-1111-1111-1111-111111111111',
    'Q1. あなたの家族や友人から「MMグループで働きたい」と言われた時、推奨する度合いはどのくらいですか? 10点満点で回答ください。',
    'score_0_10',
    1,
    true,
    true,
    NULL
)
ON CONFLICT (id) DO NOTHING;

-- 質問2: Q1の理由と改善点（テキスト、親質問=Q1）
INSERT INTO enps_questions (id, question_text, question_type, display_order, is_required, is_active, parent_question_id)
VALUES (
    '22222222-2222-2222-2222-222222222222',
    'Q2. Q1でその点数を付けた理由について、10点との差分埋めるにはどうしたらいいと思うかを記載ください。(10点の方はその理由を記載ください。)',
    'text',
    2,
    true,
    true,
    '11111111-1111-1111-1111-111111111111'
)
ON CONFLICT (id) DO NOTHING;

-- 質問3: 所属会社で働きたいと推奨する度合い（0-10点）
INSERT INTO enps_questions (id, question_text, question_type, display_order, is_required, is_active, parent_question_id)
VALUES (
    '33333333-3333-3333-3333-333333333333',
    'Q3. あなたの家族や友人から「所属会社で働きたい」と言われた時、推奨する度合いはどのくらいですか? 10点満点で回答ください。',
    'score_0_10',
    3,
    true,
    true,
    NULL
)
ON CONFLICT (id) DO NOTHING;

-- 質問4: Q3の理由と改善点（テキスト、親質問=Q3）
INSERT INTO enps_questions (id, question_text, question_type, display_order, is_required, is_active, parent_question_id)
VALUES (
    '44444444-4444-4444-4444-444444444444',
    'Q4. Q3でその点数を付けた理由について、10点との差分埋めるにはどうしたらいいと思うかを記載ください。(10点の方はその理由を記載ください。)',
    'text',
    4,
    true,
    true,
    '33333333-3333-3333-3333-333333333333'
)
ON CONFLICT (id) DO NOTHING;
