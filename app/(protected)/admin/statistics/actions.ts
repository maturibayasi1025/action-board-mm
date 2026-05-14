"use server";

import { getAssessmentData } from "@/app/(protected)/admin/assessment-export/actions";
import {
  getAwardSurveyResponses,
  getAwardUnansweredUsers,
} from "@/app/(protected)/admin/award-surveys/[id]/actions";
import { getTotalUsers } from "@/app/(protected)/admin/award-surveys/actions";
import {
  getActiveScoreQuestions,
  getEnpsMonthlyTrendsForQuestion,
} from "@/app/(protected)/admin/enps-surveys/trends/actions";
import {
  type AwardDashboardSummary,
  type EnpsStatisticsSlice,
  type GoodjobDatePreset,
  type GoodjobStatisticsSummary,
  type StatisticsDashboardData,
  getGoodjobRangeForPreset,
} from "@/app/(protected)/admin/statistics/dashboard-model";
import { createServiceClient } from "@/lib/supabase/server";
import { requireOwner } from "@/lib/utils/isOwner";

export async function getGoodjobStatisticsSummary(
  startDate: string,
  endDate: string,
): Promise<
  | { success: true; data: GoodjobStatisticsSummary }
  | { success: false; error: string }
> {
  const result = await getAssessmentData(startDate, endDate);
  if (!result.success) {
    return { success: false, error: result.error };
  }

  const rows = result.data;
  const data: GoodjobStatisticsSummary = {
    totalGoodjobPosted: rows.reduce((s, r) => s + r.goodjobPostedCount, 0),
    totalPraisesReceived: rows.reduce((s, r) => s + r.goodjobReceivedCount, 0),
    totalPassionateExecution: rows.reduce(
      (s, r) => s + r.passionateExecutionCount,
      0,
    ),
    totalSupremeRelationships: rows.reduce(
      (s, r) => s + r.supremeRelationshipsCount,
      0,
    ),
    totalHappinessCirculation: rows.reduce(
      (s, r) => s + r.happinessCirculationCount,
      0,
    ),
    totalLikesGiven: rows.reduce((s, r) => s + r.likesGivenCount, 0),
    totalLikesReceived: rows.reduce((s, r) => s + r.likesReceivedCount, 0),
    totalMissionAchievements: rows.reduce(
      (s, r) => s + r.missionAchievementCount,
      0,
    ),
    usersPosted: rows.filter((r) => r.goodjobPostedCount > 0).length,
    usersReceivedPraise: rows.filter((r) => r.goodjobReceivedCount > 0).length,
  };

  return { success: true, data };
}

export async function getAwardDashboardSummary(): Promise<AwardDashboardSummary | null> {
  await requireOwner();
  const supabase = await createServiceClient();

  const { data: survey } = await supabase
    .from("award_surveys")
    .select("id, title, year_month")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!survey) {
    return null;
  }

  const [detail, unansweredUsers] = await Promise.all([
    getAwardSurveyResponses(survey.id),
    getAwardUnansweredUsers(survey.id),
  ]);

  const uniqueResponders = new Set(
    detail.responses.map((r) => r.user_id).filter(Boolean),
  ).size;

  const nominationsByGroup: Record<string, number> = {};
  for (const d of detail.nominationDetails) {
    for (const [group, count] of Object.entries(d.byGroup)) {
      if (typeof count === "number") {
        nominationsByGroup[group] = (nominationsByGroup[group] || 0) + count;
      }
    }
  }

  const totalNominations = detail.nominationDetails.reduce(
    (sum, n) => sum + n.total,
    0,
  );

  return {
    surveyId: survey.id,
    title: survey.title,
    yearMonth: survey.year_month,
    uniqueResponders,
    unansweredCount: unansweredUsers.length,
    totalNominations,
    topNominations: detail.nominationDetails.slice(0, 5).map((n) => ({
      name: n.name,
      total: n.total,
    })),
    nominationsByGroup,
  };
}

export async function getStatisticsDashboardData(
  goodjobPreset: GoodjobDatePreset = "last30d",
): Promise<StatisticsDashboardData> {
  await requireOwner();
  const range = getGoodjobRangeForPreset(goodjobPreset);

  const [goodjob, questions, award, totalUsers] = await Promise.all([
    getGoodjobStatisticsSummary(range.startDate, range.endDate),
    getActiveScoreQuestions(),
    getAwardDashboardSummary(),
    getTotalUsers(),
  ]);

  let enps: EnpsStatisticsSlice = null;
  if (questions.length > 0) {
    const q = questions[0];
    if (q) {
      const series = await getEnpsMonthlyTrendsForQuestion(q.id);
      const latestPoint =
        series.length > 0 ? (series[series.length - 1] ?? null) : null;
      enps = {
        questionId: q.id,
        questionText: q.question_text,
        displayOrder: q.display_order,
        latestPoint,
        series,
      };
    }
  }

  return {
    goodjob,
    goodjobPreset,
    range,
    enps,
    award,
    totalUsers,
  };
}

export async function refreshGoodjobDashboard(
  preset: GoodjobDatePreset,
): Promise<
  {
    preset: GoodjobDatePreset;
    range: { startDate: string; endDate: string };
  } & (
    | { success: true; data: GoodjobStatisticsSummary }
    | { success: false; error: string }
  )
> {
  await requireOwner();
  const range = getGoodjobRangeForPreset(preset);
  const result = await getGoodjobStatisticsSummary(
    range.startDate,
    range.endDate,
  );
  if (result.success) {
    return { success: true, data: result.data, range, preset };
  }
  return { success: false, error: result.error, range, preset };
}
