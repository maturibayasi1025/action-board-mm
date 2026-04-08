"use server";

import { defaultUrl } from "@/lib/metadata";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import {
  generateLateSubmissionSecret,
  hashLateSubmissionToken,
} from "@/lib/survey/late-submission-token";
import { requireOwner } from "@/lib/utils/isOwner";

const GRANT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type AwardLateGrantRow = {
  id: string;
  user_id: string;
  user_name: string;
  expires_at: string;
  used_at: string | null;
  created_at: string;
};

export async function listAwardLateSubmissionGrants(
  surveyId: string,
): Promise<AwardLateGrantRow[]> {
  await requireOwner();
  const supabase = await createServiceClient();

  const { data: rows, error } = await supabase
    .from("award_late_submission_grants")
    .select("id, user_id, expires_at, used_at, created_at")
    .eq("survey_id", surveyId)
    .order("created_at", { ascending: false });

  if (error || !rows?.length) {
    return [];
  }

  const userIds = rows.map((r) => r.user_id);
  const { data: users } = await supabase
    .from("private_users")
    .select("id, name")
    .in("id", userIds);

  const nameMap = new Map((users || []).map((u) => [u.id, u.name]));

  return rows.map((r) => ({
    id: r.id,
    user_id: r.user_id,
    user_name: nameMap.get(r.user_id) || "不明",
    expires_at: r.expires_at,
    used_at: r.used_at,
    created_at: r.created_at,
  }));
}

export type CreateAwardLateGrantResult =
  | {
      ok: true;
      grantId: string;
      secretToken: string;
      expiresAt: string;
      answerUrl: string;
    }
  | { ok: false; message: string };

export async function createAwardLateSubmissionGrant(
  surveyId: string,
  targetUserId: string,
): Promise<CreateAwardLateGrantResult> {
  await requireOwner();

  const authClient = await createClient();
  const {
    data: { user: owner },
  } = await authClient.auth.getUser();
  if (!owner) {
    return { ok: false, message: "ログインが必要です" };
  }

  const supabase = await createServiceClient();

  const { data: survey, error: surveyErr } = await supabase
    .from("award_surveys")
    .select("id, end_date, is_active, start_date")
    .eq("id", surveyId)
    .single();

  if (surveyErr || !survey) {
    return { ok: false, message: "アンケートが見つかりません" };
  }
  if (!survey.is_active) {
    return { ok: false, message: "このアンケートは無効です" };
  }
  const now = new Date();
  if (new Date(survey.start_date) > now) {
    return { ok: false, message: "アンケートはまだ開始されていません" };
  }
  if (new Date(survey.end_date) >= now) {
    return {
      ok: false,
      message: "期限後付与は、回答終了日時を過ぎたあとに作成できます",
    };
  }

  const { count } = await supabase
    .from("award_responses")
    .select("*", { count: "exact", head: true })
    .eq("survey_id", surveyId)
    .eq("user_id", targetUserId);

  if ((count ?? 0) > 0) {
    return {
      ok: false,
      message: "このユーザーはすでに回答があるため付与できません",
    };
  }

  const secret = generateLateSubmissionSecret();
  const tokenHash = hashLateSubmissionToken(secret);
  const expiresAt = new Date(Date.now() + GRANT_TTL_MS);

  const { data: inserted, error: insErr } = await supabase
    .from("award_late_submission_grants")
    .insert({
      survey_id: surveyId,
      user_id: targetUserId,
      token_hash: tokenHash,
      expires_at: expiresAt.toISOString(),
      created_by_user_id: owner.id,
    })
    .select("id")
    .single();

  if (insErr || !inserted) {
    console.error("createAwardLateSubmissionGrant", insErr);
    return { ok: false, message: "付与の作成に失敗しました" };
  }

  const base = defaultUrl.replace(/\/$/, "");
  const answerUrl = `${base}/surveys/award/${surveyId}/late?g=${inserted.id}&t=${encodeURIComponent(secret)}`;

  return {
    ok: true,
    grantId: inserted.id,
    secretToken: secret,
    expiresAt: expiresAt.toISOString(),
    answerUrl,
  };
}
