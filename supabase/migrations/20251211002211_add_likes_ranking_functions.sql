-- いいね数ランキング取得関数の追加

-- 全期間のいいね数ランキングを取得する関数
CREATE OR REPLACE FUNCTION get_likes_ranking(limit_count INTEGER DEFAULT 10)
RETURNS TABLE (
  user_id UUID,
  user_name TEXT,
  address_prefecture TEXT,
  rank BIGINT,
  likes_count BIGINT
)
LANGUAGE sql
STABLE
AS $$
  WITH user_likes_count AS (
    SELECT 
      uml.user_id,
      COUNT(*) as likes_count
    FROM user_mission_likes uml
    GROUP BY uml.user_id
  ),
  ranked_users AS (
    SELECT 
      ulc.user_id,
      pup.name as user_name,
      pup.address_prefecture,
      ulc.likes_count,
      ROW_NUMBER() OVER (ORDER BY ulc.likes_count DESC) as rank
    FROM user_likes_count ulc
    JOIN public_user_profiles pup ON pup.id = ulc.user_id
    WHERE ulc.likes_count > 0
  )
  SELECT 
    ranked_users.user_id,
    ranked_users.user_name,
    ranked_users.address_prefecture,
    ranked_users.rank,
    ranked_users.likes_count
  FROM ranked_users
  ORDER BY ranked_users.rank
  LIMIT limit_count;
$$;

-- 特定ユーザーのいいね数ランキング情報を取得する関数
CREATE OR REPLACE FUNCTION get_user_likes_ranking(target_user_id UUID)
RETURNS TABLE (
  user_id UUID,
  user_name TEXT,
  address_prefecture TEXT,
  rank BIGINT,
  likes_count BIGINT
)
LANGUAGE sql
STABLE
AS $$
  WITH user_likes_count AS (
    SELECT 
      uml.user_id,
      COUNT(*) as likes_count
    FROM user_mission_likes uml
    GROUP BY uml.user_id
  ),
  ranked_users AS (
    SELECT 
      ulc.user_id,
      pup.name as user_name,
      pup.address_prefecture,
      ulc.likes_count,
      ROW_NUMBER() OVER (ORDER BY ulc.likes_count DESC) as rank
    FROM user_likes_count ulc
    JOIN public_user_profiles pup ON pup.id = ulc.user_id
    WHERE ulc.likes_count > 0
  )
  SELECT 
    ranked_users.user_id,
    ranked_users.user_name,
    ranked_users.address_prefecture,
    ranked_users.rank,
    ranked_users.likes_count
  FROM ranked_users
  WHERE ranked_users.user_id = target_user_id
  ORDER BY ranked_users.rank;
$$;

-- 期間別のいいね数ランキングを取得する関数
CREATE OR REPLACE FUNCTION get_period_likes_ranking(
  p_limit INTEGER DEFAULT 10,
  p_start_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
  user_id UUID,
  user_name TEXT,
  address_prefecture TEXT,
  rank BIGINT,
  likes_count BIGINT
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  -- 期間指定がない場合は全期間の関数を使用
  IF p_start_date IS NULL THEN
    RETURN QUERY
    SELECT 
      lr.user_id::UUID,
      lr.user_name::TEXT,
      lr.address_prefecture::TEXT,
      lr.rank::BIGINT,
      lr.likes_count::BIGINT
    FROM get_likes_ranking(p_limit) lr;
  ELSE
    -- 期間指定がある場合は期間内のいいね数を集計
    RETURN QUERY
    WITH period_likes_count AS (
      SELECT 
        uml.user_id,
        COUNT(*) as likes_count
      FROM user_mission_likes uml
      WHERE uml.created_at >= p_start_date
      GROUP BY uml.user_id
    ),
    ranked_users AS (
      SELECT 
        plc.user_id,
        pup.name as user_name,
        pup.address_prefecture,
        plc.likes_count,
        ROW_NUMBER() OVER (ORDER BY plc.likes_count DESC) as rank
      FROM period_likes_count plc
      JOIN public_user_profiles pup ON pup.id = plc.user_id
      WHERE plc.likes_count > 0
    )
    SELECT 
      ru.user_id::UUID,
      ru.user_name::TEXT,
      ru.address_prefecture::TEXT,
      ru.rank::BIGINT,
      ru.likes_count::BIGINT
    FROM ranked_users ru
    ORDER BY ru.rank
    LIMIT p_limit;
  END IF;
END;
$$;

-- 特定ユーザーの期間別いいね数ランキング情報を取得する関数
CREATE OR REPLACE FUNCTION get_user_period_likes_ranking(
  p_user_id UUID,
  p_start_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
  user_id UUID,
  user_name TEXT,
  address_prefecture TEXT,
  rank BIGINT,
  likes_count BIGINT
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  -- 期間指定がない場合は全期間の関数を使用
  IF p_start_date IS NULL THEN
    RETURN QUERY
    SELECT 
      ulr.user_id::UUID,
      ulr.user_name::TEXT,
      ulr.address_prefecture::TEXT,
      ulr.rank::BIGINT,
      ulr.likes_count::BIGINT
    FROM get_user_likes_ranking(p_user_id) ulr;
  ELSE
    -- 期間指定がある場合
    RETURN QUERY
    WITH period_likes_count AS (
      SELECT 
        uml.user_id,
        COUNT(*) as likes_count
      FROM user_mission_likes uml
      WHERE uml.created_at >= p_start_date
      GROUP BY uml.user_id
    ),
    all_ranked_users AS (
      SELECT 
        plc.user_id,
        pup.name as user_name,
        pup.address_prefecture,
        plc.likes_count,
        ROW_NUMBER() OVER (ORDER BY plc.likes_count DESC) as rank
      FROM period_likes_count plc
      JOIN public_user_profiles pup ON pup.id = plc.user_id
      WHERE plc.likes_count > 0
    )
    SELECT 
      aru.user_id::UUID,
      aru.user_name::TEXT,
      aru.address_prefecture::TEXT,
      aru.rank::BIGINT,
      aru.likes_count::BIGINT
    FROM all_ranked_users aru
    WHERE aru.user_id = p_user_id;
  END IF;
END;
$$;

-- 関数の権限設定
GRANT EXECUTE ON FUNCTION get_likes_ranking TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_likes_ranking TO authenticated;
GRANT EXECUTE ON FUNCTION get_period_likes_ranking TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_period_likes_ranking TO authenticated;

COMMENT ON FUNCTION get_likes_ranking IS '全期間のいいね数ランキングを取得する関数';
COMMENT ON FUNCTION get_user_likes_ranking IS '特定ユーザーのいいね数ランキング情報を取得する関数';
COMMENT ON FUNCTION get_period_likes_ranking IS '期間別のいいね数ランキングを取得する関数';
COMMENT ON FUNCTION get_user_period_likes_ranking IS '特定ユーザーの期間別いいね数ランキング情報を取得する関数';
