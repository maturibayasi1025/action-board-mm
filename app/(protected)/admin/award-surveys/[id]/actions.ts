"use server";

import { createServiceClient } from "@/lib/supabase/server";
import { requireOwner } from "@/lib/utils/isOwner";

export async function getAwardSurveyDetail(surveyId: string) {
  await requireOwner();
  const supabase = await createServiceClient();

  const { data: survey, error } = await supabase
    .from("award_surveys")
    .select("*")
    .eq("id", surveyId)
    .single();

  if (error || !survey) {
    return null;
  }

  return survey;
}

export async function getAwardSurveyResponses(surveyId: string) {
  await requireOwner();
  const supabase = await createServiceClient();

  // 質問を取得
  const { data: questions } = await supabase
    .from("award_questions")
    .select(
      "id, question_text, question_type, question_group, display_order, is_active",
    )
    .eq("is_active", true)
    .order("display_order", { ascending: true });

  // 回答を取得
  const { data: responses, error } = await supabase
    .from("award_responses")
    .select("id, question_id, text_value, created_at, user_id")
    .eq("survey_id", surveyId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("回答の取得エラー:", error);
    return { questions: questions || [], responses: [], nominationSummary: {} };
  }

  // ユーザー情報を取得（RLSをバイパスするためサービスクライアントを使用）
  const userIds = Array.from(new Set((responses || []).map((r) => r.user_id)));
  let userMap = new Map<string, string>();
  if (userIds.length > 0) {
    const { data: users } = await supabase
      .from("private_users")
      .select("id, name")
      .in("id", userIds);
    userMap = new Map((users || []).map((u) => [u.id, u.name]));
  }

  const responsesWithUsers = (responses || []).map((r) => ({
    ...r,
    user_name: userMap.get(r.user_id) || "不明",
  }));

  // 他者指名（question_typeがtextで指名系の質問）の集計
  // display_order: 2, 5, 8, 11 が指名質問
  const nominationQuestionIds = new Set(
    (questions || [])
      .filter((q) => q.question_type === "text")
      .map((q) => q.id),
  );

  const nominationSummary: Record<string, number> = {};
  for (const response of responsesWithUsers) {
    if (
      nominationQuestionIds.has(response.question_id) &&
      response.text_value?.trim()
    ) {
      const nominee = response.text_value.trim();
      nominationSummary[nominee] = (nominationSummary[nominee] || 0) + 1;
    }
  }

  return {
    questions: questions || [],
    responses: responsesWithUsers,
    nominationSummary,
  };
}

export async function getAwardUnansweredUsers(surveyId: string) {
  await requireOwner();
  const supabase = await createServiceClient();

  // 回答したユーザーIDを取得
  const { data: answeredUsers } = await supabase
    .from("award_responses")
    .select("user_id")
    .eq("survey_id", surveyId);

  const answeredUserIds = new Set(answeredUsers?.map((u) => u.user_id) || []);

  // 全ユーザーを取得
  const { data: allUsers } = await supabase
    .from("private_users")
    .select("id, name");

  return (allUsers || []).filter((u) => !answeredUserIds.has(u.id));
}
