-- ダッシュボード用の日別集計関数

CREATE OR REPLACE FUNCTION get_daily_user_mission_counts(
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ
)
RETURNS TABLE (
  date DATE,
  count BIGINT
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    (timezone('Asia/Tokyo', um.published_at))::DATE AS date,
    COUNT(*)::BIGINT AS count
  FROM user_missions um
  WHERE um.status = 'approved'
    AND um.published_at IS NOT NULL
    AND um.published_at >= p_start_date
    AND um.published_at < p_end_date
  GROUP BY (timezone('Asia/Tokyo', um.published_at))::DATE
  ORDER BY date;
$$;

CREATE OR REPLACE FUNCTION get_daily_user_mission_likes_counts(
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ
)
RETURNS TABLE (
  date DATE,
  count BIGINT
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    (timezone('Asia/Tokyo', uml.created_at))::DATE AS date,
    COUNT(*)::BIGINT AS count
  FROM user_mission_likes uml
  WHERE uml.created_at >= p_start_date
    AND uml.created_at < p_end_date
  GROUP BY (timezone('Asia/Tokyo', uml.created_at))::DATE
  ORDER BY date;
$$;

GRANT EXECUTE ON FUNCTION get_daily_user_mission_counts TO authenticated;
GRANT EXECUTE ON FUNCTION get_daily_user_mission_likes_counts TO authenticated;

COMMENT ON FUNCTION get_daily_user_mission_counts IS '指定期間の日別ユーザーグッジョブ投稿数を取得する関数';
COMMENT ON FUNCTION get_daily_user_mission_likes_counts IS '指定期間の日別いいね数を取得する関数';
