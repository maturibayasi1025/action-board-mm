import { createServiceClient } from "@/lib/supabase/server";
import {
  hashLateSubmissionToken,
  timingSafeEqualHex,
} from "@/lib/survey/late-submission-token";

/** 期限後回答フォーム表示可否（サービスロールで検証） */
export async function validateAwardLateGrantAccess(
  surveyId: string,
  grantId: string,
  tokenPlain: string,
  sessionUserId: string,
): Promise<boolean> {
  const supabase = await createServiceClient();
  const { data: grant } = await supabase
    .from("award_late_submission_grants")
    .select("id, user_id, survey_id, token_hash, expires_at, used_at")
    .eq("id", grantId)
    .eq("survey_id", surveyId)
    .maybeSingle();

  if (!grant || grant.user_id !== sessionUserId) return false;
  if (grant.used_at) return false;
  if (new Date(grant.expires_at) < new Date()) return false;
  const computed = await hashLateSubmissionToken(tokenPlain);
  if (!timingSafeEqualHex(grant.token_hash, computed)) {
    return false;
  }

  const { count } = await supabase
    .from("award_responses")
    .select("*", { count: "exact", head: true })
    .eq("survey_id", surveyId)
    .eq("user_id", sessionUserId);

  if ((count ?? 0) > 0) return false;

  const { data: survey } = await supabase
    .from("award_surveys")
    .select("end_date, is_active, start_date")
    .eq("id", surveyId)
    .single();

  if (!survey?.is_active) return false;
  if (new Date(survey.start_date) > new Date()) return false;
  if (new Date(survey.end_date) >= new Date()) return false;
  return true;
}

export async function validateEnpsLateGrantAccess(
  surveyId: string,
  grantId: string,
  tokenPlain: string,
  sessionUserId: string,
): Promise<boolean> {
  const supabase = await createServiceClient();
  const { data: grant } = await supabase
    .from("enps_late_submission_grants")
    .select("id, user_id, survey_id, token_hash, expires_at, used_at")
    .eq("id", grantId)
    .eq("survey_id", surveyId)
    .maybeSingle();

  if (!grant || grant.user_id !== sessionUserId) return false;
  if (grant.used_at) return false;
  if (new Date(grant.expires_at) < new Date()) return false;
  const computed = await hashLateSubmissionToken(tokenPlain);
  if (!timingSafeEqualHex(grant.token_hash, computed)) {
    return false;
  }

  const { count } = await supabase
    .from("enps_responses")
    .select("*", { count: "exact", head: true })
    .eq("survey_id", surveyId)
    .eq("user_id", sessionUserId);

  if ((count ?? 0) > 0) return false;

  const { data: survey } = await supabase
    .from("enps_surveys")
    .select("end_date, is_active, start_date")
    .eq("id", surveyId)
    .single();

  if (!survey?.is_active) return false;
  if (new Date(survey.start_date) > new Date()) return false;
  if (new Date(survey.end_date) >= new Date()) return false;
  return true;
}
