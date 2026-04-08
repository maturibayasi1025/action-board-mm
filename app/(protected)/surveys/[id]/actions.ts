"use server";

import { logPostgrestError } from "@/lib/supabase/log-postgrest-error";
import { createClient } from "@/lib/supabase/server";
import { mapSurveyRpcErrorMessage } from "@/lib/survey/map-survey-rpc-error";
import {
  checkSurveySubmitAllowed,
  recordSurveySubmitSuccess,
} from "@/lib/survey/submit-throttle";
import type { SurveySubmitActionResult } from "@/lib/survey/survey-submit-result";
import { validateEnpsResponses } from "@/lib/survey/validate-survey-responses";
import type { Json } from "@/lib/types/supabase";
import { revalidatePath } from "next/cache";

/** CHECK enps_responses_score_or_text 適合行のみ INSERT する */
function buildEnpsResponseInsertRows(
  surveyId: string,
  userId: string,
  responses: Array<{
    question_id: string;
    score_value?: number | null;
    text_value?: string | null;
  }>,
): Array<{
  survey_id: string;
  user_id: string;
  question_id: string;
  score_value: number | null;
  text_value: string | null;
}> {
  const rows: Array<{
    survey_id: string;
    user_id: string;
    question_id: string;
    score_value: number | null;
    text_value: string | null;
  }> = [];

  for (const r of responses) {
    const score = r.score_value ?? null;
    const textTrimmed = r.text_value?.trim();
    const text = textTrimmed && textTrimmed.length > 0 ? textTrimmed : null;

    if (score === null && text === null) {
      continue;
    }
    if (score !== null && text !== null) {
      throw new Error(
        "送信データが不正です。各質問はスコアまたはテキストのどちらか一方のみ入力してください。",
      );
    }
    rows.push({
      survey_id: surveyId,
      user_id: userId,
      question_id: r.question_id,
      score_value: score,
      text_value: text,
    });
  }

  return rows;
}

type EnpsQuestionRow = {
  id: string;
  question_text: string;
  question_type: "score_0_10" | "text";
  display_order: number;
  is_required: boolean;
  is_active: boolean;
  parent_question_id: string | null;
  created_at: string;
  updated_at: string;
};

export async function submitSurveyResponse(
  surveyId: string,
  responses: Array<{
    question_id: string;
    score_value?: number | null;
    text_value?: string | null;
  }>,
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
    .from("enps_surveys")
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

  const questions = await getSurveyQuestions();
  const requiredCheck = validateEnpsResponses(questions, responses);
  if (!requiredCheck.ok) {
    return requiredCheck;
  }

  let responseData: ReturnType<typeof buildEnpsResponseInsertRows>;
  try {
    responseData = buildEnpsResponseInsertRows(surveyId, user.id, responses);
  } catch (e) {
    const message =
      e instanceof Error
        ? e.message
        : "送信データが不正です。やり直してください。";
    return { ok: false, message };
  }

  if (responseData.length === 0) {
    return { ok: false, message: "回答に有効なデータがありません" };
  }

  const rpcPayload = responseData.map((row) => ({
    question_id: row.question_id,
    score_value: row.score_value,
    text_value: row.text_value,
  }));

  const { error: rpcError } = await supabase.rpc("replace_enps_responses", {
    p_survey_id: surveyId,
    p_rows: rpcPayload as Json,
    p_grant_id: isLatePath ? lateGrant.grantId : null,
    p_grant_token: isLatePath ? lateGrant.token : null,
  });

  if (rpcError) {
    logPostgrestError("submitSurveyResponse replace_enps_responses", rpcError, {
      surveyId,
      userId: user.id,
      rowCount: responseData.length,
    });
    return { ok: false, message: mapSurveyRpcErrorMessage(rpcError.message) };
  }

  await recordSurveySubmitSuccess(supabase, surveyId, user.id);

  revalidatePath(`/surveys/${surveyId}`);
  revalidatePath("/user-missions/new");
  return { ok: true, submittedByUserId: user.id };
}

export async function getSurvey(surveyId: string) {
  const supabase = await createClient();

  const { data: survey, error } = await supabase
    .from("enps_surveys")
    .select("*")
    .eq("id", surveyId)
    .eq("is_active", true)
    .single();

  if (error || !survey) {
    return null;
  }

  return survey;
}

export async function getSurveyQuestions(): Promise<EnpsQuestionRow[]> {
  const supabase = await createClient();

  const { data: questions, error } = await supabase
    .from("enps_questions")
    .select("*")
    .eq("is_active", true)
    .order("display_order", { ascending: true });

  if (error) {
    console.error("質問の取得エラー:", error);
    return [];
  }

  return (questions || []) as EnpsQuestionRow[];
}

export async function getUserResponses(surveyId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {} as Record<
      string,
      {
        question_id: string;
        score_value?: number | null;
        text_value?: string | null;
      }
    >;
  }

  const { data: responses, error } = await supabase
    .from("enps_responses")
    .select("question_id, score_value, text_value")
    .eq("survey_id", surveyId)
    .eq("user_id", user.id);

  if (error) {
    console.error("回答の取得エラー:", error);
    return {} as Record<
      string,
      {
        question_id: string;
        score_value?: number | null;
        text_value?: string | null;
      }
    >;
  }

  const responseMap: Record<
    string,
    {
      question_id: string;
      score_value?: number | null;
      text_value?: string | null;
    }
  > = {};
  if (responses) {
    for (const r of responses) {
      responseMap[r.question_id] = {
        question_id: r.question_id,
        score_value: r.score_value ?? null,
        text_value: r.text_value ?? null,
      };
    }
  }

  return responseMap;
}
