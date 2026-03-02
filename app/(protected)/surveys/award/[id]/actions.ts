"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type AwardQuestionType = "text" | "textarea";
export type AwardQuestionGroup =
  | "passionate_execution"
  | "supreme_relations"
  | "happiness_cycle"
  | "team_value";

export interface AwardQuestion {
  id: string;
  question_text: string;
  question_type: AwardQuestionType;
  question_group: AwardQuestionGroup;
  display_order: number;
  is_required: boolean;
  placeholder: string | null;
  help_text: string | null;
}

export interface AwardResponse {
  question_id: string;
  text_value?: string | null;
}

export async function submitAwardResponse(
  surveyId: string,
  responses: AwardResponse[],
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("ログインが必要です");
  }

  // アンケートの存在確認と有効性チェック
  const { data: survey, error: surveyError } = await supabase
    .from("award_surveys")
    .select("id, is_active, start_date, end_date")
    .eq("id", surveyId)
    .single();

  if (surveyError || !survey) {
    throw new Error("アンケートが見つかりません");
  }

  if (!survey.is_active) {
    throw new Error("このアンケートは無効です");
  }

  const now = new Date();
  if (new Date(survey.start_date) > now) {
    throw new Error("アンケートはまだ開始されていません");
  }

  if (new Date(survey.end_date) < now) {
    throw new Error("アンケートの回答期限が過ぎています");
  }

  // 既存の回答を削除（更新のため）
  const { error: deleteError } = await supabase
    .from("award_responses")
    .delete()
    .eq("survey_id", surveyId)
    .eq("user_id", user.id);

  if (deleteError) {
    console.error("既存回答の削除エラー:", deleteError);
  }

  // 新しい回答を挿入
  const responseData = responses.map((r) => ({
    survey_id: surveyId,
    user_id: user.id,
    question_id: r.question_id,
    text_value: r.text_value ?? null,
  }));

  const { error: insertError } = await supabase
    .from("award_responses")
    .insert(responseData);

  if (insertError) {
    console.error("回答の挿入エラー:", insertError);
    throw new Error("回答の送信に失敗しました");
  }

  revalidatePath(`/surveys/award/${surveyId}`);
  return { success: true };
}

export async function getAwardSurvey(surveyId: string) {
  const supabase = await createClient();

  const { data: survey, error } = await supabase
    .from("award_surveys")
    .select("*")
    .eq("id", surveyId)
    .eq("is_active", true)
    .single();

  if (error || !survey) {
    return null;
  }

  return survey;
}

export async function getAwardQuestions(): Promise<AwardQuestion[]> {
  const supabase = await createClient();

  const { data: questions, error } = await supabase
    .from("award_questions")
    .select("*")
    .eq("is_active", true)
    .order("display_order", { ascending: true });

  if (error) {
    console.error("質問の取得エラー:", error);
    return [];
  }

  return (questions || []) as AwardQuestion[];
}

export async function getUserAwardResponses(
  surveyId: string,
): Promise<Record<string, AwardResponse>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {};
  }

  const { data: responses, error } = await supabase
    .from("award_responses")
    .select("question_id, text_value")
    .eq("survey_id", surveyId)
    .eq("user_id", user.id);

  if (error) {
    console.error("回答の取得エラー:", error);
    return {};
  }

  const responseMap: Record<string, AwardResponse> = {};
  for (const r of responses || []) {
    responseMap[r.question_id] = {
      question_id: r.question_id,
      text_value: r.text_value ?? null,
    };
  }

  return responseMap;
}

export async function getCurrentUserName(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: profile } = await supabase
    .from("public_user_profiles")
    .select("name")
    .eq("id", user.id)
    .single();

  return profile?.name ?? null;
}
