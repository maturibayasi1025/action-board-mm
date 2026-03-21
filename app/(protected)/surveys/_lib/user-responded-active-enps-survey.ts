import { createClient } from "@/lib/supabase/server";

/**
 * 現在受付中の eNPS アンケート（is_active かつ期間内）のいずれかに、ユーザーが回答済みか。
 */
export async function userRespondedActiveEnpsSurvey(
  userId: string,
): Promise<boolean> {
  const supabase = await createClient();
  const nowIso = new Date().toISOString();

  const { data: activeSurveys, error: surveyError } = await supabase
    .from("enps_surveys")
    .select("id")
    .eq("is_active", true)
    .lte("start_date", nowIso)
    .gte("end_date", nowIso);

  if (surveyError) {
    console.error("Active eNPS surveys fetch error:", surveyError);
    return false;
  }

  const surveyIds = (activeSurveys ?? []).map((s) => s.id);
  if (surveyIds.length === 0) {
    return false;
  }

  const { data: rows, error: responseError } = await supabase
    .from("enps_responses")
    .select("id")
    .eq("user_id", userId)
    .in("survey_id", surveyIds)
    .limit(1);

  if (responseError) {
    console.error("eNPS responses check error:", responseError);
    return false;
  }

  return (rows?.length ?? 0) > 0;
}
