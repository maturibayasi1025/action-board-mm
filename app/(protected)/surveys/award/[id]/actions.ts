"use server";

import { logPostgrestError } from "@/lib/supabase/log-postgrest-error";
import { createClient } from "@/lib/supabase/server";
import { mapSurveyRpcErrorMessage } from "@/lib/survey/map-survey-rpc-error";
import {
  checkSurveySubmitAllowed,
  recordSurveySubmitSuccess,
} from "@/lib/survey/submit-throttle";
import type { SurveySubmitActionResult } from "@/lib/survey/survey-submit-result";
import { validateAwardResponses } from "@/lib/survey/validate-survey-responses";
import type { Json } from "@/lib/types/supabase";
import { revalidatePath } from "next/cache";

export type AwardQuestionType = "text" | "textarea" | "user_select";
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
  nominee_user_id?: string | null;
}

export async function submitAwardResponse(
  surveyId: string,
  responses: AwardResponse[],
  lateGrant?: { grantId: string; token: string } | null,
): Promise<SurveySubmitActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, message: "ログインが必要です" };
  }

  const isLatePath =
    lateGrant != null &&
    lateGrant.grantId.length > 0 &&
    lateGrant.token.length > 0;

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

  if (!isLatePath) {
    if (new Date(survey.end_date) < now) {
      return { ok: false, message: "アンケートの回答期限が過ぎています" };
    }
  } else if (new Date(survey.end_date) >= now) {
    return {
      ok: false,
      message: "期限内の回答は通常の回答画面からお願いします",
    };
  }

  const throttle = await checkSurveySubmitAllowed(supabase, surveyId, user.id);
  if (!throttle.ok) {
    return throttle;
  }

  const questions = await getAwardQuestions();
  const requiredCheck = validateAwardResponses(
    questions.map((q) => ({
      id: q.id,
      question_type: q.question_type,
      is_required: q.is_required,
      is_active: true,
    })),
    responses,
  );
  if (!requiredCheck.ok) {
    return requiredCheck;
  }

  const hasValidResponse = responses.some((r) => {
    const trimmed = r.text_value?.trim();
    const nomineeId = r.nominee_user_id?.trim();
    return (
      (trimmed && trimmed.length > 0) || (nomineeId && nomineeId.length > 0)
    );
  });

  if (!hasValidResponse) {
    return { ok: false, message: "回答を入力してください" };
  }

  const { error: rpcError } = await supabase.rpc("replace_award_responses", {
    p_survey_id: surveyId,
    p_rows: responses as unknown as Json,
    p_grant_id: isLatePath ? lateGrant.grantId : null,
    p_grant_token: isLatePath ? lateGrant.token : null,
  });

  if (rpcError) {
    logPostgrestError("submitAwardResponse replace_award_responses", rpcError, {
      surveyId,
      userId: user.id,
      rowCount: responses.length,
    });
    return { ok: false, message: mapSurveyRpcErrorMessage(rpcError.message) };
  }

  await recordSurveySubmitSuccess(supabase, surveyId, user.id);

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
    .select("question_id, text_value, nominee_user_id")
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
      nominee_user_id: r.nominee_user_id ?? null,
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
