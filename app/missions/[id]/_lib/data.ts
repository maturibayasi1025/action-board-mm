import { createClient as createServerClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/types/supabase";
import { nanoid } from "nanoid";
import { fetchSubmissionHistory } from "./submission-history";
import type { MissionPageData, SubmissionData } from "./types";

export async function getMissionData(
  missionId: string,
): Promise<Tables<"missions"> | null> {
  const supabase = await createServerClient();

  const { data: missionData, error } = await supabase
    .from("missions")
    .select("*, required_artifact_type, max_achievement_count")
    .eq("id", missionId)
    .single();

  if (error) {
    console.error("Mission fetch error:", error);
    return null;
  }

  return missionData;
}

export async function getTotalAchievementCount(
  missionId: string,
): Promise<number> {
  const supabase = await createServerClient();

  const { data: countData, error } = await supabase
    .from("mission_achievement_count_view")
    .select("achievement_count")
    .eq("mission_id", missionId)
    .single();

  if (error) {
    console.error("Count fetch error:", error);
    return 0;
  }

  return countData?.achievement_count || 0;
}

/** 本人の提出履歴。取得に失敗したら null（0 件とは区別する） */
export async function getSubmissionHistory(
  userId: string,
  missionId: string,
): Promise<SubmissionData[] | null> {
  const supabase = await createServerClient();
  try {
    return await fetchSubmissionHistory(supabase, userId, missionId);
  } catch (error) {
    console.error("Submission history fetch error:", error);
    return null;
  }
}

export async function getMissionMainLink(
  missionId: string,
): Promise<Tables<"mission_main_links"> | null> {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from("mission_main_links")
    .select("*")
    .eq("mission_id", missionId)
    .maybeSingle();

  if (error) {
    console.error("Mission main link fetch error:", error);
    return null;
  }

  return data;
}

export async function getMissionPageData(
  missionId: string,
  userId?: string,
): Promise<MissionPageData | null> {
  const mission = await getMissionData(missionId);

  if (!mission) return null;

  let submissionHistory: SubmissionData[] | null = [];
  let referralCode: string | null = null;

  if (userId) {
    submissionHistory = await getSubmissionHistory(userId, missionId);
    referralCode = await getReferralCode(userId);
  }

  // 総達成回数の取得
  const totalAchievementCount = await getTotalAchievementCount(missionId);

  // メインリンクの取得
  const mainLink = await getMissionMainLink(missionId);

  return {
    mission,
    submissionHistory,
    totalAchievementCount,
    referralCode,
    mainLink,
  };
}

// ログインユーザーに紐づくリファラルコードの取得
export async function getReferralCode(userId: string): Promise<string> {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from("user_referral")
    .select("referral_code")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("Referral code fetch error:", error.message);
    throw new Error("紹介コードの取得に失敗しました");
  }

  // データがなければ作成
  if (data) {
    return data.referral_code;
  }

  // ユーザーに紐づく紹介コードが存在しない場合は新規作成
  const referralCode = nanoid(8); // 8桁ランダムコード

  const { data: insertData, error: insertError } = await supabase
    .from("user_referral")
    .insert({
      user_id: userId,
      referral_code: referralCode,
    })
    .select()
    .single();

  if (insertError) {
    console.error("Referral code insert error:", insertError.message);
    throw new Error("紹介コードの作成に失敗しました");
  }
  return insertData.referral_code;
}
