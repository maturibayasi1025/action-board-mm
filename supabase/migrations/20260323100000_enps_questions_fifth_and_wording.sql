-- eNPS: 5問目追加 & 質問文を運用画面（画像）の文言に揃える

UPDATE enps_questions
SET
    question_text = 'あなたの家族や友人から「MMグループで働きたい」と言われた時、推奨する度合いはどのくらいですか？ 10点満点で回答ください。',
    updated_at = now()
WHERE id = '11111111-1111-1111-1111-111111111111';

UPDATE enps_questions
SET
    question_text = 'Q1でその点数を付けた理由について、10点との差分埋めるにはどうしたらいいと思うかを記載ください。(10点の方はその理由を記載ください。)',
    updated_at = now()
WHERE id = '22222222-2222-2222-2222-222222222222';

UPDATE enps_questions
SET
    question_text = 'あなたの家族や友人から「所属会社で働きたい」と言われた時、推奨する度合いはどのくらいですか？ 10点満点で回答ください。',
    updated_at = now()
WHERE id = '33333333-3333-3333-3333-333333333333';

UPDATE enps_questions
SET
    question_text = 'Q3でその点数を付けた理由について、10点との差分埋めるにはどうしたらいいと思うかを記載ください。(10点の方はその理由を記載ください。)',
    updated_at = now()
WHERE id = '44444444-4444-4444-4444-444444444444';

INSERT INTO enps_questions (id, question_text, question_type, display_order, is_required, is_active, parent_question_id)
VALUES (
    '55555555-5555-5555-5555-555555555555',
    '「eNPSアンケートをグループ全体に対してなぜやっているか」自分なりの今の考え・回答を教えてください。',
    'text',
    5,
    true,
    true,
    NULL
)
ON CONFLICT (id) DO NOTHING;
