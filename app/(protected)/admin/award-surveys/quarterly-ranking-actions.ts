"use server";

import {
  type AwardQuarter,
  type AwardQuarterOption,
  type AwardQuarterlyRankingResult,
  fiscalYearAndQuarterFromYearMonth,
  formatQuarterLabel,
  parseYearMonth,
  quarterKey,
  yearMonthKeysForQuarter,
} from "@/app/(protected)/admin/award-surveys/quarterly-ranking-model";
import {
  AWARD_RANKING_RESPONSE_COLUMNS,
  countAwardResponses,
  fetchAllAwardResponses,
  fetchAllPrivateUserNames,
  fetchAwardResponsesForSurvey,
} from "@/lib/award/fetch-award-rows";
import {
  type AwardNominationQuestion,
  type AwardResponseForRanking,
  type AwardSurveyForRanking,
  buildAwardQuarterlyRanking,
  emptyAwardQuarterlyRankingResult,
} from "@/lib/award/nomination-ranking";
import { createServiceClient } from "@/lib/supabase/server";
import { requireOwner } from "@/lib/utils/isOwner";

export async function getAvailableAwardQuarters(): Promise<
  AwardQuarterOption[]
> {
  await requireOwner();
  const supabase = await createServiceClient();

  const { data: surveys, error } = await supabase
    .from("award_surveys")
    .select("year_month");

  if (error) {
    console.error("四半期一覧の取得エラー:", error);
    return [];
  }

  const seen = new Set<string>();
  const options: AwardQuarterOption[] = [];

  for (const row of surveys ?? []) {
    const parsed = parseYearMonth(row.year_month);
    if (!parsed) continue;
    const { fiscalYear, quarter } = fiscalYearAndQuarterFromYearMonth(
      parsed.year,
      parsed.month,
    );
    const key = quarterKey(fiscalYear, quarter);
    if (seen.has(key)) continue;
    seen.add(key);
    options.push({
      year: fiscalYear,
      quarter,
      label: formatQuarterLabel(fiscalYear, quarter),
    });
  }

  options.sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year;
    return b.quarter - a.quarter;
  });

  return options;
}

export async function getAwardQuarterlyNominationRanking(
  year: number,
  quarter: AwardQuarter,
): Promise<AwardQuarterlyRankingResult> {
  await requireOwner();
  const supabase = await createServiceClient();
  const label = formatQuarterLabel(year, quarter);
  const targetYearMonths = yearMonthKeysForQuarter(year, quarter);
  const empty = () =>
    emptyAwardQuarterlyRankingResult(year, quarter, label, targetYearMonths);

  const { data: surveys, error: surveysError } = await supabase
    .from("award_surveys")
    .select("id, year_month, title")
    .in("year_month", targetYearMonths)
    .order("year_month", { ascending: true });

  if (surveysError) {
    console.error("四半期アンケートの取得エラー:", surveysError);
    return emptyAwardQuarterlyRankingResult(
      year,
      quarter,
      label,
      targetYearMonths,
      "四半期アンケートの取得に失敗したため、集計結果は表示しません。",
    );
  }

  const surveyRows = (surveys ?? []) as AwardSurveyForRanking[];
  const surveyIds = surveyRows.map((survey) => survey.id);
  const withSurveysOnly = (loadError: string) =>
    buildAwardQuarterlyRanking({
      year,
      quarter,
      label,
      expectedYearMonths: targetYearMonths,
      surveys: surveyRows,
      questions: [],
      responses: [],
      userNameById: new Map(),
      dbResponseCount: null,
      loadError,
      independentMonthlyResponses: null,
    });

  if (surveyIds.length === 0) {
    return empty();
  }

  try {
    const [questionsResult, responses, dbResponseCount, userNameById] =
      await Promise.all([
        supabase
          .from("award_questions")
          .select(
            "id, question_text, question_type, question_group, display_order, is_active",
          )
          .order("display_order", { ascending: true }),
        fetchAllAwardResponses<AwardResponseForRanking>(
          supabase,
          surveyIds,
          AWARD_RANKING_RESPONSE_COLUMNS,
        ),
        countAwardResponses(supabase, surveyIds),
        fetchAllPrivateUserNames(supabase),
      ]);

    if (questionsResult.error) {
      console.error("四半期設問の取得エラー:", questionsResult.error);
      return withSurveysOnly(
        "四半期設問の取得に失敗したため、集計結果は表示しません。",
      );
    }

    const independentMonthlyResponses =
      await fetchIndependentMonthlyAwardResponses(supabase, surveyRows);

    return buildAwardQuarterlyRanking({
      year,
      quarter,
      label,
      expectedYearMonths: targetYearMonths,
      surveys: surveyRows,
      questions: (questionsResult.data ?? []) as AwardNominationQuestion[],
      responses,
      userNameById,
      dbResponseCount,
      independentMonthlyResponses,
    });
  } catch (error) {
    console.error("四半期回答の取得エラー:", error);
    return withSurveysOnly(
      "回答の全件取得に失敗したため、集計結果は表示しません。",
    );
  }
}

async function fetchIndependentMonthlyAwardResponses(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  surveyRows: AwardSurveyForRanking[],
): Promise<AwardResponseForRanking[] | null> {
  try {
    const pages = await Promise.all(
      surveyRows.map((survey) =>
        fetchAwardResponsesForSurvey<AwardResponseForRanking>(
          supabase,
          survey.id,
          AWARD_RANKING_RESPONSE_COLUMNS,
        ),
      ),
    );
    return pages.flat();
  } catch (error) {
    console.error("月次回答の再取得エラー:", error);
    return null;
  }
}
