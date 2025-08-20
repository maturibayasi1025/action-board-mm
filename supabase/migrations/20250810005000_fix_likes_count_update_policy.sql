-- user_missionsのlikes_count更新をシステム（トリガー）が実行できるようにポリシーを追加

-- システムがlikes_count列を更新可能にする専用ポリシー
CREATE POLICY "System can update likes count"
    ON user_missions
    FOR UPDATE
    USING (true)
    WITH CHECK (true);

-- コメント
COMMENT ON POLICY "System can update likes count" ON user_missions
IS 'システム（トリガー）がuser_missionsのlikes_countを更新可能';