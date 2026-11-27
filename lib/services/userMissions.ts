import "server-only";

import { fetchAllRows, fetchByIdChunks } from "@/lib/supabase/fetch-all-rows";
import { createClient } from "@/lib/supabase/server";
import type {
  Like,
  MvvItem,
  PraisedUser,
  UserMission,
  UserMissionMvvItems,
} from "@/lib/types/user-missions";

export type {
  UserMission,
  UserMissionMvvItems,
} from "@/lib/types/user-missions";

export type GetUserMissionsOptions = {
  limit?: number;
  createdBy?: string;
  praisedForUserId?: string;
  status?: "approved" | "pending" | "rejected" | "all";
};

function mapMvvItems(items: MvvItem[] | null | undefined): UserMissionMvvItems {
  return {
    passionateExecution:
      items?.some((item) => item.mvv_type === "passionate_execution") || false,
    supremeRelationships:
      items?.some((item) => item.mvv_type === "supreme_relationships") || false,
    happinessCirculation:
      items?.some((item) => item.mvv_type === "happiness_circulation") || false,
  };
}

/** 承認済みユーザーグッジョブ一覧を取得（ホーム・一覧ページ共通） */
export async function getUserMissionsServer(
  options: GetUserMissionsOptions = {},
): Promise<UserMission[]> {
  const supabase = await createClient();
  const {
    limit,
    createdBy,
    praisedForUserId,
    status = createdBy ? "all" : "approved",
  } = options;

  const buildQuery = () => {
    let query = supabase.from("user_missions").select(`
      *,
      user_mission_mvv_items (
        mvv_type
      ),
      user_mission_likes (
        user_id
      ),
      user_mission_praised_users (
        praised_user_id,
        private_users!praised_user_id (
          name,
          x_username
        )
      )
    `);
    if (praisedForUserId) {
      query = query.eq("status", "approved");
    } else if (status !== "all") {
      query = query.eq("status", status);
    }
    if (createdBy) {
      query = query.eq("created_by", createdBy);
    }
    return query;
  };
  const sortByUpdatedAt = Boolean(createdBy) && status === "all";
  const buildOrderedQuery = () => {
    let query = buildQuery().order("published_at", {
      ascending: false,
      nullsFirst: false,
    });
    if (sortByUpdatedAt) {
      query = query.order("updated_at", { ascending: false });
    }
    return query.order("id", { ascending: false });
  };
  type Row = NonNullable<
    Awaited<ReturnType<typeof buildQuery>>["data"]
  >[number];

  let data: Row[];
  try {
    if (praisedForUserId) {
      const praisedRows = await fetchAllRows<{ user_mission_id: string }>(
        (from, to) =>
          supabase
            .from("user_mission_praised_users")
            .select("user_mission_id")
            .eq("praised_user_id", praisedForUserId)
            .order("id", { ascending: true })
            .range(from, to),
      );
      data = await fetchByIdChunks<Row>(
        praisedRows.map((row) => row.user_mission_id),
        (chunk) => buildQuery().in("id", chunk),
      );
      data.sort(
        (a, b) =>
          compareDescNullsLast(a.published_at, b.published_at) ||
          (sortByUpdatedAt
            ? compareDescNullsLast(a.updated_at, b.updated_at)
            : 0) ||
          b.id.localeCompare(a.id),
      );
      if (limit) {
        data = data.slice(0, limit);
      }
    } else if (limit) {
      const { data: limited, error } = await buildOrderedQuery().limit(limit);
      if (error) {
        throw new Error(error.message);
      }
      data = limited ?? [];
    } else {
      data = await fetchAllRows<Row>((from, to) =>
        buildOrderedQuery().range(from, to),
      );
    }
  } catch (error) {
    console.error("Error fetching user missions:", error);
    return [];
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const creatorIds = Array.from(new Set(data.map((m) => m.created_by)));
  // 匿名でも読める公開プロフィールを使う。RLS が停止ユーザーを隠す。
  const creators = await fetchByIdChunks<{ id: string; name: string }>(
    creatorIds,
    (chunk) =>
      supabase.from("public_user_profiles").select("id, name").in("id", chunk),
  ).catch(() => []);

  const creatorMap = new Map(creators.map((c) => [c.id, c.name]));
  const visibleCreatorIds = new Set(creators.map((c) => c.id));
  const missionsForDisplay = createdBy
    ? data
    : data.filter((mission) => visibleCreatorIds.has(mission.created_by));

  const missionIds = missionsForDisplay.map((m) => m.id);
  const allExternalUsers = await fetchByIdChunks<{
    user_mission_id: string;
    praised_person_name: string;
  }>(missionIds, async (chunk) => ({
    data: await fetchAllRows((from, to) =>
      supabase
        .from("user_mission_praised_external_users")
        .select("user_mission_id, praised_person_name")
        .in("user_mission_id", chunk)
        .order("id", { ascending: true })
        .range(from, to),
    ),
    error: null,
  })).catch((externalUsersError) => {
    console.error("Error fetching external users:", externalUsersError);
    return null;
  });

  const externalUsersMap = new Map<string, string[]>();
  if (allExternalUsers) {
    for (const eu of allExternalUsers) {
      const missionId = eu.user_mission_id;
      if (!externalUsersMap.has(missionId)) {
        externalUsersMap.set(missionId, []);
      }
      externalUsersMap.get(missionId)?.push(eu.praised_person_name);
    }
  }

  return missionsForDisplay.map((mission) => ({
    id: mission.id,
    createdBy: mission.created_by,
    createdByName: creatorMap.get(mission.created_by) || "不明なユーザー",
    title: mission.title,
    content: mission.content,
    imagePaths: ((mission as unknown as { image_paths?: string[] })
      .image_paths || []) as string[],
    praisedUsers:
      mission.user_mission_praised_users
        ?.map((p: PraisedUser) => p.private_users?.name)
        .filter((name: string | undefined): name is string => Boolean(name)) ||
      [],
    praisedUsersWithXUsername:
      mission.user_mission_praised_users
        ?.map((p: PraisedUser) => ({
          name: p.private_users?.name || "",
          x_username: p.private_users?.x_username ?? null,
        }))
        .filter((u) => Boolean(u.name)) || [],
    praisedExternalUsers: externalUsersMap.get(mission.id) || [],
    status: mission.status,
    rejectionReason: mission.rejection_reason,
    createdAt: mission.created_at,
    updatedAt: mission.updated_at,
    approvedAt: mission.approved_at,
    approvedBy: mission.approved_by,
    publishedAt: mission.published_at,
    publicMissionId: mission.public_mission_id,
    likesCount: mission.likes_count,
    mvvItems: mapMvvItems(mission.user_mission_mvv_items),
    isLikedByCurrentUser: user
      ? mission.user_mission_likes?.some(
          (like: Like) => like.user_id === user.id,
        ) || false
      : false,
  }));
}

function compareDescNullsLast(a: string | null, b: string | null): number {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return b.localeCompare(a);
}
