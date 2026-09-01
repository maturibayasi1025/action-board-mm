-- ユーザー停止ステータス（ソフト停止）。XP・達成などの参照を残すため物理削除しない。
-- NULL = 有効、非NULL = 停止日時。

ALTER TABLE public.private_users
  ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ NULL;

ALTER TABLE public.public_user_profiles
  ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN public.private_users.suspended_at IS '停止日時。NULL は有効';
COMMENT ON COLUMN public.public_user_profiles.suspended_at IS '停止日時。NULL は有効（private_users から同期）';

CREATE INDEX IF NOT EXISTS public_user_profiles_active_id_idx
  ON public.public_user_profiles (id)
  WHERE suspended_at IS NULL;

CREATE INDEX IF NOT EXISTS private_users_suspended_at_idx
  ON public.private_users (id)
  WHERE suspended_at IS NOT NULL;

CREATE OR REPLACE FUNCTION public.is_active_user(uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.public_user_profiles
    WHERE id = uid
      AND suspended_at IS NULL
  );
$$;

COMMENT ON FUNCTION public.is_active_user(uuid) IS '停止されていない公開プロフィールが存在するかどうか';

-- private_users → public_user_profiles 同期に suspended_at を追加
CREATE OR REPLACE FUNCTION public.sync_public_user_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM set_config('my.is_trigger', 'true', true);

  INSERT INTO public.public_user_profiles (
    id,
    name,
    address_prefecture,
    x_username,
    avatar_url,
    created_at,
    business_unit_id,
    suspended_at
  )
  VALUES (
    NEW.id,
    NEW.name,
    NEW.address_prefecture,
    NEW.x_username,
    NEW.avatar_url,
    NEW.created_at,
    NEW.business_unit_id,
    NEW.suspended_at
  )
  ON CONFLICT (id) DO UPDATE
  SET
    name = EXCLUDED.name,
    address_prefecture = EXCLUDED.address_prefecture,
    x_username = EXCLUDED.x_username,
    avatar_url = EXCLUDED.avatar_url,
    created_at = EXCLUDED.created_at,
    business_unit_id = EXCLUDED.business_unit_id,
    suspended_at = EXCLUDED.suspended_at;

  PERFORM set_config('my.is_trigger', 'false', true);
  RETURN NEW;
END;
$$;

-- RLS: 一般ユーザーの SELECT から停止行を隠す（本人は users_can_manage_own_data で自分の行を読める）
DROP POLICY IF EXISTS select_all_public_user_profiles ON public.public_user_profiles;
CREATE POLICY select_all_public_user_profiles
  ON public.public_user_profiles FOR SELECT
  USING (suspended_at IS NULL);

DROP POLICY IF EXISTS "authenticated_users_can_view_basic_info" ON public.private_users;
CREATE POLICY "authenticated_users_can_view_basic_info" ON public.private_users
  FOR SELECT
  USING (auth.role() = 'authenticated' AND suspended_at IS NULL);

-- 一般ユーザーが自分の suspended_at を書き換えられないようにする
CREATE OR REPLACE FUNCTION public.protect_suspended_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.suspended_at IS NOT NULL AND auth.role() IS DISTINCT FROM 'service_role' THEN
    NEW.suspended_at := NULL;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.suspended_at IS DISTINCT FROM OLD.suspended_at AND auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'suspended_at can only be changed by service role';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_private_users_suspended_at ON public.private_users;
CREATE TRIGGER protect_private_users_suspended_at
  BEFORE INSERT OR UPDATE ON public.private_users
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_suspended_at();

-- ビュー: 停止ユーザーを除外して順位・件数を再計算
CREATE OR REPLACE VIEW public.user_ranking_view AS
SELECT
    ul.user_id,
    pup.name,
    pup.address_prefecture,
    ul.xp,
    ul.level,
    ul.updated_at,
    ROW_NUMBER() OVER (ORDER BY ul.xp DESC, ul.updated_at ASC) AS rank
FROM public.user_levels ul
JOIN public.public_user_profiles pup ON ul.user_id = pup.id
WHERE pup.suspended_at IS NULL
ORDER BY ul.xp DESC, ul.updated_at ASC;

CREATE OR REPLACE VIEW public.activity_timeline_view AS
SELECT
  a.id,
  p.id AS user_id,
  p.name,
  p.address_prefecture,
  p.avatar_url,
  m.title,
  a.created_at
FROM public.achievements a
JOIN public.public_user_profiles p ON a.user_id = p.id
JOIN public.missions m ON a.mission_id = m.id
WHERE p.suspended_at IS NULL;

CREATE OR REPLACE VIEW public.mission_achievement_count_view AS
SELECT
  m.id AS mission_id,
  COUNT(a.id) FILTER (WHERE p.suspended_at IS NULL) AS achievement_count
FROM public.missions m
LEFT JOIN public.achievements a ON m.id = a.mission_id
LEFT JOIN public.public_user_profiles p ON p.id = a.user_id
GROUP BY m.id;

-- ランキング RPC: 停止ユーザーを除外
CREATE OR REPLACE FUNCTION public.get_period_ranking(
    p_limit integer DEFAULT 100,
    p_start_date timestamp with time zone DEFAULT NULL,
    p_end_date timestamp with time zone DEFAULT NULL
)
RETURNS TABLE (
    user_id uuid,
    address_prefecture text,
    level integer,
    name text,
    rank bigint,
    updated_at timestamptz,
    xp bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH period_xp AS (
        SELECT
            xt.user_id,
            SUM(xt.xp_amount) as total_xp
        FROM xp_transactions xt
        WHERE
            (p_start_date IS NULL OR xt.created_at >= p_start_date)
            AND (p_end_date IS NULL OR xt.created_at < p_end_date)
        GROUP BY xt.user_id
    ),
    ranked_users AS (
        SELECT
            px.user_id,
            pup.address_prefecture::text,
            COALESCE(ul.level, 1)::integer as level,
            pup.name::text,
            RANK() OVER (ORDER BY px.total_xp DESC)::bigint as rank,
            COALESCE(ul.updated_at, now())::timestamptz as updated_at,
            px.total_xp::bigint as xp
        FROM period_xp px
        JOIN public_user_profiles pup ON pup.id = px.user_id
        LEFT JOIN user_levels ul ON ul.user_id = px.user_id
        WHERE pup.suspended_at IS NULL
    )
    SELECT
        ru.user_id,
        ru.address_prefecture,
        ru.level,
        ru.name,
        ru.rank,
        ru.updated_at,
        ru.xp
    FROM ranked_users ru
    WHERE ru.rank <= p_limit
    ORDER BY ru.rank;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_user_period_ranking(
    target_user_id UUID,
    start_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
    user_id UUID,
    address_prefecture TEXT,
    level INTEGER,
    name TEXT,
    rank BIGINT,
    updated_at TIMESTAMPTZ,
    xp BIGINT
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
    IF start_date IS NULL THEN
        RETURN QUERY
        SELECT
            urv.user_id::UUID,
            urv.address_prefecture::TEXT,
            urv.level::INTEGER,
            urv.name::TEXT,
            urv.rank::BIGINT,
            urv.updated_at::TIMESTAMPTZ,
            urv.xp::BIGINT
        FROM user_ranking_view urv
        WHERE urv.user_id = target_user_id;
    ELSE
        RETURN QUERY
        WITH period_xp AS (
            SELECT
                xt.user_id,
                SUM(xt.xp_amount) AS period_xp_total
            FROM xp_transactions xt
            WHERE xt.created_at >= start_date
            GROUP BY xt.user_id
        ),
        all_ranked_users AS (
            SELECT
                px.user_id,
                pup.address_prefecture,
                ul.level,
                pup.name,
                ROW_NUMBER() OVER (ORDER BY px.period_xp_total DESC) AS rank,
                ul.updated_at,
                px.period_xp_total AS xp
            FROM period_xp px
            JOIN public_user_profiles pup ON pup.id = px.user_id
            JOIN user_levels ul ON ul.user_id = px.user_id
            WHERE px.period_xp_total > 0
              AND pup.suspended_at IS NULL
        )
        SELECT
            aru.user_id::UUID,
            aru.address_prefecture::TEXT,
            aru.level::INTEGER,
            aru.name::TEXT,
            aru.rank::BIGINT,
            aru.updated_at::TIMESTAMPTZ,
            aru.xp::BIGINT
        FROM all_ranked_users aru
        WHERE aru.user_id = target_user_id;
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_prefecture_ranking(prefecture text, limit_count integer default 10)
RETURNS table (
  user_id uuid,
  user_name text,
  address_prefecture text,
  rank bigint,
  level integer,
  xp integer,
  updated_at timestamptz
) LANGUAGE sql AS $$
  WITH ranked_users AS (
    SELECT
      u.id AS user_id,
      u.name AS user_name,
      u.address_prefecture,
      coalesce(r.level, 1) AS level,
      coalesce(r.xp, 0) AS xp,
      r.updated_at,
      rank() OVER (ORDER BY coalesce(r.xp, 0) DESC, r.updated_at DESC) AS rank
    FROM public_user_profiles u
    LEFT JOIN user_ranking_view r ON u.id = r.user_id
    WHERE u.address_prefecture = get_prefecture_ranking.prefecture
      AND u.suspended_at IS NULL
      AND coalesce(r.xp, 0) > 0
  )
  SELECT
    ranked_users.user_id,
    ranked_users.user_name,
    ranked_users.address_prefecture,
    ranked_users.rank,
    ranked_users.level,
    ranked_users.xp,
    ranked_users.updated_at
  FROM ranked_users
  ORDER BY ranked_users.rank
  LIMIT get_prefecture_ranking.limit_count
$$;

CREATE OR REPLACE FUNCTION public.get_user_prefecture_ranking(prefecture text, target_user_id uuid)
RETURNS table (
  user_id uuid,
  user_name text,
  address_prefecture text,
  rank bigint,
  level integer,
  xp integer,
  updated_at timestamptz
) LANGUAGE sql AS $$
  WITH ranked_users AS (
    SELECT
      u.id AS user_id,
      u.name AS user_name,
      u.address_prefecture,
      coalesce(r.level, 1) AS level,
      coalesce(r.xp, 0) AS xp,
      r.updated_at,
      rank() OVER (ORDER BY coalesce(r.xp, 0) DESC, r.updated_at DESC) AS rank
    FROM public_user_profiles u
    LEFT JOIN user_ranking_view r ON u.id = r.user_id
    WHERE u.address_prefecture = get_user_prefecture_ranking.prefecture
      AND u.suspended_at IS NULL
      AND coalesce(r.xp, 0) > 0
  )
  SELECT
    ranked_users.user_id,
    ranked_users.user_name,
    ranked_users.address_prefecture,
    ranked_users.rank,
    ranked_users.level,
    ranked_users.xp,
    ranked_users.updated_at
  FROM ranked_users
  WHERE ranked_users.user_id = get_user_prefecture_ranking.target_user_id
  ORDER BY ranked_users.rank;
$$;

CREATE OR REPLACE FUNCTION public.get_period_prefecture_ranking(
    p_prefecture TEXT,
    p_limit INTEGER DEFAULT 10,
    p_start_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
    user_id UUID,
    name TEXT,
    rank BIGINT,
    xp BIGINT
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
    IF p_start_date IS NULL THEN
        RETURN QUERY
        SELECT
            pr.user_id::UUID,
            pr.user_name::TEXT AS name,
            pr.rank::BIGINT,
            pr.xp::BIGINT
        FROM get_prefecture_ranking(p_prefecture, p_limit) pr;
    ELSE
        RETURN QUERY
        WITH period_xp AS (
            SELECT
                xt.user_id,
                SUM(xt.xp_amount) AS period_xp_total
            FROM xp_transactions xt
            JOIN public_user_profiles pup ON pup.id = xt.user_id
            WHERE xt.created_at >= p_start_date
            AND pup.address_prefecture = p_prefecture
            AND pup.suspended_at IS NULL
            GROUP BY xt.user_id
        ),
        ranked_users AS (
            SELECT
                px.user_id,
                pup.name,
                ROW_NUMBER() OVER (ORDER BY px.period_xp_total DESC) AS rank,
                px.period_xp_total AS xp
            FROM period_xp px
            JOIN public_user_profiles pup ON pup.id = px.user_id
            WHERE px.period_xp_total > 0
              AND pup.suspended_at IS NULL
        )
        SELECT
            ru.user_id::UUID,
            ru.name::TEXT,
            ru.rank::BIGINT,
            ru.xp::BIGINT
        FROM ranked_users ru
        ORDER BY ru.rank
        LIMIT p_limit;
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_user_period_prefecture_ranking(
    p_prefecture TEXT,
    p_user_id UUID,
    p_start_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
    user_id UUID,
    name TEXT,
    level INTEGER,
    rank BIGINT,
    xp BIGINT
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
    IF p_start_date IS NULL THEN
        RETURN QUERY
        SELECT
            upr.user_id::UUID,
            upr.user_name::TEXT AS name,
            ul.level::INTEGER,
            upr.rank::BIGINT,
            upr.xp::BIGINT
        FROM get_user_prefecture_ranking(p_prefecture, p_user_id) upr
        JOIN user_levels ul ON ul.user_id = upr.user_id;
    ELSE
        RETURN QUERY
        WITH period_xp AS (
            SELECT
                xt.user_id,
                SUM(xt.xp_amount) AS period_xp_total
            FROM xp_transactions xt
            JOIN public_user_profiles pup ON pup.id = xt.user_id
            WHERE xt.created_at >= p_start_date
            AND pup.address_prefecture = p_prefecture
            AND pup.suspended_at IS NULL
            GROUP BY xt.user_id
        ),
        all_ranked_users AS (
            SELECT
                px.user_id,
                pup.name,
                ul.level,
                ROW_NUMBER() OVER (ORDER BY px.period_xp_total DESC) AS rank,
                px.period_xp_total AS xp
            FROM period_xp px
            JOIN public_user_profiles pup ON pup.id = px.user_id
            JOIN user_levels ul ON ul.user_id = px.user_id
            WHERE px.period_xp_total > 0
              AND pup.suspended_at IS NULL
        )
        SELECT
            aru.user_id::UUID,
            aru.name::TEXT,
            aru.level::INTEGER,
            aru.rank::BIGINT,
            aru.xp::BIGINT
        FROM all_ranked_users aru
        WHERE aru.user_id = p_user_id;
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_mission_ranking(mission_id uuid, limit_count integer default 10)
RETURNS table (
  user_id uuid,
  user_name text,
  address_prefecture text,
  level int,
  xp int,
  updated_at timestamp,
  clear_count bigint,
  total_points bigint,
  rank bigint
)
LANGUAGE sql
AS $$
  WITH mission_stats AS (
    SELECT
      a.user_id,
      count(distinct a.id) AS mission_clear_count,
      coalesce(sum(xt.xp_amount), 0) AS total_mission_points,
      min(a.created_at) AS first_achievement_at
    FROM achievements a
    LEFT JOIN xp_transactions xt ON
      xt.user_id = a.user_id AND
      xt.source_id = a.id AND
      xt.source_type IN ('MISSION_COMPLETION', 'BONUS')
    WHERE a.mission_id = get_mission_ranking.mission_id
    GROUP BY a.user_id
  )
  SELECT
    u.id AS user_id,
    u.name AS user_name,
    u.address_prefecture AS address_prefecture,
    r.level AS level,
    r.xp AS xp,
    r.updated_at AS updated_at,
    coalesce(ms.mission_clear_count, 0) AS clear_count,
    coalesce(ms.total_mission_points, 0) AS total_points,
    rank() OVER (
      ORDER BY
        coalesce(ms.total_mission_points, 0) DESC,
        coalesce(ms.mission_clear_count, 0) DESC,
        coalesce(ms.first_achievement_at, 'infinity'::timestamptz) ASC NULLS LAST
    ) AS rank
  FROM public_user_profiles u
  LEFT JOIN user_ranking_view r ON u.id = r.user_id
  LEFT JOIN mission_stats ms ON u.id = ms.user_id
  WHERE ms.mission_clear_count > 0
    AND u.suspended_at IS NULL
  ORDER BY rank
  LIMIT get_mission_ranking.limit_count;
$$;

CREATE OR REPLACE FUNCTION public.get_user_mission_ranking(mission_id uuid, user_id uuid)
RETURNS table (
  user_id uuid,
  user_name text,
  address_prefecture text,
  level int,
  xp int,
  updated_at timestamp,
  clear_count bigint,
  total_points bigint,
  rank bigint
)
LANGUAGE sql
AS $$
  WITH mission_stats AS (
    SELECT
      a.user_id,
      count(distinct a.id) AS mission_clear_count,
      coalesce(sum(xt.xp_amount), 0) AS total_mission_points,
      min(a.created_at) AS first_achievement_at
    FROM achievements a
    LEFT JOIN xp_transactions xt ON
      xt.user_id = a.user_id AND
      xt.source_id = a.id AND
      xt.source_type IN ('MISSION_COMPLETION', 'BONUS')
    WHERE a.mission_id = get_user_mission_ranking.mission_id
    GROUP BY a.user_id
  ),
  ranked_users AS (
    SELECT
      u.id AS user_id,
      u.name AS user_name,
      u.address_prefecture AS address_prefecture,
      r.level AS level,
      r.xp AS xp,
      r.updated_at AS updated_at,
      coalesce(ms.mission_clear_count, 0) AS clear_count,
      coalesce(ms.total_mission_points, 0) AS total_points,
      rank() OVER (
        ORDER BY
          coalesce(ms.total_mission_points, 0) DESC,
          coalesce(ms.mission_clear_count, 0) DESC,
          coalesce(ms.first_achievement_at, 'infinity'::timestamptz) ASC NULLS LAST
      ) AS rank
    FROM public_user_profiles u
    LEFT JOIN user_ranking_view r ON u.id = r.user_id
    LEFT JOIN mission_stats ms ON u.id = ms.user_id
    WHERE ms.mission_clear_count > 0
      AND u.suspended_at IS NULL
  )
  SELECT * FROM ranked_users
  WHERE user_id = get_user_mission_ranking.user_id;
$$;

CREATE OR REPLACE FUNCTION public.get_period_mission_ranking(
    p_mission_id uuid,
    p_limit integer default 10,
    p_start_date timestamptz default null
)
RETURNS table (
    mission_id uuid,
    user_id uuid,
    name text,
    address_prefecture text,
    user_achievement_count bigint,
    total_points bigint,
    rank bigint
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
    IF p_start_date IS NULL THEN
        RETURN QUERY
        SELECT
            p_mission_id AS mission_id,
            mr.user_id::uuid,
            mr.user_name::text AS name,
            mr.address_prefecture::text,
            mr.clear_count::bigint AS user_achievement_count,
            mr.total_points::bigint,
            mr.rank::bigint
        FROM get_mission_ranking(p_mission_id, p_limit) mr;
    ELSE
        IF EXISTS (
            SELECT 1 FROM missions m
            WHERE m.id = p_mission_id
            AND m.required_artifact_type = 'POSTING'
        ) THEN
            RETURN QUERY
            WITH period_posting AS (
                SELECT
                    ma.user_id,
                    coalesce(sum(pa.posting_count), 0) AS posting_count,
                    min(pa.created_at) AS first_achievement_at
                FROM mission_artifacts ma
                JOIN posting_activities pa ON pa.mission_artifact_id = ma.id
                JOIN achievements a ON a.id = ma.achievement_id
                WHERE pa.created_at >= p_start_date
                AND a.mission_id = p_mission_id
                GROUP BY ma.user_id
            ),
            period_xp AS (
                SELECT
                    xt.user_id,
                    coalesce(sum(xt.xp_amount), 0) AS total_xp
                FROM xp_transactions xt
                WHERE xt.created_at >= p_start_date
                AND xt.source_type IN ('MISSION_COMPLETION', 'BONUS')
                GROUP BY xt.user_id
            ),
            ranked_users AS (
                SELECT
                    p_mission_id AS mission_id,
                    pp.user_id,
                    pup.name,
                    pup.address_prefecture,
                    pp.posting_count AS user_achievement_count,
                    coalesce(px.total_xp, 0) AS total_points,
                    row_number() OVER (
                        ORDER BY
                            coalesce(px.total_xp, 0) DESC,
                            pp.posting_count DESC,
                            coalesce(pp.first_achievement_at, 'infinity'::timestamptz) ASC NULLS LAST
                    ) AS rank
                FROM period_posting pp
                JOIN public_user_profiles pup ON pup.id = pp.user_id
                LEFT JOIN period_xp px ON px.user_id = pp.user_id
                WHERE pup.suspended_at IS NULL
            )
            SELECT
                ru.mission_id::uuid,
                ru.user_id::uuid,
                ru.name::text,
                ru.address_prefecture::text,
                ru.user_achievement_count::bigint,
                ru.total_points::bigint,
                ru.rank::bigint
            FROM ranked_users ru
            ORDER BY ru.rank
            LIMIT p_limit;
        ELSE
            RETURN QUERY
            WITH period_achievements AS (
                SELECT
                    a.user_id,
                    a.id AS achievement_id,
                    a.created_at
                FROM achievements a
                WHERE a.mission_id = p_mission_id
                AND a.created_at >= p_start_date
            ),
            period_stats AS (
                SELECT
                    pa.user_id,
                    count(distinct pa.achievement_id) AS achievement_count,
                    coalesce(sum(xt.xp_amount), 0) AS total_mission_points,
                    min(pa.created_at) AS first_achievement_at
                FROM period_achievements pa
                LEFT JOIN xp_transactions xt ON
                    xt.user_id = pa.user_id AND
                    xt.source_id = pa.achievement_id AND
                    xt.source_type IN ('MISSION_COMPLETION', 'BONUS') AND
                    xt.created_at >= p_start_date
                GROUP BY pa.user_id
            ),
            ranked_users AS (
                SELECT
                    p_mission_id AS mission_id,
                    ps.user_id,
                    pup.name,
                    pup.address_prefecture,
                    ps.achievement_count AS user_achievement_count,
                    ps.total_mission_points AS total_points,
                    row_number() OVER (
                        ORDER BY
                            ps.total_mission_points DESC,
                            ps.achievement_count DESC,
                            coalesce(ps.first_achievement_at, 'infinity'::timestamptz) ASC NULLS LAST
                    ) AS rank
                FROM period_stats ps
                JOIN public_user_profiles pup ON pup.id = ps.user_id
                WHERE pup.suspended_at IS NULL
            )
            SELECT
                ru.mission_id::uuid,
                ru.user_id::uuid,
                ru.name::text,
                ru.address_prefecture::text,
                ru.user_achievement_count::bigint,
                ru.total_points::bigint,
                ru.rank::bigint
            FROM ranked_users ru
            ORDER BY ru.rank
            LIMIT p_limit;
        END IF;
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_user_period_mission_ranking(
    p_mission_id uuid,
    p_user_id uuid,
    p_start_date timestamptz default null
)
RETURNS table (
    mission_id uuid,
    user_id uuid,
    name text,
    address_prefecture text,
    user_achievement_count bigint,
    total_points bigint,
    rank bigint
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
    IF p_start_date IS NULL THEN
        RETURN QUERY
        SELECT
            p_mission_id AS mission_id,
            umr.user_id::uuid,
            umr.user_name::text AS name,
            umr.address_prefecture::text,
            umr.clear_count::bigint AS user_achievement_count,
            umr.total_points::bigint,
            umr.rank::bigint
        FROM get_user_mission_ranking(p_mission_id, p_user_id) umr;
    ELSE
        IF EXISTS (
            SELECT 1 FROM missions m
            WHERE m.id = p_mission_id
            AND m.required_artifact_type = 'POSTING'
        ) THEN
            RETURN QUERY
            WITH period_posting AS (
                SELECT
                    ma.user_id,
                    coalesce(sum(pa.posting_count), 0) AS posting_count,
                    min(pa.created_at) AS first_achievement_at
                FROM mission_artifacts ma
                JOIN posting_activities pa ON pa.mission_artifact_id = ma.id
                JOIN achievements a ON a.id = ma.achievement_id
                WHERE pa.created_at >= p_start_date
                AND a.mission_id = p_mission_id
                GROUP BY ma.user_id
            ),
            period_xp AS (
                SELECT
                    xt.user_id,
                    coalesce(sum(xt.xp_amount), 0) AS total_xp
                FROM xp_transactions xt
                WHERE xt.created_at >= p_start_date
                AND xt.source_type IN ('MISSION_COMPLETION', 'BONUS')
                GROUP BY xt.user_id
            ),
            all_ranked_users AS (
                SELECT
                    p_mission_id AS mission_id,
                    pp.user_id,
                    pup.name,
                    pup.address_prefecture,
                    pp.posting_count AS user_achievement_count,
                    coalesce(px.total_xp, 0) AS total_points,
                    row_number() OVER (
                        ORDER BY
                            coalesce(px.total_xp, 0) DESC,
                            pp.posting_count DESC,
                            coalesce(pp.first_achievement_at, 'infinity'::timestamptz) ASC NULLS LAST
                    ) AS rank
                FROM period_posting pp
                JOIN public_user_profiles pup ON pup.id = pp.user_id
                LEFT JOIN period_xp px ON px.user_id = pp.user_id
                WHERE pup.suspended_at IS NULL
            )
            SELECT
                aru.mission_id::uuid,
                aru.user_id::uuid,
                aru.name::text,
                aru.address_prefecture::text,
                aru.user_achievement_count::bigint,
                aru.total_points::bigint,
                aru.rank::bigint
            FROM all_ranked_users aru
            WHERE aru.user_id = p_user_id;
        ELSE
            RETURN QUERY
            WITH period_achievements AS (
                SELECT
                    a.user_id,
                    a.id AS achievement_id,
                    a.created_at
                FROM achievements a
                WHERE a.mission_id = p_mission_id
                AND a.created_at >= p_start_date
            ),
            period_stats AS (
                SELECT
                    pa.user_id,
                    count(distinct pa.achievement_id) AS achievement_count,
                    coalesce(sum(xt.xp_amount), 0) AS total_mission_points,
                    min(pa.created_at) AS first_achievement_at
                FROM period_achievements pa
                LEFT JOIN xp_transactions xt ON
                    xt.user_id = pa.user_id AND
                    xt.source_id = pa.achievement_id AND
                    xt.source_type IN ('MISSION_COMPLETION', 'BONUS') AND
                    xt.created_at >= p_start_date
                GROUP BY pa.user_id
            ),
            all_ranked_users AS (
                SELECT
                    p_mission_id AS mission_id,
                    ps.user_id,
                    pup.name,
                    pup.address_prefecture,
                    ps.achievement_count AS user_achievement_count,
                    ps.total_mission_points AS total_points,
                    row_number() OVER (
                        ORDER BY
                            ps.total_mission_points DESC,
                            ps.achievement_count DESC,
                            coalesce(ps.first_achievement_at, 'infinity'::timestamptz) ASC NULLS LAST
                    ) AS rank
                FROM period_stats ps
                JOIN public_user_profiles pup ON pup.id = ps.user_id
                WHERE pup.suspended_at IS NULL
            )
            SELECT
                aru.mission_id::uuid,
                aru.user_id::uuid,
                aru.name::text,
                aru.address_prefecture::text,
                aru.user_achievement_count::bigint,
                aru.total_points::bigint,
                aru.rank::bigint
            FROM all_ranked_users aru
            WHERE aru.user_id = p_user_id;
        END IF;
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_likes_ranking(limit_count INTEGER DEFAULT 10)
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
      COUNT(*) AS likes_count
    FROM user_mission_likes uml
    GROUP BY uml.user_id
  ),
  ranked_users AS (
    SELECT
      ulc.user_id,
      pup.name AS user_name,
      pup.address_prefecture,
      ulc.likes_count,
      ROW_NUMBER() OVER (ORDER BY ulc.likes_count DESC) AS rank
    FROM user_likes_count ulc
    JOIN public_user_profiles pup ON pup.id = ulc.user_id
    WHERE ulc.likes_count > 0
      AND pup.suspended_at IS NULL
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

CREATE OR REPLACE FUNCTION public.get_user_likes_ranking(target_user_id UUID)
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
      COUNT(*) AS likes_count
    FROM user_mission_likes uml
    GROUP BY uml.user_id
  ),
  ranked_users AS (
    SELECT
      ulc.user_id,
      pup.name AS user_name,
      pup.address_prefecture,
      ulc.likes_count,
      ROW_NUMBER() OVER (ORDER BY ulc.likes_count DESC) AS rank
    FROM user_likes_count ulc
    JOIN public_user_profiles pup ON pup.id = ulc.user_id
    WHERE ulc.likes_count > 0
      AND pup.suspended_at IS NULL
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

CREATE OR REPLACE FUNCTION public.get_period_likes_ranking(
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
    RETURN QUERY
    WITH period_likes_count AS (
      SELECT
        uml.user_id,
        COUNT(*) AS likes_count
      FROM user_mission_likes uml
      WHERE uml.created_at >= p_start_date
      GROUP BY uml.user_id
    ),
    ranked_users AS (
      SELECT
        plc.user_id,
        pup.name AS user_name,
        pup.address_prefecture,
        plc.likes_count,
        ROW_NUMBER() OVER (ORDER BY plc.likes_count DESC) AS rank
      FROM period_likes_count plc
      JOIN public_user_profiles pup ON pup.id = plc.user_id
      WHERE plc.likes_count > 0
        AND pup.suspended_at IS NULL
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

CREATE OR REPLACE FUNCTION public.get_user_period_likes_ranking(
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
    RETURN QUERY
    WITH period_likes_count AS (
      SELECT
        uml.user_id,
        COUNT(*) AS likes_count
      FROM user_mission_likes uml
      WHERE uml.created_at >= p_start_date
      GROUP BY uml.user_id
    ),
    all_ranked_users AS (
      SELECT
        plc.user_id,
        pup.name AS user_name,
        pup.address_prefecture,
        plc.likes_count,
        ROW_NUMBER() OVER (ORDER BY plc.likes_count DESC) AS rank
      FROM period_likes_count plc
      JOIN public_user_profiles pup ON pup.id = plc.user_id
      WHERE plc.likes_count > 0
        AND pup.suspended_at IS NULL
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
