import "server-only";

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

  let missionIdsFilter: string[] | null = null;
  if (praisedForUserId) {
    const { data: praisedRows, error: praisedError } = await supabase
      .from("user_mission_praised_users")
      .select("user_mission_id")
      .eq("praised_user_id", praisedForUserId);

    if (praisedError) {
      console.error("Error fetching praised mission IDs:", praisedError);
      return [];
    }

    missionIdsFilter = praisedRows?.map((row) => row.user_mission_id) ?? [];
    if (missionIdsFilter.length === 0) {
      return [];
    }
  }

  let query = supabase
    .from("user_missions")
    .select(`
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
    `)
    .order("published_at", { ascending: false, nullsFirst: false });

  if (missionIdsFilter) {
    query = query.in("id", missionIdsFilter).eq("status", "approved");
  } else if (status !== "all") {
    query = query.eq("status", status);
  }

  if (createdBy) {
    query = query.eq("created_by", createdBy);
    if (status === "all") {
      query = query.order("updated_at", { ascending: false });
    }
  }

  if (limit) {
    query = query.limit(limit);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching user missions:", error);
    return [];
  }

  if (!data) return [];

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const creatorIds = Array.from(new Set(data.map((m) => m.created_by)));
  const { data: creators } = await supabase
    .from("private_users")
    .select("id, name")
    .in("id", creatorIds);

  const creatorMap = new Map(creators?.map((c) => [c.id, c.name]) || []);

  const missionIds = data.map((m) => m.id);
  const { data: allExternalUsers, error: externalUsersError } = await supabase
    .from("user_mission_praised_external_users")
    .select("user_mission_id, praised_person_name")
    .in("user_mission_id", missionIds);

  if (externalUsersError) {
    console.error("Error fetching external users:", externalUsersError);
  }

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

  return data.map((mission) => ({
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
