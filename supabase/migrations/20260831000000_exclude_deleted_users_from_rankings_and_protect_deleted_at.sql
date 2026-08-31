-- ソフト削除ユーザーを期間別・いいね・グッジョブ・都道府県ランキングからも除外する。
-- 本人が deleted_at を戻して復活できないよう RLS を締める。

DROP POLICY IF EXISTS "users_can_manage_own_data" ON public.private_users;
CREATE POLICY "users_can_manage_own_data" ON public.private_users
  FOR ALL
  USING (auth.uid() = id AND deleted_at IS NULL)
  WITH CHECK (auth.uid() = id AND deleted_at IS NULL);

COMMENT ON POLICY "users_can_manage_own_data" ON public.private_users IS
'ユーザーは自分自身の未削除データに対して全ての操作が可能。deleted_at がセットされた行は本人でも更新できない。';

CREATE OR REPLACE FUNCTION get_period_ranking(
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
        WHERE pup.deleted_at IS NULL
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

CREATE OR REPLACE FUNCTION get_user_period_ranking(
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
              AND pup.deleted_at IS NULL
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
      AND pup.deleted_at IS NULL
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
      AND pup.deleted_at IS NULL
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
        AND pup.deleted_at IS NULL
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
        AND pup.deleted_at IS NULL
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

create or replace function get_mission_ranking(mission_id uuid, limit_count integer default 10)
returns table (
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
language sql
as $$
  with mission_stats as (
    select
      a.user_id,
      count(distinct a.id) as mission_clear_count,
      coalesce(sum(xt.xp_amount), 0) as total_mission_points,
      min(a.created_at) as first_achievement_at
    from achievements a
    left join xp_transactions xt on
      xt.user_id = a.user_id and
      xt.source_id = a.id and
      xt.source_type in ('MISSION_COMPLETION', 'BONUS')
    where a.mission_id = get_mission_ranking.mission_id
    group by a.user_id
  )
  select
    u.id as user_id,
    u.name as user_name,
    u.address_prefecture as address_prefecture,
    r.level as level,
    r.xp as xp,
    r.updated_at as updated_at,
    coalesce(ms.mission_clear_count, 0) as clear_count,
    coalesce(ms.total_mission_points, 0) as total_points,
    rank() over (
      order by
        coalesce(ms.total_mission_points, 0) desc,
        coalesce(ms.mission_clear_count, 0) desc,
        coalesce(ms.first_achievement_at, 'infinity'::timestamptz) asc nulls last
    ) as rank
  from public_user_profiles u
  left join user_ranking_view r on u.id = r.user_id
  left join mission_stats ms on u.id = ms.user_id
  where ms.mission_clear_count > 0
    and u.deleted_at is null
  order by rank
  limit get_mission_ranking.limit_count;
$$;

create or replace function get_user_mission_ranking(mission_id uuid, user_id uuid)
returns table (
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
language sql
as $$
  with mission_stats as (
    select
      a.user_id,
      count(distinct a.id) as mission_clear_count,
      coalesce(sum(xt.xp_amount), 0) as total_mission_points,
      min(a.created_at) as first_achievement_at
    from achievements a
    left join xp_transactions xt on
      xt.user_id = a.user_id and
      xt.source_id = a.id and
      xt.source_type in ('MISSION_COMPLETION', 'BONUS')
    where a.mission_id = get_user_mission_ranking.mission_id
    group by a.user_id
  ),
  ranked_users as (
    select
      u.id as user_id,
      u.name as user_name,
      u.address_prefecture as address_prefecture,
      r.level as level,
      r.xp as xp,
      r.updated_at as updated_at,
      coalesce(ms.mission_clear_count, 0) as clear_count,
      coalesce(ms.total_mission_points, 0) as total_points,
      rank() over (
        order by
          coalesce(ms.total_mission_points, 0) desc,
          coalesce(ms.mission_clear_count, 0) desc,
          coalesce(ms.first_achievement_at, 'infinity'::timestamptz) asc nulls last
      ) as rank
    from public_user_profiles u
    left join user_ranking_view r on u.id = r.user_id
    left join mission_stats ms on u.id = ms.user_id
    where ms.mission_clear_count > 0
      and u.deleted_at is null
  )
  select * from ranked_users
  where user_id = get_user_mission_ranking.user_id;
$$;

create or replace function get_period_mission_ranking(
    p_mission_id uuid,
    p_limit integer default 10,
    p_start_date timestamptz default null
)
returns table (
    mission_id uuid,
    user_id uuid,
    name text,
    address_prefecture text,
    user_achievement_count bigint,
    total_points bigint,
    rank bigint
)
language plpgsql
stable
as $$
begin
    if p_start_date is null then
        return query
        select
            p_mission_id as mission_id,
            mr.user_id::uuid,
            mr.user_name::text as name,
            mr.address_prefecture::text,
            mr.clear_count::bigint as user_achievement_count,
            mr.total_points::bigint,
            mr.rank::bigint
        from get_mission_ranking(p_mission_id, p_limit) mr;
    else
        if exists (
            select 1 from missions m
            where m.id = p_mission_id
            and m.required_artifact_type = 'POSTING'
        ) then
            return query
            with period_posting as (
                select
                    ma.user_id,
                    coalesce(sum(pa.posting_count), 0) as posting_count,
                    min(pa.created_at) as first_achievement_at
                from mission_artifacts ma
                join posting_activities pa on pa.mission_artifact_id = ma.id
                join achievements a on a.id = ma.achievement_id
                where pa.created_at >= p_start_date
                and a.mission_id = p_mission_id
                group by ma.user_id
            ),
            period_xp as (
                select
                    xt.user_id,
                    coalesce(sum(xt.xp_amount), 0) as total_xp
                from xp_transactions xt
                where xt.created_at >= p_start_date
                and xt.source_type in ('MISSION_COMPLETION', 'BONUS')
                group by xt.user_id
            ),
            ranked_users as (
                select
                    p_mission_id as mission_id,
                    pp.user_id,
                    pup.name,
                    pup.address_prefecture,
                    pp.posting_count as user_achievement_count,
                    coalesce(px.total_xp, 0) as total_points,
                    row_number() over (
                        order by
                            coalesce(px.total_xp, 0) desc,
                            pp.posting_count desc,
                            coalesce(pp.first_achievement_at, 'infinity'::timestamptz) asc nulls last
                    ) as rank
                from period_posting pp
                join public_user_profiles pup on pup.id = pp.user_id
                left join period_xp px on px.user_id = pp.user_id
                where pup.deleted_at is null
            )
            select
                ru.mission_id::uuid,
                ru.user_id::uuid,
                ru.name::text,
                ru.address_prefecture::text,
                ru.user_achievement_count::bigint,
                ru.total_points::bigint,
                ru.rank::bigint
            from ranked_users ru
            order by ru.rank
            limit p_limit;
        else
            return query
            with period_achievements as (
                select
                    a.user_id,
                    a.id as achievement_id,
                    a.created_at
                from achievements a
                where a.mission_id = p_mission_id
                and a.created_at >= p_start_date
            ),
            period_stats as (
                select
                    pa.user_id,
                    count(distinct pa.achievement_id) as achievement_count,
                    coalesce(sum(xt.xp_amount), 0) as total_mission_points,
                    min(pa.created_at) as first_achievement_at
                from period_achievements pa
                left join xp_transactions xt on
                    xt.user_id = pa.user_id and
                    xt.source_id = pa.achievement_id and
                    xt.source_type in ('MISSION_COMPLETION', 'BONUS') and
                    xt.created_at >= p_start_date
                group by pa.user_id
            ),
            ranked_users as (
                select
                    p_mission_id as mission_id,
                    ps.user_id,
                    pup.name,
                    pup.address_prefecture,
                    ps.achievement_count as user_achievement_count,
                    ps.total_mission_points as total_points,
                    row_number() over (
                        order by
                            ps.total_mission_points desc,
                            ps.achievement_count desc,
                            coalesce(ps.first_achievement_at, 'infinity'::timestamptz) asc nulls last
                    ) as rank
                from period_stats ps
                join public_user_profiles pup on pup.id = ps.user_id
                where pup.deleted_at is null
            )
            select
                ru.mission_id::uuid,
                ru.user_id::uuid,
                ru.name::text,
                ru.address_prefecture::text,
                ru.user_achievement_count::bigint,
                ru.total_points::bigint,
                ru.rank::bigint
            from ranked_users ru
            order by ru.rank
            limit p_limit;
        end if;
    end if;
end;
$$;

create or replace function get_user_period_mission_ranking(
    p_mission_id uuid,
    p_user_id uuid,
    p_start_date timestamptz default null
)
returns table (
    mission_id uuid,
    user_id uuid,
    name text,
    address_prefecture text,
    user_achievement_count bigint,
    total_points bigint,
    rank bigint
)
language plpgsql
stable
as $$
begin
    if p_start_date is null then
        return query
        select
            p_mission_id as mission_id,
            umr.user_id::uuid,
            umr.user_name::text as name,
            umr.address_prefecture::text,
            umr.clear_count::bigint as user_achievement_count,
            umr.total_points::bigint,
            umr.rank::bigint
        from get_user_mission_ranking(p_mission_id, p_user_id) umr;
    else
        if exists (
            select 1 from missions m
            where m.id = p_mission_id
            and m.required_artifact_type = 'POSTING'
        ) then
            return query
            with period_posting as (
                select
                    ma.user_id,
                    coalesce(sum(pa.posting_count), 0) as posting_count,
                    min(pa.created_at) as first_achievement_at
                from mission_artifacts ma
                join posting_activities pa on pa.mission_artifact_id = ma.id
                join achievements a on a.id = ma.achievement_id
                where pa.created_at >= p_start_date
                and a.mission_id = p_mission_id
                group by ma.user_id
            ),
            period_xp as (
                select
                    xt.user_id,
                    coalesce(sum(xt.xp_amount), 0) as total_xp
                from xp_transactions xt
                where xt.created_at >= p_start_date
                and xt.source_type in ('MISSION_COMPLETION', 'BONUS')
                group by xt.user_id
            ),
            all_ranked_users as (
                select
                    p_mission_id as mission_id,
                    pp.user_id,
                    pup.name,
                    pup.address_prefecture,
                    pp.posting_count as user_achievement_count,
                    coalesce(px.total_xp, 0) as total_points,
                    row_number() over (
                        order by
                            coalesce(px.total_xp, 0) desc,
                            pp.posting_count desc,
                            coalesce(pp.first_achievement_at, 'infinity'::timestamptz) asc nulls last
                    ) as rank
                from period_posting pp
                join public_user_profiles pup on pup.id = pp.user_id
                left join period_xp px on px.user_id = pp.user_id
                where pup.deleted_at is null
            )
            select
                aru.mission_id::uuid,
                aru.user_id::uuid,
                aru.name::text,
                aru.address_prefecture::text,
                aru.user_achievement_count::bigint,
                aru.total_points::bigint,
                aru.rank::bigint
            from all_ranked_users aru
            where aru.user_id = p_user_id;
        else
            return query
            with period_achievements as (
                select
                    a.user_id,
                    a.id as achievement_id,
                    a.created_at
                from achievements a
                where a.mission_id = p_mission_id
                and a.created_at >= p_start_date
            ),
            period_stats as (
                select
                    pa.user_id,
                    count(distinct pa.achievement_id) as achievement_count,
                    coalesce(sum(xt.xp_amount), 0) as total_mission_points,
                    min(pa.created_at) as first_achievement_at
                from period_achievements pa
                left join xp_transactions xt on
                    xt.user_id = pa.user_id and
                    xt.source_id = pa.achievement_id and
                    xt.source_type in ('MISSION_COMPLETION', 'BONUS') and
                    xt.created_at >= p_start_date
                group by pa.user_id
            ),
            all_ranked_users as (
                select
                    p_mission_id as mission_id,
                    ps.user_id,
                    pup.name,
                    pup.address_prefecture,
                    ps.achievement_count as user_achievement_count,
                    ps.total_mission_points as total_points,
                    row_number() over (
                        order by
                            ps.total_mission_points desc,
                            ps.achievement_count desc,
                            coalesce(ps.first_achievement_at, 'infinity'::timestamptz) asc nulls last
                    ) as rank
                from period_stats ps
                join public_user_profiles pup on pup.id = ps.user_id
                where pup.deleted_at is null
            )
            select
                aru.mission_id::uuid,
                aru.user_id::uuid,
                aru.name::text,
                aru.address_prefecture::text,
                aru.user_achievement_count::bigint,
                aru.total_points::bigint,
                aru.rank::bigint
            from all_ranked_users aru
            where aru.user_id = p_user_id;
        end if;
    end if;
end;
$$;

create or replace function get_prefecture_ranking(prefecture text, limit_count integer default 10)
returns table (
  user_id uuid,
  user_name text,
  address_prefecture text,
  rank bigint,
  level integer,
  xp integer,
  updated_at timestamptz
) language sql as $$
  with ranked_users as (
    select
      u.id as user_id,
      u.name as user_name,
      u.address_prefecture,
      coalesce(r.level, 1) as level,
      coalesce(r.xp, 0) as xp,
      r.updated_at,
      rank() over (order by coalesce(r.xp, 0) desc, r.updated_at desc) as rank
    from public_user_profiles u
    left join user_ranking_view r on u.id = r.user_id
    where u.address_prefecture = get_prefecture_ranking.prefecture
      and u.deleted_at is null
      and coalesce(r.xp, 0) > 0
  )
  select
    ranked_users.user_id,
    ranked_users.user_name,
    ranked_users.address_prefecture,
    ranked_users.rank,
    ranked_users.level,
    ranked_users.xp,
    ranked_users.updated_at
  from ranked_users
  order by ranked_users.rank
  limit get_prefecture_ranking.limit_count
$$;

create or replace function get_user_prefecture_ranking(prefecture text, target_user_id uuid)
returns table (
  user_id uuid,
  user_name text,
  address_prefecture text,
  rank bigint,
  level integer,
  xp integer,
  updated_at timestamptz
) language sql as $$
  with ranked_users as (
    select
      u.id as user_id,
      u.name as user_name,
      u.address_prefecture,
      coalesce(r.level, 1) as level,
      coalesce(r.xp, 0) as xp,
      r.updated_at,
      rank() over (order by coalesce(r.xp, 0) desc, r.updated_at desc) as rank
    from public_user_profiles u
    left join user_ranking_view r on u.id = r.user_id
    where u.address_prefecture = get_user_prefecture_ranking.prefecture
      and u.deleted_at is null
      and coalesce(r.xp, 0) > 0
  )
  select
    ranked_users.user_id,
    ranked_users.user_name,
    ranked_users.address_prefecture,
    ranked_users.rank,
    ranked_users.level,
    ranked_users.xp,
    ranked_users.updated_at
  from ranked_users
  where ranked_users.user_id = get_user_prefecture_ranking.target_user_id
  order by ranked_users.rank;
$$;

CREATE OR REPLACE FUNCTION get_period_prefecture_ranking(
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
            AND pup.deleted_at IS NULL
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
              AND pup.deleted_at IS NULL
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

CREATE OR REPLACE FUNCTION get_user_period_prefecture_ranking(
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
            AND pup.deleted_at IS NULL
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
              AND pup.deleted_at IS NULL
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
