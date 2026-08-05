"use server";

import type { EnpsAiSummaryRecord } from "@/lib/admin/enps-report/ai-summary-types";
import {
  type BusinessUnitRow,
  type CompanyComparisonRow,
  type CompanyTrendPoint,
  type SnapshotRecord,
  buildBusinessUnitBreakdown,
  buildChangeHighlights,
  buildCompanyComparison,
  buildCompanyTrend,
} from "@/lib/admin/enps-report/comparison";
import { fetchAllRows } from "@/lib/admin/enps-report/fetch-all";
import { createServiceClient } from "@/lib/supabase/server";
import { requireOwner } from "@/lib/utils/isOwner";

export type ReportSurvey = {
  survey_id: string;
  year_month: string;
  title: string;
};

export type ReportScoreQuestion = {
  id: string;
  question_text: string;
  display_order: number;
};

/** 推移グラフに表示する月数 */
const TREND_MONTHS = 12;

/** DB の scope は CHECK 制約付きの text なので、型としては string で返ってくる */
type RawSnapshotRow = Omit<SnapshotRecord, "scope"> & { scope: string };

async function fetchSnapshotsForSurveys(
  surveyIds: string[],
): Promise<Map<string, SnapshotRecord[]>> {
  const bySurvey = new Map<string, SnapshotRecord[]>();
  if (surveyIds.length === 0) {
    return bySurvey;
  }

  const supabase = await createServiceClient();
  const rows = await fetchAllRows<RawSnapshotRow>((from, to) =>
    supabase
      .from("enps_monthly_snapshots")
      .select(
        "survey_id, question_id, scope, company_name, business_unit_name, target_count, respondent_count, promoters, passives, detractors, nps_respondent_base, nps_imputed_base",
      )
      .in("survey_id", surveyIds)
      .range(from, to),
  );

  for (const row of rows) {
    const list = bySurvey.get(row.survey_id) ?? [];
    list.push({ ...row, scope: row.scope as SnapshotRecord["scope"] });
    bySurvey.set(row.survey_id, list);
  }
  return bySurvey;
}

/**
 * スナップショットが保存済みのアンケートのみを、新しい順で返す。
 */
export async function listReportSurveys(): Promise<ReportSurvey[]> {
  await requireOwner();
  const supabase = await createServiceClient();

  const snapshotSurveyIds = await fetchAllRows<{ survey_id: string }>(
    (from, to) =>
      supabase
        .from("enps_monthly_snapshots")
        .select("survey_id")
        .range(from, to),
  );
  const uniqueIds = Array.from(
    new Set(snapshotSurveyIds.map((r) => r.survey_id)),
  );
  if (uniqueIds.length === 0) {
    return [];
  }

  const surveys = await fetchAllRows<{
    id: string;
    year_month: string;
    title: string;
  }>((from, to) =>
    supabase
      .from("enps_surveys")
      .select("id, year_month, title")
      .in("id", uniqueIds)
      .order("year_month", { ascending: false })
      .range(from, to),
  );

  return surveys.map((s) => ({
    survey_id: s.id,
    year_month: s.year_month,
    title: s.title,
  }));
}

export async function listReportScoreQuestions(): Promise<
  ReportScoreQuestion[]
> {
  await requireOwner();
  const supabase = await createServiceClient();

  return fetchAllRows<ReportScoreQuestion>((from, to) =>
    supabase
      .from("enps_questions")
      .select("id, question_text, display_order")
      .eq("is_active", true)
      .eq("question_type", "score_0_10")
      .order("display_order", { ascending: true })
      .range(from, to),
  );
}

export type CompanyComparisonResult = {
  survey: ReportSurvey;
  previousSurvey: ReportSurvey | null;
  questions: ReportScoreQuestion[];
  rows: CompanyComparisonRow[];
};

/**
 * 指定した月の全社横並び比較。前月が存在すればその差分も含める。
 */
export async function getCompanyComparison(
  surveyId: string,
): Promise<CompanyComparisonResult | null> {
  await requireOwner();

  const [surveys, questions] = await Promise.all([
    listReportSurveys(),
    listReportScoreQuestions(),
  ]);

  const index = surveys.findIndex((s) => s.survey_id === surveyId);
  if (index === -1) {
    return null;
  }

  const survey = surveys[index];
  // listReportSurveys は新しい順なので、次の要素が前月にあたる
  const previousSurvey = surveys[index + 1] ?? null;

  const snapshots = await fetchSnapshotsForSurveys(
    previousSurvey
      ? [survey.survey_id, previousSurvey.survey_id]
      : [survey.survey_id],
  );

  const rows = buildCompanyComparison({
    current: snapshots.get(survey.survey_id) ?? [],
    previous: previousSurvey
      ? (snapshots.get(previousSurvey.survey_id) ?? [])
      : [],
    scoreQuestionIds: questions.map((q) => q.id),
  });

  return { survey, previousSurvey, questions, rows };
}

export type CompanyReportResult = {
  survey: ReportSurvey;
  previousSurvey: ReportSurvey | null;
  companyName: string;
  questions: ReportScoreQuestion[];
  /** サマリーと事業部内訳で選択中のスコア質問 */
  activeQuestionId: string;
  comparisonRow: CompanyComparisonRow | null;
  groupRow: CompanyComparisonRow | null;
  businessUnits: BusinessUnitRow[];
  highlights: ReturnType<typeof buildChangeHighlights>;
  trend: CompanyTrendPoint[];
  aiSummary: EnpsAiSummaryRecord | null;
};

export async function getCompanyReport(
  surveyId: string,
  companyName: string,
  questionId?: string,
): Promise<CompanyReportResult | null> {
  await requireOwner();

  const [surveys, questions] = await Promise.all([
    listReportSurveys(),
    listReportScoreQuestions(),
  ]);

  const index = surveys.findIndex((s) => s.survey_id === surveyId);
  if (index === -1 || questions.length === 0) {
    return null;
  }

  const survey = surveys[index];
  const previousSurvey = surveys[index + 1] ?? null;
  const activeQuestionId =
    questionId && questions.some((q) => q.id === questionId)
      ? questionId
      : questions[0].id;

  // 推移は選択中の月を末尾に、そこから遡って最大 TREND_MONTHS 件
  const trendSurveys = surveys.slice(index, index + TREND_MONTHS).reverse();
  const snapshots = await fetchSnapshotsForSurveys(
    trendSurveys.map((s) => s.survey_id),
  );

  const current = snapshots.get(survey.survey_id) ?? [];
  const previous = previousSurvey
    ? (snapshots.get(previousSurvey.survey_id) ?? [])
    : [];

  const hasCompany = current.some(
    (r) => r.scope === "company" && r.company_name === companyName,
  );
  if (!hasCompany) {
    return null;
  }

  const comparison = buildCompanyComparison({
    current,
    previous,
    scoreQuestionIds: questions.map((q) => q.id),
  });

  const businessUnits = buildBusinessUnitBreakdown({
    current,
    previous,
    companyName,
    questionId: activeQuestionId,
  });

  const trend = buildCompanyTrend({
    snapshotsByMonth: trendSurveys.map((s) => ({
      survey_id: s.survey_id,
      year_month: s.year_month,
      records: snapshots.get(s.survey_id) ?? [],
    })),
    companyName,
    questionId: activeQuestionId,
  });

  return {
    survey,
    previousSurvey,
    companyName,
    questions,
    activeQuestionId,
    comparisonRow:
      comparison.find((r) => !r.is_group && r.company_name === companyName) ??
      null,
    groupRow: comparison.find((r) => r.is_group) ?? null,
    businessUnits,
    highlights: buildChangeHighlights(businessUnits),
    trend,
    aiSummary: await getAiSummary(survey.survey_id, companyName),
  };
}

async function getAiSummary(
  surveyId: string,
  companyName: string,
): Promise<EnpsAiSummaryRecord | null> {
  const supabase = await createServiceClient();
  const { data } = await supabase
    .from("enps_report_ai_summaries")
    .select("company_name, model, payload, input_response_count, generated_at")
    .eq("survey_id", surveyId)
    .eq("company_name", companyName)
    .maybeSingle();

  if (!data) {
    return null;
  }

  return {
    company_name: data.company_name,
    model: data.model,
    input_response_count: data.input_response_count,
    generated_at: data.generated_at,
    payload: data.payload as EnpsAiSummaryRecord["payload"],
  };
}
