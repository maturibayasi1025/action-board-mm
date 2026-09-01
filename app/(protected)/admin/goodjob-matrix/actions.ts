"use server";

import { createServiceClient } from "@/lib/supabase/server";
import { requireOwner } from "@/lib/utils/isOwner";

export interface MatrixRow {
  userId: string;
  userName: string;
  passionateExecution: number;
  supremeRelationships: number;
  happinessCirculation: number;
  total: number;
}

export interface GoodjobDetail {
  id: string;
  title: string;
  content: string;
  createdByName: string;
  approvedAt: string;
}

/**
 * マトリクスデータを取得する
 * @param startDate 開始日（ISO文字列）
 * @param endDate 終了日（ISO文字列）
 */
export async function getMatrixData(
  startDate: string,
  endDate: string,
): Promise<
  { success: true; data: MatrixRow[] } | { success: false; error: string }
> {
  try {
    await requireOwner();

    const supabase = await createServiceClient();

    // 期間内の承認済みグッジョブを取得
    const { data: missions, error: missionsError } = await supabase
      .from("user_missions")
      .select("id, approved_at")
      .eq("status", "approved")
      .gte("approved_at", startDate)
      .lte("approved_at", endDate);

    if (missionsError) {
      console.error("グッジョブ取得エラー:", missionsError);
      return {
        success: false,
        error: `グッジョブ取得に失敗しました: ${missionsError.message}`,
      };
    }

    if (!missions || missions.length === 0) {
      return { success: true, data: [] };
    }

    const missionIds = missions.map((m) => m.id);

    // 称賛対象ユーザーを取得
    const { data: praisedUsers, error: praisedError } = await supabase
      .from("user_mission_praised_users")
      .select("user_mission_id, praised_user_id")
      .in("user_mission_id", missionIds);

    if (praisedError) {
      console.error("称賛ユーザー取得エラー:", praisedError);
      return {
        success: false,
        error: `称賛ユーザー取得に失敗しました: ${praisedError.message}`,
      };
    }

    // MVV項目を取得
    const { data: mvvItems, error: mvvError } = await supabase
      .from("user_mission_mvv_items")
      .select("user_mission_id, mvv_type")
      .in("user_mission_id", missionIds);

    if (mvvError) {
      console.error("MVV項目取得エラー:", mvvError);
      return {
        success: false,
        error: `MVV項目取得に失敗しました: ${mvvError.message}`,
      };
    }

    // データを集計
    // Map<userId, Map<mvvType, count>>
    const countMap = new Map<string, Map<string, Set<string>>>();

    if (praisedUsers && mvvItems) {
      // グッジョブIDごとにMVV項目をマップ
      const mvvMap = new Map<string, string[]>();
      for (const item of mvvItems) {
        if (!mvvMap.has(item.user_mission_id)) {
          mvvMap.set(item.user_mission_id, []);
        }
        mvvMap.get(item.user_mission_id)?.push(item.mvv_type);
      }

      // 称賛ユーザーごとにカウント
      for (const praised of praisedUsers) {
        const userId = praised.praised_user_id;
        const missionId = praised.user_mission_id;
        const mvvTypes = mvvMap.get(missionId) || [];

        if (!countMap.has(userId)) {
          countMap.set(
            userId,
            new Map([
              ["passionate_execution", new Set<string>()],
              ["supreme_relationships", new Set<string>()],
              ["happiness_circulation", new Set<string>()],
            ]),
          );
        }

        const userMap = countMap.get(userId);
        if (userMap) {
          for (const mvvType of mvvTypes) {
            const typeSet = userMap.get(mvvType);
            if (typeSet) {
              typeSet.add(missionId);
            }
          }
        }
      }
    }

    // ユーザー名を取得
    const userIds = Array.from(countMap.keys());
    if (userIds.length === 0) {
      return { success: true, data: [] };
    }

    const { data: users, error: usersError } = await supabase
      .from("private_users")
      .select("id, name")
      .in("id", userIds)
      .is("suspended_at", null);

    if (usersError) {
      console.error("ユーザー取得エラー:", usersError);
      return {
        success: false,
        error: `ユーザー取得に失敗しました: ${usersError.message}`,
      };
    }

    const userMap = new Map(users?.map((u) => [u.id, u.name]) || []);

    // MatrixRowに変換
    const matrixData: MatrixRow[] = [];
    for (const [userId, typeMap] of Array.from(countMap.entries())) {
      if (!userMap.has(userId)) {
        continue;
      }
      const passionateExecution =
        typeMap.get("passionate_execution")?.size || 0;
      const supremeRelationships =
        typeMap.get("supreme_relationships")?.size || 0;
      const happinessCirculation =
        typeMap.get("happiness_circulation")?.size || 0;
      const total =
        passionateExecution + supremeRelationships + happinessCirculation;

      matrixData.push({
        userId,
        userName: userMap.get(userId) || "不明",
        passionateExecution,
        supremeRelationships,
        happinessCirculation,
        total,
      });
    }

    // ユーザー名でソート
    matrixData.sort((a, b) => a.userName.localeCompare(b.userName, "ja"));

    return { success: true, data: matrixData };
  } catch (error) {
    if (error instanceof Error && error.message === "経営者権限が必要です") {
      return { success: false, error: "経営者権限が必要です" };
    }
    console.error("マトリクスデータ取得エラー:", error);
    return {
      success: false,
      error: `予期しないエラーが発生しました: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }
}

/**
 * 特定ユーザー・バリューのグッジョブ詳細を取得する
 */
export async function getGoodjobDetails(
  userId: string,
  mvvType:
    | "passionate_execution"
    | "supreme_relationships"
    | "happiness_circulation",
  startDate: string,
  endDate: string,
): Promise<
  { success: true; data: GoodjobDetail[] } | { success: false; error: string }
> {
  try {
    await requireOwner();

    const supabase = await createServiceClient();

    // 期間内の承認済みグッジョブを取得
    const { data: missions, error: missionsError } = await supabase
      .from("user_missions")
      .select("id, approved_at")
      .eq("status", "approved")
      .gte("approved_at", startDate)
      .lte("approved_at", endDate);

    if (missionsError) {
      console.error("グッジョブ取得エラー:", missionsError);
      return {
        success: false,
        error: `グッジョブ取得に失敗しました: ${missionsError.message}`,
      };
    }

    if (!missions || missions.length === 0) {
      return { success: true, data: [] };
    }

    const missionIds = missions.map((m) => m.id);

    // 指定ユーザーが称賛されたグッジョブIDを取得
    const { data: praisedUsers, error: praisedError } = await supabase
      .from("user_mission_praised_users")
      .select("user_mission_id")
      .in("user_mission_id", missionIds)
      .eq("praised_user_id", userId);

    if (praisedError) {
      console.error("称賛ユーザー取得エラー:", praisedError);
      return {
        success: false,
        error: `称賛ユーザー取得に失敗しました: ${praisedError.message}`,
      };
    }

    if (!praisedUsers || praisedUsers.length === 0) {
      return { success: true, data: [] };
    }

    const praisedMissionIds = praisedUsers.map((p) => p.user_mission_id);

    // 指定MVV項目を持つグッジョブIDを取得
    const { data: mvvItems, error: mvvError } = await supabase
      .from("user_mission_mvv_items")
      .select("user_mission_id")
      .in("user_mission_id", praisedMissionIds)
      .eq("mvv_type", mvvType);

    if (mvvError) {
      console.error("MVV項目取得エラー:", mvvError);
      return {
        success: false,
        error: `MVV項目取得に失敗しました: ${mvvError.message}`,
      };
    }

    if (!mvvItems || mvvItems.length === 0) {
      return { success: true, data: [] };
    }

    const targetMissionIds = mvvItems.map((m) => m.user_mission_id);

    // グッジョブ詳細を取得
    const { data: missionDetails, error: detailsError } = await supabase
      .from("user_missions")
      .select("id, title, content, created_by, approved_at")
      .in("id", targetMissionIds)
      .order("approved_at", { ascending: false });

    if (detailsError) {
      console.error("グッジョブ詳細取得エラー:", detailsError);
      return {
        success: false,
        error: `グッジョブ詳細取得に失敗しました: ${detailsError.message}`,
      };
    }

    if (!missionDetails || missionDetails.length === 0) {
      return { success: true, data: [] };
    }

    // 作成者名を取得
    const creatorIds = Array.from(
      new Set(missionDetails.map((m) => m.created_by)),
    );
    const { data: creators, error: creatorsError } = await supabase
      .from("private_users")
      .select("id, name")
      .in("id", creatorIds)
      .is("suspended_at", null);

    if (creatorsError) {
      console.error("作成者取得エラー:", creatorsError);
      // エラーでも続行（名前が「不明」になるだけ）
    }

    const creatorMap = new Map(creators?.map((c) => [c.id, c.name]) || []);

    // GoodjobDetailに変換
    const details: GoodjobDetail[] = missionDetails.map((mission) => ({
      id: mission.id,
      title: mission.title,
      content: mission.content || "",
      createdByName: creatorMap.get(mission.created_by) || "不明",
      approvedAt: mission.approved_at || "",
    }));

    return { success: true, data: details };
  } catch (error) {
    if (error instanceof Error && error.message === "経営者権限が必要です") {
      return { success: false, error: "経営者権限が必要です" };
    }
    console.error("グッジョブ詳細取得エラー:", error);
    return {
      success: false,
      error: `予期しないエラーが発生しました: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }
}
