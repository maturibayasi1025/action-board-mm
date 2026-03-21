import type { Database } from "@/lib/types/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { SurveyKind } from "./linked-post-mission";

/**
 * いま受付中のアンケート（enps / award）の期間内に、当該ミッションの達成記録があるか。
 * 受付中アンケートが無い場合は false（達成チェック対象外）。
 */
export async function hasAchievementInActiveSurveyPeriod(
  supabase: SupabaseClient<Database>,
  userId: string,
  missionId: string,
  kind: SurveyKind,
): Promise<boolean> {
  const nowIso = new Date().toISOString();
  const surveyTable = kind === "award" ? "award_surveys" : "enps_surveys";

  const { data: activeSurveys, error: surveyError } = await supabase
    .from(surveyTable)
    .select("start_date, end_date")
    .eq("is_active", true)
    .lte("start_date", nowIso)
    .gte("end_date", nowIso);

  if (surveyError) {
    console.error(
      `[survey-linked-achievement] active ${surveyTable} fetch:`,
      surveyError,
    );
    return false;
  }

  const windows = activeSurveys ?? [];
  if (windows.length === 0) {
    return false;
  }

  for (const row of windows) {
    const { data: rows, error: achError } = await supabase
      .from("achievements")
      .select("id")
      .eq("user_id", userId)
      .eq("mission_id", missionId)
      .gte("created_at", row.start_date)
      .lte("created_at", row.end_date)
      .limit(1);

    if (achError) {
      console.error(
        "[survey-linked-achievement] achievements query:",
        achError,
      );
      continue;
    }
    if ((rows?.length ?? 0) > 0) {
      return true;
    }
  }

  return false;
}
