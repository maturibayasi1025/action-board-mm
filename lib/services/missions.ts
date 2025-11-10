import { createClient } from "@/lib/supabase/server";

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
  const now = new Date().toISOString();

  // 重要グッジョブを取得して、期間チェックをクライアント側で行う
  const { data, error } = await supabase
    .from("missions")
    .select("id, important_display_start_date, important_display_end_date")
    .eq("is_important", true)
    .eq("is_hidden", false);

  if (error || !data) {
    return false;
  }

  // 期間内または期間未設定のグッジョブをチェック
  const validMissions = data.filter((mission) => {
    const startDate = mission.important_display_start_date
      ? new Date(mission.important_display_start_date)
      : null;
    const endDate = mission.important_display_end_date
      ? new Date(mission.important_display_end_date)
      : null;
    const nowDate = new Date(now);

    // 開始日が設定されている場合、現在日時が開始日以降である必要がある
    if (startDate && nowDate < startDate) {
      return false;
    }

    // 終了日が設定されている場合、現在日時が終了日以前である必要がある
    if (endDate && nowDate > endDate) {
      return false;
    }

    return true;
  });

  return validMissions.length > 0;
}

/**
 * 重要グッジョブを取得
 * 現在日時が期間内、または期間未設定の重要グッジョブを取得
 */
export async function getImportantMissions() {
  const supabase = await createClient();
  const now = new Date().toISOString();

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

  // 期間内または期間未設定のグッジョブをフィルタリング
  const nowDate = new Date(now);
  const validMissions = data.filter((mission) => {
    const startDate = mission.important_display_start_date
      ? new Date(mission.important_display_start_date)
      : null;
    const endDate = mission.important_display_end_date
      ? new Date(mission.important_display_end_date)
      : null;

    // 開始日が設定されている場合、現在日時が開始日以降である必要がある
    if (startDate && nowDate < startDate) {
      return false;
    }

    // 終了日が設定されている場合、現在日時が終了日以前である必要がある
    if (endDate && nowDate > endDate) {
      return false;
    }

    return true;
  });

  return validMissions;
}
