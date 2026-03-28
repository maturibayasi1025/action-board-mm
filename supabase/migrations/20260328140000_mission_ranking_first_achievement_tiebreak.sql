-- グッジョブランキング: 同点時は「そのグッジョブでの初回達成が早い順」を優先（従来は名前順）

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

comment on function get_mission_ranking(uuid, integer) is
  'グッジョブ別ランキング。並び: 獲得ポイント降順、達成回数降順、初回達成が早い順';
