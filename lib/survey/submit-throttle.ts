import type { SupabaseClient } from "@supabase/supabase-js";

/** 同一アンケートへの再送信（更新）の最短間隔 */
export const SURVEY_SUBMIT_MIN_INTERVAL_MS = 5000;

export async function assertSurveySubmitAllowed(
  supabase: SupabaseClient,
  surveyId: string,
  userId: string,
): Promise<void> {
  const { data, error } = await supabase
    .from("survey_submit_throttle")
    .select("last_submitted_at")
    .eq("survey_id", surveyId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("survey_submit_throttle select", error);
    throw new Error("送信の確認に失敗しました");
  }

  if (data?.last_submitted_at) {
    const last = new Date(data.last_submitted_at).getTime();
    if (Date.now() - last < SURVEY_SUBMIT_MIN_INTERVAL_MS) {
      throw new Error(
        "短時間に繰り返し送信できません。しばらくしてからお試しください。",
      );
    }
  }
}

export async function recordSurveySubmitSuccess(
  supabase: SupabaseClient,
  surveyId: string,
  userId: string,
): Promise<void> {
  const { error } = await supabase.from("survey_submit_throttle").upsert(
    {
      survey_id: surveyId,
      user_id: userId,
      last_submitted_at: new Date().toISOString(),
    },
    { onConflict: "survey_id,user_id" },
  );

  if (error) {
    console.error("survey_submit_throttle upsert", error);
    throw new Error("送信の記録に失敗しました");
  }
}
