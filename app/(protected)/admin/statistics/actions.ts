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
  type AwardNominationRankingEntry,
  type EnpsStatisticsSlice,
  type GoodjobDatePreset,
  type GoodjobStatisticsSummary,
  type StatisticsDashboardData,
  getGoodjobRangeForPreset,
} from "@/app/(protected)/admin/statistics/dashboard-model";
import { createServiceClient } from "@/lib/supabase/server";
import { requireOwner } from "@/lib/utils/isOwner";

/** 統計ダッシュボードの指名ランキング対象（各バリューの「方／チームを教えてください」の短文＋チーム指名） */
const AWARD_STATS_NOMINATION_GROUP_ORDER = [
  "passionate_execution",
  "supreme_relations",
  "happiness_cycle",
  "team_value",
] as const;

const AWARD_STATS_NOMINATION_QUESTION_GROUPS = new Set<string>(
  AWARD_STATS_NOMINATION_GROUP_ORDER,
);

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

  const { data: masterQuestions } = await supabase
    .from("award_questions")
    .select(
      "id, question_text, question_type, question_group, display_order, is_active",
    )
    .order("display_order", { ascending: true });

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

  const responseRows = detail.responses;

  function pickNominationQuestionForGroup(group: string) {
    const groupQuestions = (masterQuestions ?? []).filter(
      (q) =>
        q.question_group === group &&
        q.is_active &&
        AWARD_STATS_NOMINATION_QUESTION_GROUPS.has(q.question_group),
    );
    if (group === "team_value") {
      return groupQuestions
        .filter((q) => q.question_type === "text")
        .sort((a, b) => a.display_order - b.display_order)[0];
    }
    return groupQuestions
      .filter((q) => q.question_type === "user_select")
      .sort((a, b) => a.display_order - b.display_order)[0];
  }

  const nominationRankingsByQuestion = AWARD_STATS_NOMINATION_GROUP_ORDER.map(
    (groupKey) => pickNominationQuestionForGroup(groupKey),
  )
    .filter((q): q is NonNullable<typeof q> => q != null)
    .map((q) => {
      const counts = new Map<string, { name: string; count: number }>();
      for (const r of responseRows) {
        if (r.is_late_submission) {
          continue;
        }
        if (r.question_id !== q.id) {
          continue;
        }
        let key: string | null = null;
        let name: string | null = null;
        if (q.question_type === "user_select") {
          if (r.nominee_user_id) {
            key = `uid:${r.nominee_user_id}`;
            name = r.nominee_user_name ?? "不明";
          } else {
            const textValue = r.text_value?.trim();
            if (textValue) {
              key = `text:${textValue}`;
              name = textValue;
            }
          }
        } else {
          const textValue = r.text_value?.trim();
          if (textValue) {
            key = `text:${textValue}`;
            name = textValue;
          }
        }
        if (!key || !name) {
          continue;
        }
        const entry = counts.get(key);
        if (entry) {
          entry.count += 1;
        } else {
          counts.set(key, { name, count: 1 });
        }
      }
      const sorted = Array.from(counts.values())
        .map(({ name, count }) => ({ name, total: count }))
        .sort((a, b) => b.total - a.total);

      const topThree: [
        AwardNominationRankingEntry,
        AwardNominationRankingEntry,
        AwardNominationRankingEntry,
      ] = [sorted[0] ?? null, sorted[1] ?? null, sorted[2] ?? null];

      return {
        questionId: q.id,
        questionText: q.question_text,
        questionGroup: q.question_group ?? "",
        displayOrder: q.display_order,
        questionType: q.question_type as "text" | "textarea" | "user_select",
        isActive: q.is_active,
        topThree,
      };
    });

  return {
    surveyId: survey.id,
    title: survey.title,
    yearMonth: survey.year_month,
    uniqueResponders,
    unansweredCount: unansweredUsers.length,
    totalNominations,
    nominationRankingsByQuestion,
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
