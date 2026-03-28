"use server";

import { createServiceClient } from "@/lib/supabase/server";
import {
  fetchGlobalExcludedUserIds,
  filterUnansweredPrivateUsers,
} from "@/lib/survey/unanswered-candidates";
import type { AwardNominationDetail } from "@/lib/types/award-nomination";
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
    return {
      questions: questions || [],
      responses: [],
      nominationDetails: [] as AwardNominationDetail[],
    };
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

  // 他者指名（question_type が text の質問＝各バリューの指名欄）の集計
  const nominationQuestions = (questions || []).filter(
    (q) => q.question_type === "text",
  );
  const nominationQuestionIds = new Set(nominationQuestions.map((q) => q.id));
  const questionIdToGroup = new Map(
    nominationQuestions.map((q) => [q.id, q.question_group]),
  );

  const aggregate = new Map<
    string,
    { total: number; byGroup: Partial<Record<string, number>> }
  >();

  for (const response of responsesWithUsers) {
    if (
      !nominationQuestionIds.has(response.question_id) ||
      !response.text_value?.trim()
    ) {
      continue;
    }
    const nominee = response.text_value.trim();
    const group = questionIdToGroup.get(response.question_id);
    if (!group) continue;

    let row = aggregate.get(nominee);
    if (!row) {
      row = { total: 0, byGroup: {} };
      aggregate.set(nominee, row);
    }
    row.total += 1;
    row.byGroup[group] = (row.byGroup[group] || 0) + 1;
  }

  const nominationDetails: AwardNominationDetail[] = Array.from(
    aggregate.entries(),
  )
    .map(([name, { total, byGroup }]) => ({ name, total, byGroup }))
    .sort((a, b) => b.total - a.total);

  return {
    questions: questions || [],
    responses: responsesWithUsers,
    nominationDetails,
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

  const excludedUserIds = await fetchGlobalExcludedUserIds(supabase);

  // 全ユーザーを取得
  const { data: allUsers } = await supabase
    .from("private_users")
    .select("id, name");

  return filterUnansweredPrivateUsers(
    allUsers ?? [],
    answeredUserIds,
    excludedUserIds,
  );
}
