"use server";

import { logPostgrestError } from "@/lib/supabase/log-postgrest-error";
import { createClient } from "@/lib/supabase/server";
import {
  checkSurveySubmitAllowed,
  recordSurveySubmitSuccess,
} from "@/lib/survey/submit-throttle";
import type { SurveySubmitActionResult } from "@/lib/survey/survey-submit-result";
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
): Promise<SurveySubmitActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, message: "ログインが必要です" };
  }

  // アンケートの存在確認と有効性チェック
  const { data: survey, error: surveyError } = await supabase
    .from("award_surveys")
    .select("id, is_active, start_date, end_date")
    .eq("id", surveyId)
    .single();

  if (surveyError || !survey) {
    return { ok: false, message: "アンケートが見つかりません" };
  }

  if (!survey.is_active) {
    return { ok: false, message: "このアンケートは無効です" };
  }

  const now = new Date();
  if (new Date(survey.start_date) > now) {
    return { ok: false, message: "アンケートはまだ開始されていません" };
  }

  if (new Date(survey.end_date) < now) {
    return { ok: false, message: "アンケートの回答期限が過ぎています" };
  }

  const throttle = await checkSurveySubmitAllowed(supabase, surveyId, user.id);
  if (!throttle.ok) {
    return throttle;
  }

  // 既存の回答を削除（更新のため）
  const { error: deleteError } = await supabase
    .from("award_responses")
    .delete()
    .eq("survey_id", surveyId)
    .eq("user_id", user.id);

  if (deleteError) {
    logPostgrestError(
      "submitAwardResponse delete award_responses",
      deleteError,
      { surveyId, userId: user.id },
    );
    return {
      ok: false,
      message: "回答の更新に失敗しました（既存データの削除）",
    };
  }

  const responseData = responses
    .map((r) => {
      const trimmed = r.text_value?.trim();
      return {
        survey_id: surveyId,
        user_id: user.id,
        question_id: r.question_id,
        text_value: trimmed && trimmed.length > 0 ? trimmed : null,
      };
    })
    .filter((row) => row.text_value != null);

  if (responseData.length === 0) {
    return { ok: false, message: "回答を入力してください" };
  }

  const { error: insertError } = await supabase
    .from("award_responses")
    .insert(responseData);

  if (insertError) {
    logPostgrestError(
      "submitAwardResponse insert award_responses",
      insertError,
      { surveyId, userId: user.id, rowCount: responseData.length },
    );
    return { ok: false, message: "回答の送信に失敗しました" };
  }

  const recorded = await recordSurveySubmitSuccess(supabase, surveyId, user.id);
  if (!recorded.ok) {
    return recorded;
  }

  revalidatePath(`/surveys/award/${surveyId}`);
  revalidatePath("/user-missions/new");
  return { ok: true, submittedByUserId: user.id };
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
