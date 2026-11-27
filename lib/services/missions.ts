import "server-only";

import { fetchAllRows } from "@/lib/supabase/fetch-all-rows";
import { createClient } from "@/lib/supabase/server";
import type { Database, Tables } from "@/lib/types/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

/** ユーザーのグッジョブごとの達成回数。キーにないグッジョブは未達成 */
export async function getUserAchievementCountMap(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<Map<string, number>> {
  const achievements = await fetchAllRows<{ mission_id: string | null }>(
    (from, to) =>
      supabase
        .from("achievements")
        .select("mission_id")
        .eq("user_id", userId)
        .order("id", { ascending: true })
        .range(from, to),
  );
  const counts = new Map<string, number>();
  for (const { mission_id } of achievements) {
    if (mission_id) {
      counts.set(mission_id, (counts.get(mission_id) ?? 0) + 1);
    }
  }
  return counts;
}

type MissionWithDisplayDates = {
  important_display_start_date: string | null;
  important_display_end_date: string | null;
};

/** 重要グッジョブを表示期間でフィルタ */
export function filterImportantMissionsByDisplayPeriod<
  T extends MissionWithDisplayDates,
>(missions: T[], now: Date = new Date()): T[] {
  return missions.filter((mission) => {
    const startDate = mission.important_display_start_date
      ? new Date(mission.important_display_start_date)
      : null;
    const endDate = mission.important_display_end_date
      ? new Date(mission.important_display_end_date)
      : null;

    if (startDate && now < startDate) {
      return false;
    }

    if (endDate && now > endDate) {
      return false;
    }

    return true;
  });
}

export async function hasFeaturedMissions(): Promise<boolean> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("missions")
    .select("id", { count: "exact", head: true })
    .eq("is_featured", true);

  return !!count;
}

/**
 * 重要グッジョブが存在するかチェック
 * 現在日時が期間内、または期間未設定の重要グッジョブをチェック
 */
export async function hasImportantMissions(): Promise<boolean> {
  const supabase = await createClient();

  // 重要グッジョブを取得して、期間チェックをクライアント側で行う
  try {
    const data = await fetchAllRows<{
      id: string;
      important_display_start_date: string | null;
      important_display_end_date: string | null;
    }>((from, to) =>
      supabase
        .from("missions")
        .select("id, important_display_start_date, important_display_end_date")
        .eq("is_important", true)
        .eq("is_hidden", false)
        .order("id", { ascending: true })
        .range(from, to),
    );
    return filterImportantMissionsByDisplayPeriod(data).length > 0;
  } catch {
    return false;
  }
}

/**
 * 重要グッジョブを取得
 * 現在日時が期間内、または期間未設定の重要グッジョブを取得
 */
export async function getImportantMissions() {
  const supabase = await createClient();

  try {
    const data = await fetchAllRows<Tables<"missions">>((from, to) =>
      supabase
        .from("missions")
        .select("*")
        .eq("is_important", true)
        .eq("is_hidden", false)
        .order("difficulty", { ascending: true })
        .order("created_at", { ascending: false })
        .order("id", { ascending: true })
        .range(from, to),
    );
    return filterImportantMissionsByDisplayPeriod(data);
  } catch (error) {
    console.error("重要グッジョブ取得エラー:", error);
    return [];
  }
}
