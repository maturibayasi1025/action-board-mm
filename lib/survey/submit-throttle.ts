import type { SupabaseClient } from "@supabase/supabase-js";

/** 同一アンケートへの再送信（更新）の最短間隔 */
export const SURVEY_SUBMIT_MIN_INTERVAL_MS = 5000;

/** 連続更新が早すぎるとき（Server Action は throw せずこの文言を返すこと） */
export const SURVEY_SUBMIT_TOO_FAST_MESSAGE =
  "更新が早すぎます。しばらくしてから再度お試しください。";

type ThrottleCheckResult = { ok: true } | { ok: false; message: string };

export async function checkSurveySubmitAllowed(
  supabase: SupabaseClient,
  surveyId: string,
  userId: string,
): Promise<ThrottleCheckResult> {
  const { data, error } = await supabase
    .from("survey_submit_throttle")
    .select("last_submitted_at")
    .eq("survey_id", surveyId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("survey_submit_throttle select", error);
    return { ok: false, message: "送信の確認に失敗しました" };
  }

  if (data?.last_submitted_at) {
    const last = new Date(data.last_submitted_at).getTime();
    if (Date.now() - last < SURVEY_SUBMIT_MIN_INTERVAL_MS) {
      return { ok: false, message: SURVEY_SUBMIT_TOO_FAST_MESSAGE };
    }
  }

  return { ok: true };
}

export async function recordSurveySubmitSuccess(
  supabase: SupabaseClient,
  surveyId: string,
  userId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
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
    return { ok: false, message: "送信の記録に失敗しました" };
  }

  return { ok: true };
}
