-- XPトランザクション挿入時にuser_levelsを自動更新するトリガーを作成

-- XP合計を計算してuser_levelsを更新する関数
CREATE OR REPLACE FUNCTION update_user_xp_and_level()
RETURNS TRIGGER AS $$
BEGIN
    -- user_levelsテーブルのXPを更新（XPトランザクションの合計を計算）
    INSERT INTO user_levels (user_id, xp, level, updated_at)
    VALUES (
        NEW.user_id,
        COALESCE((
            SELECT SUM(xp_amount) 
            FROM xp_transactions 
            WHERE user_id = NEW.user_id
        ), 0),
        1, -- 基本レベル（レベル計算ロジックは別途実装）
        now()
    )
    ON CONFLICT (user_id)
    DO UPDATE SET
        xp = COALESCE((
            SELECT SUM(xp_amount) 
            FROM xp_transactions 
            WHERE user_id = NEW.user_id
        ), 0),
        level = CASE 
            WHEN EXCLUDED.xp >= 1000 THEN 11
            WHEN EXCLUDED.xp >= 900 THEN 10
            WHEN EXCLUDED.xp >= 800 THEN 9
            WHEN EXCLUDED.xp >= 700 THEN 8
            WHEN EXCLUDED.xp >= 600 THEN 7
            WHEN EXCLUDED.xp >= 500 THEN 6
            WHEN EXCLUDED.xp >= 400 THEN 5
            WHEN EXCLUDED.xp >= 300 THEN 4
            WHEN EXCLUDED.xp >= 200 THEN 3
            WHEN EXCLUDED.xp >= 100 THEN 2
            ELSE 1
        END,
        updated_at = now();

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- XPトランザクション挿入時のトリガー
CREATE TRIGGER xp_transaction_update_user_level
    AFTER INSERT ON xp_transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_user_xp_and_level();

-- コメント
COMMENT ON FUNCTION update_user_xp_and_level() IS 'XPトランザクション挿入時にuser_levelsのXP合計とレベルを自動更新';
COMMENT ON TRIGGER xp_transaction_update_user_level ON xp_transactions IS 'XPトランザクション挿入時にuser_levelsを自動更新するトリガー';