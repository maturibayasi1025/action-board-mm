"use server";

import { createServiceClient } from "@/lib/supabase/server";
import { requireOwner } from "@/lib/utils/isOwner";

export interface AssessmentRow {
  userId: string;
  userName: string;
  prefecture: string;
  goodjobPostedCount: number;
  goodjobReceivedCount: number;
  passionateExecutionCount: number;
  supremeRelationshipsCount: number;
  happinessCirculationCount: number;
  likesGivenCount: number;
  likesReceivedCount: number;
  postingDaysCount: number;
  missionAchievementCount: number;
  totalXp: number;
  currentLevel: number;
  registeredAt: string;
}

/**
 * 査定用データを取得する
 * @param startDate 開始日（ISO文字列、00:00:00Z）
 * @param endDate 終了日（ISO文字列、23:59:59Z）
 */
export async function getAssessmentData(
  startDate: string,
  endDate: string,
): Promise<
  { success: true; data: AssessmentRow[] } | { success: false; error: string }
> {
  try {
    await requireOwner();

    const supabase = await createServiceClient();

    // 1. 全ユーザー一覧を取得
    const { data: users, error: usersError } = await supabase
      .from("private_users")
      .select("id, name, address_prefecture, registered_at")
      .is("suspended_at", null);

    if (usersError) {
      console.error("ユーザー取得エラー:", usersError);
      return {
        success: false,
        error: `ユーザー取得に失敗しました: ${usersError.message}`,
      };
    }

    if (!users || users.length === 0) {
      return { success: true, data: [] };
    }

    const userIds = users.map((u) => u.id);
    const userMap = new Map(users.map((u) => [u.id, u]));

    // 2. 期間内の承認済みグッジョブを取得
    const { data: missionsInPeriod } = await supabase
      .from("user_missions")
      .select("id, created_by, approved_at, likes_count")
      .eq("status", "approved")
      .gte("approved_at", startDate)
      .lte("approved_at", endDate);

    const missionIdsInPeriod = (missionsInPeriod || []).map((m) => m.id);

    // 3. 称賛対象ユーザー（期間内のグッジョブに紐づく）
    let praisedUsers: { user_mission_id: string; praised_user_id: string }[] =
      [];
    if (missionIdsInPeriod.length > 0) {
      const { data } = await supabase
        .from("user_mission_praised_users")
        .select("user_mission_id, praised_user_id")
        .in("user_mission_id", missionIdsInPeriod);
      praisedUsers = data || [];
    }

    // 4. MVV項目（期間内のグッジョブに紐づく）
    let mvvItems: { user_mission_id: string; mvv_type: string }[] = [];
    if (missionIdsInPeriod.length > 0) {
      const { data } = await supabase
        .from("user_mission_mvv_items")
        .select("user_mission_id, mvv_type")
        .in("user_mission_id", missionIdsInPeriod);
      mvvItems = data || [];
    }

    // 5. いいね（期間内に付与されたいいね）
    const { data: likesInPeriod } = await supabase
      .from("user_mission_likes")
      .select("user_id, user_mission_id")
      .gte("created_at", startDate)
      .lte("created_at", endDate);

    // 6. 期間内のミッション達成
    const { data: achievementsInPeriod } = await supabase
      .from("achievements")
      .select("user_id")
      .gte("created_at", startDate)
      .lte("created_at", endDate);

    // 7. ユーザーレベル（全期間）
    const { data: userLevels } = await supabase
      .from("user_levels")
      .select("user_id, xp, level")
      .in("user_id", userIds);

    const levelsMap = new Map(
      (userLevels || []).map((ul) => [
        ul.user_id,
        { xp: ul.xp, level: ul.level },
      ]),
    );

    // MVVごとの称賛数マップ: praised_user_id -> mvv_type -> Set<mission_id>
    const mvvByMission = new Map<string, string[]>();
    for (const item of mvvItems) {
      if (!mvvByMission.has(item.user_mission_id)) {
        mvvByMission.set(item.user_mission_id, []);
      }
      mvvByMission.get(item.user_mission_id)?.push(item.mvv_type);
    }

    // 集計用マップ
    const goodjobPostedByUser = new Map<string, number>();
    const goodjobReceivedByUser = new Map<string, number>();
    const mvvCountByUser = new Map<
      string,
      {
        passionate_execution: Set<string>;
        supreme_relationships: Set<string>;
        happiness_circulation: Set<string>;
      }
    >();
    const likesGivenByUser = new Map<string, number>();
    const likesReceivedByUser = new Map<string, number>();
    const postingDaysByUser = new Map<string, Set<string>>();
    const missionAchievementByUser = new Map<string, number>();

    // グッジョブ投稿数・いいねもらった数・投稿日数
    for (const m of missionsInPeriod || []) {
      const createdBy = m.created_by;
      if (createdBy) {
        goodjobPostedByUser.set(
          createdBy,
          (goodjobPostedByUser.get(createdBy) || 0) + 1,
        );
        likesReceivedByUser.set(
          createdBy,
          (likesReceivedByUser.get(createdBy) || 0) + (m.likes_count || 0),
        );
        const dateStr = m.approved_at
          ? m.approved_at.slice(0, 10)
          : m.approved_at;
        if (dateStr) {
          if (!postingDaysByUser.has(createdBy)) {
            postingDaysByUser.set(createdBy, new Set());
          }
          postingDaysByUser.get(createdBy)?.add(dateStr);
        }
      }
    }

    // 称賛数・MVV別称賛数
    for (const p of praisedUsers) {
      const praisedUserId = p.praised_user_id;
      goodjobReceivedByUser.set(
        praisedUserId,
        (goodjobReceivedByUser.get(praisedUserId) || 0) + 1,
      );

      const mvvTypes = mvvByMission.get(p.user_mission_id) || [];
      if (!mvvCountByUser.has(praisedUserId)) {
        mvvCountByUser.set(praisedUserId, {
          passionate_execution: new Set(),
          supreme_relationships: new Set(),
          happiness_circulation: new Set(),
        });
      }
      const userMvv = mvvCountByUser.get(praisedUserId);
      if (userMvv) {
        for (const mt of mvvTypes) {
          if (mt === "passionate_execution")
            userMvv.passionate_execution.add(p.user_mission_id);
          else if (mt === "supreme_relationships")
            userMvv.supreme_relationships.add(p.user_mission_id);
          else if (mt === "happiness_circulation")
            userMvv.happiness_circulation.add(p.user_mission_id);
        }
      }
    }

    // いいね押した数
    for (const like of likesInPeriod || []) {
      const userId = like.user_id;
      likesGivenByUser.set(userId, (likesGivenByUser.get(userId) || 0) + 1);
    }

    // ミッション達成数
    for (const a of achievementsInPeriod || []) {
      const userId = a.user_id;
      if (userId) {
        missionAchievementByUser.set(
          userId,
          (missionAchievementByUser.get(userId) || 0) + 1,
        );
      }
    }

    // AssessmentRowに変換
    const data: AssessmentRow[] = users.map((user) => {
      const mvv = mvvCountByUser.get(user.id);
      return {
        userId: user.id,
        userName: user.name,
        prefecture: user.address_prefecture || "",
        goodjobPostedCount: goodjobPostedByUser.get(user.id) || 0,
        goodjobReceivedCount: goodjobReceivedByUser.get(user.id) || 0,
        passionateExecutionCount: mvv?.passionate_execution.size || 0,
        supremeRelationshipsCount: mvv?.supreme_relationships.size || 0,
        happinessCirculationCount: mvv?.happiness_circulation.size || 0,
        likesGivenCount: likesGivenByUser.get(user.id) || 0,
        likesReceivedCount: likesReceivedByUser.get(user.id) || 0,
        postingDaysCount: postingDaysByUser.get(user.id)?.size || 0,
        missionAchievementCount: missionAchievementByUser.get(user.id) || 0,
        totalXp: levelsMap.get(user.id)?.xp ?? 0,
        currentLevel: levelsMap.get(user.id)?.level ?? 1,
        registeredAt: user.registered_at || "",
      };
    });

    // ユーザー名でソート
    data.sort((a, b) => a.userName.localeCompare(b.userName, "ja"));

    return { success: true, data };
  } catch (error) {
    if (error instanceof Error && error.message === "経営者権限が必要です") {
      return { success: false, error: "経営者権限が必要です" };
    }
    console.error("査定データ取得エラー:", error);
    return {
      success: false,
      error: `予期しないエラーが発生しました: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }
}
