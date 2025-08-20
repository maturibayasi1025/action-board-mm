-- user_levelsテーブルにINSERT/UPDATEポリシーを追加

-- トリガー実行時のINSERT/UPSERT用ポリシー
CREATE POLICY "System can insert and update user levels"
    ON user_levels
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- コメント
COMMENT ON POLICY "System can insert and update user levels" ON user_levels
IS 'システム（トリガー）がuser_levelsを挿入・更新可能';