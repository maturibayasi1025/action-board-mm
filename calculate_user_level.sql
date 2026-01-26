-- 特定のユーザーIDから現在のレベルを計算するSQL
-- 使用方法: 'YOUR_USER_ID_HERE' の部分を実際のユーザーIDに置き換えてください

-- 方法1: レベルと総XPの両方を取得
SELECT 
    'YOUR_USER_ID_HERE'::UUID AS user_id,
    COALESCE(SUM(xp_amount), 0) AS total_xp,
    calculate_level_from_xp(COALESCE(SUM(xp_amount), 0)) AS current_level
FROM xp_transactions
WHERE user_id = 'YOUR_USER_ID_HERE'::UUID;

-- 方法2: レベルのみを取得（シンプル版）
SELECT 
    calculate_level_from_xp(COALESCE(SUM(xp_amount), 0)) AS current_level
FROM xp_transactions
WHERE user_id = 'YOUR_USER_ID_HERE'::UUID;

-- 方法3: ユーザーが存在しない場合でもレベル1を返す（LEFT JOIN使用）
SELECT 
    COALESCE(
        calculate_level_from_xp(SUM(xt.xp_amount)), 
        1
    ) AS current_level
FROM (SELECT 'YOUR_USER_ID_HERE'::UUID AS user_id) AS u
LEFT JOIN xp_transactions xt ON xt.user_id = u.user_id
GROUP BY u.user_id;

-- 方法4: user_levelsテーブルから取得（既に計算済みの値を使用）
-- 注意: この方法はトリガーで更新された値を使用するため、最新のXPトランザクションが反映されていない可能性があります
SELECT 
    user_id,
    xp AS total_xp,
    level AS current_level,
    updated_at
FROM user_levels
WHERE user_id = 'YOUR_USER_ID_HERE'::UUID;
