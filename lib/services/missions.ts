import "server-only";

import { createClient } from "@/lib/supabase/server";

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
  const { data, error } = await supabase
    .from("missions")
    .select("id, important_display_start_date, important_display_end_date")
    .eq("is_important", true)
    .eq("is_hidden", false);

  if (error || !data) {
    return false;
  }

  return filterImportantMissionsByDisplayPeriod(data).length > 0;
}

/**
 * 重要グッジョブを取得
 * 現在日時が期間内、または期間未設定の重要グッジョブを取得
 */
export async function getImportantMissions() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("missions")
    .select("*")
    .eq("is_important", true)
    .eq("is_hidden", false)
    .order("difficulty", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("重要グッジョブ取得エラー:", error);
    return [];
  }

  if (!data) {
    return [];
  }

  return filterImportantMissionsByDisplayPeriod(data);
}
