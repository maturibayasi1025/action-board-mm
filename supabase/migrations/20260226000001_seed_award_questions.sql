-- 表彰アンケートの初期質問データ（固定IDを使用）
-- セクション表示順: 夢中になってやり切る → 至高な人間関係を → 幸せの循環 → チーム/組織のバリュー体現

-- ============================================================
-- セクション1: 夢中になってやり切る (passionate_execution)
-- ============================================================

-- Q1: 自分のエピソード（textarea）
INSERT INTO award_questions (id, question_text, question_type, question_group, display_order, is_required, is_active, placeholder, help_text)
VALUES (
    'ae000001-0000-0000-0000-000000000001',
    '自分が今月で【夢中になってやり切る】を体現できていたと感じるエピソードを教えてください。',
    'textarea',
    'passionate_execution',
    1,
    true,
    true,
    '（例）「△△という価値観があるからこそ、○○という決断をして、□□を夢中になって取り組んだ。その結果××を実現することが出来た！」',
    'キーワード＝"夢中になる" "自己決定" "自己実現"'
)
ON CONFLICT (id) DO NOTHING;

-- Q2: 他者指名（text）
INSERT INTO award_questions (id, question_text, question_type, question_group, display_order, is_required, is_active, placeholder, help_text)
VALUES (
    'ae000001-0000-0000-0000-000000000002',
    '今月で身の回りで最も【夢中になってやり切る】を体現できていた方を教えてください。',
    'text',
    'passionate_execution',
    2,
    true,
    true,
    'やまなかたかお',
    'スペースなし、ひらがなフルネームでお願いします！'
)
ON CONFLICT (id) DO NOTHING;

-- Q3: 理由（textarea）
INSERT INTO award_questions (id, question_text, question_type, question_group, display_order, is_required, is_active, placeholder, help_text)
VALUES (
    'ae000001-0000-0000-0000-000000000003',
    '上記理由を簡潔に教えてください。',
    'textarea',
    'passionate_execution',
    3,
    true,
    true,
    NULL,
    NULL
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- セクション2: 至高な人間関係を (supreme_relations)
-- ============================================================

-- Q4: 自分のエピソード（textarea）
INSERT INTO award_questions (id, question_text, question_type, question_group, display_order, is_required, is_active, placeholder, help_text)
VALUES (
    'ae000002-0000-0000-0000-000000000001',
    '自分が今月で【至高な人間関係を】を体現できていたと感じるエピソードを教えてください。',
    'textarea',
    'supreme_relations',
    4,
    true,
    true,
    '（例）「クライアントが○○という課題を抱えていたので、率先して××を着手した結果、□□に繋がり感謝の言葉をいただいた。そういう関わりがあったからこそ、今では△△でも繋がりを持ち続けられている」',
    'キーワード＝"他者貢献" "関わり方" "giver"'
)
ON CONFLICT (id) DO NOTHING;

-- Q5: 他者指名（text）
INSERT INTO award_questions (id, question_text, question_type, question_group, display_order, is_required, is_active, placeholder, help_text)
VALUES (
    'ae000002-0000-0000-0000-000000000002',
    '今月で身の回りで最も【至高な人間関係を】を体現できていたと感じる方を教えてください。',
    'text',
    'supreme_relations',
    5,
    true,
    true,
    'やまなかたかお',
    'スペースなし、ひらがなフルネームでお願いします！'
)
ON CONFLICT (id) DO NOTHING;

-- Q6: 理由（textarea）
INSERT INTO award_questions (id, question_text, question_type, question_group, display_order, is_required, is_active, placeholder, help_text)
VALUES (
    'ae000002-0000-0000-0000-000000000003',
    '上記理由を簡潔に教えてください。',
    'textarea',
    'supreme_relations',
    6,
    true,
    true,
    NULL,
    NULL
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- セクション3: 幸せの循環 (happiness_cycle)
-- ============================================================

-- Q7: 自分のエピソード（textarea）
INSERT INTO award_questions (id, question_text, question_type, question_group, display_order, is_required, is_active, placeholder, help_text)
VALUES (
    'ae000003-0000-0000-0000-000000000001',
    '自分が今月で【幸せの循環】を体現できていたと感じるエピソードを教えてください。',
    'textarea',
    'happiness_cycle',
    7,
    true,
    true,
    '（例）「■■で周りの人を巻き込み○○という行動を起こした結果、その先の△△へ繋がり□□となった。」',
    'キーワード＝"幸せの追求" "幸福度向上" "挑戦の後押し"'
)
ON CONFLICT (id) DO NOTHING;

-- Q8: 他者指名（text）
INSERT INTO award_questions (id, question_text, question_type, question_group, display_order, is_required, is_active, placeholder, help_text)
VALUES (
    'ae000003-0000-0000-0000-000000000002',
    '今月で身の回りで最も【幸せの循環】を体現できていたと感じる方を教えてください。',
    'text',
    'happiness_cycle',
    8,
    true,
    true,
    'やまなかたかお',
    'スペースなし、ひらがなフルネームでお願いします！'
)
ON CONFLICT (id) DO NOTHING;

-- Q9: 理由（textarea）
INSERT INTO award_questions (id, question_text, question_type, question_group, display_order, is_required, is_active, placeholder, help_text)
VALUES (
    'ae000003-0000-0000-0000-000000000003',
    '上記理由を簡潔に教えてください。',
    'textarea',
    'happiness_cycle',
    9,
    true,
    true,
    NULL,
    NULL
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- セクション4: チーム/組織のバリュー体現 (team_value)
-- ============================================================

-- Q10: 自分チームのエピソード（textarea）
INSERT INTO award_questions (id, question_text, question_type, question_group, display_order, is_required, is_active, placeholder, help_text)
VALUES (
    'ae000004-0000-0000-0000-000000000001',
    '自分が関わっているチーム/プロジェクト/組織でバリュー体現が出来ていると感じることと、そのエピソードを教えてください。',
    'textarea',
    'team_value',
    10,
    true,
    true,
    '例）○○のお客さまを支援しているプロジェクトチームで■■をしたことで▲▲となり、幸せの循環に繋がった。',
    NULL
)
ON CONFLICT (id) DO NOTHING;

-- Q11: バリュー体現チーム（text）
INSERT INTO award_questions (id, question_text, question_type, question_group, display_order, is_required, is_active, placeholder, help_text)
VALUES (
    'ae000004-0000-0000-0000-000000000002',
    '周囲の他チームでバリュー体現を感じるチーム/プロジェクト/組織を教えてください。',
    'text',
    'team_value',
    11,
    true,
    true,
    NULL,
    NULL
)
ON CONFLICT (id) DO NOTHING;

-- Q12: 理由（textarea）
INSERT INTO award_questions (id, question_text, question_type, question_group, display_order, is_required, is_active, placeholder, help_text)
VALUES (
    'ae000004-0000-0000-0000-000000000003',
    '上記理由を簡潔に教えてください。',
    'textarea',
    'team_value',
    12,
    true,
    true,
    NULL,
    NULL
)
ON CONFLICT (id) DO NOTHING;
