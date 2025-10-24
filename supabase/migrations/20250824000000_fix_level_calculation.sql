-- レベル計算の不一致を修正するマイグレーション
-- 問題: データベーストリガーとアプリケーションコードでレベル計算式が異なる
-- 解決: アプリケーション側の計算式をPostgreSQL関数として実装し、トリガーで使用する

-- レベルLに到達するために必要な累計XPを計算する関数
-- アプリケーション側の totalXp(L) = (L - 1) * (25 + 7.5 * L) と同じ式
CREATE OR REPLACE FUNCTION total_xp_for_level(level INTEGER)
RETURNS INTEGER AS $$
BEGIN
    IF level < 1 THEN
        RETURN 0;
    END IF;
    
    -- (L - 1) * (25 + 15/2 * L)
    RETURN (level - 1) * (25 + 15.0 / 2.0 * level);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION total_xp_for_level(INTEGER) IS 
'レベルLに到達するために必要な累計XPを計算（アプリケーション側のtotalXp関数と同じ式）';

-- XPからレベルを計算する関数
-- アプリケーション側の calculateLevel(xp) と同じロジック
CREATE OR REPLACE FUNCTION calculate_level_from_xp(xp INTEGER)
RETURNS INTEGER AS $$
DECLARE
    current_level INTEGER := 1;
    max_level INTEGER := 1000;
    required_xp INTEGER;
BEGIN
    IF xp < 0 THEN
        RETURN 1;
    END IF;
    
    -- レベル1から順に、必要XPを超えるレベルを探す
    FOR current_level IN 1..max_level LOOP
        required_xp := total_xp_for_level(current_level + 1);
        IF xp < required_xp THEN
            RETURN current_level;
        END IF;
    END LOOP;
    
    RETURN max_level;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION calculate_level_from_xp(INTEGER) IS 
'XP量からレベルを逆算する関数（アプリケーション側のcalculateLevel関数と同じロジック）';

-- XP合計を計算してuser_levelsを更新する関数（修正版）
CREATE OR REPLACE FUNCTION update_user_xp_and_level()
RETURNS TRIGGER AS $$
DECLARE
    calculated_xp INTEGER;
    calculated_level INTEGER;
BEGIN
    -- XPトランザクションの合計を計算
    calculated_xp := COALESCE((
        SELECT SUM(xp_amount) 
        FROM xp_transactions 
        WHERE user_id = NEW.user_id
    ), 0);
    
    -- XPからレベルを計算（新しい関数を使用）
    calculated_level := calculate_level_from_xp(calculated_xp);
    
    -- user_levelsテーブルのXPとレベルを更新
    INSERT INTO user_levels (user_id, xp, level, updated_at)
    VALUES (
        NEW.user_id,
        calculated_xp,
        calculated_level,
        now()
    )
    ON CONFLICT (user_id)
    DO UPDATE SET
        xp = calculated_xp,
        level = calculated_level,
        updated_at = now();

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_user_xp_and_level() IS 
'XPトランザクション挿入時にuser_levelsのXP合計とレベルを自動更新（修正版：正しい計算式を使用）';

-- 既存データの修正: 全ユーザーのレベルを正しい値に再計算
DO $$
DECLARE
    user_record RECORD;
    total_user_xp INTEGER;
    correct_level INTEGER;
BEGIN
    -- 各ユーザーについてXPとレベルを再計算
    FOR user_record IN 
        SELECT DISTINCT user_id 
        FROM xp_transactions
    LOOP
        -- ユーザーの総XPを計算
        SELECT COALESCE(SUM(xp_amount), 0) INTO total_user_xp
        FROM xp_transactions
        WHERE user_id = user_record.user_id;
        
        -- 正しいレベルを計算
        correct_level := calculate_level_from_xp(total_user_xp);
        
        -- user_levelsを更新
        INSERT INTO user_levels (user_id, xp, level, updated_at)
        VALUES (
            user_record.user_id,
            total_user_xp,
            correct_level,
            now()
        )
        ON CONFLICT (user_id)
        DO UPDATE SET
            xp = total_user_xp,
            level = correct_level,
            updated_at = now();
    END LOOP;
    
    RAISE NOTICE '全ユーザーのレベルを正しい値に再計算しました';
END $$;

