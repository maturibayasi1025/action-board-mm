-- MCP 公開ツールは cookie なしの anon クライアントで期間別ランキング RPC を呼ぶ。
-- 既存 GRANT は authenticated のみのため、period=daily が失敗していた。
GRANT EXECUTE ON FUNCTION get_period_ranking TO anon;
GRANT EXECUTE ON FUNCTION get_period_mission_ranking TO anon;
GRANT EXECUTE ON FUNCTION get_period_likes_ranking TO anon;
GRANT EXECUTE ON FUNCTION get_period_prefecture_ranking TO anon;
