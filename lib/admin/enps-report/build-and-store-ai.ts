/**
 * 1 サーベイぶんの自由記述を会社ごとに分析し、結果を保存する。
 * 生成は月次バッチでのみ行い、画面表示時は保存済みの結果を読むだけにする。
 */

import {
  type AiSummaryConfig,
  type QuestionForAi,
  buildAiSummaryInputsByCompany,
  generateEnpsAiSummary,
} from "@/lib/admin/enps-report/ai-summary";
import { shouldGenerateAiSummary } from "@/lib/admin/enps-report/ai-summary-types";
import type { SurveyForSnapshot } from "@/lib/admin/enps-report/build-and-store";
import {
  fetchScoreResponsesForSurvey,
  fetchSnapshotTargets,
  fetchTextResponsesForSurvey,
} from "@/lib/admin/enps-report/data-access";
import { fetchAllRows } from "@/lib/admin/enps-report/fetch-all";
import type { Database } from "@/lib/types/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

export type AiSummaryBuildResult = {
  companyName: string;
  inputCount: number;
  stored: boolean;
  reason?: string;
};

async function fetchQuestionsForAi(
  supabase: SupabaseClient<Database>,
): Promise<QuestionForAi[]> {
  return fetchAllRows<QuestionForAi>((from, to) =>
    supabase
      .from("enps_questions")
      .select("id, question_text, question_type, parent_question_id")
      .eq("is_active", true)
      .range(from, to),
  );
}

export async function buildAndStoreAiSummaries(
  supabase: SupabaseClient<Database>,
  survey: SurveyForSnapshot,
  config: AiSummaryConfig,
): Promise<AiSummaryBuildResult[]> {
  const [questions, textResponses, scoreResponses, targets] = await Promise.all(
    [
      fetchQuestionsForAi(supabase),
      fetchTextResponsesForSurvey(supabase, survey.id),
      fetchScoreResponsesForSurvey(supabase, survey.id),
      fetchSnapshotTargets(supabase),
    ],
  );

  const inputsByCompany = buildAiSummaryInputsByCompany({
    questions,
    textResponses,
    scoreResponses,
    userCompanies: targets.map((t) => ({
      user_id: t.user_id,
      company_name: t.company_name,
    })),
  });

  const results: AiSummaryBuildResult[] = [];

  for (const [companyName, inputs] of Array.from(inputsByCompany.entries())) {
    if (!shouldGenerateAiSummary(inputs.length)) {
      results.push({
        companyName,
        inputCount: inputs.length,
        stored: false,
        reason: "自由記述が少なく個人が特定されうるため生成しません",
      });
      continue;
    }

    const payload = await generateEnpsAiSummary({
      config,
      companyName,
      yearMonth: survey.year_month,
      inputs,
    });

    if (!payload) {
      results.push({
        companyName,
        inputCount: inputs.length,
        stored: false,
        reason: "AIの応答を解釈できませんでした",
      });
      continue;
    }

    const { error } = await supabase.from("enps_report_ai_summaries").upsert(
      {
        survey_id: survey.id,
        company_name: companyName,
        model: config.model,
        payload,
        input_response_count: inputs.length,
        generated_at: new Date().toISOString(),
      },
      { onConflict: "survey_id,company_name" },
    );

    if (error) {
      throw new Error(`AI分析結果の保存に失敗しました: ${error.message}`);
    }

    results.push({ companyName, inputCount: inputs.length, stored: true });
  }

  return results;
}
