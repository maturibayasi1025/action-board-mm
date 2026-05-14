import type { EnpsMonthlyPoint } from "@/app/(protected)/admin/enps-surveys/trends/actions";

export type GoodjobDatePreset = "last30d" | "thisMonth";

export type GoodjobStatisticsSummary = {
  totalGoodjobPosted: number;
  totalPraisesReceived: number;
  totalPassionateExecution: number;
  totalSupremeRelationships: number;
  totalHappinessCirculation: number;
  totalLikesGiven: number;
  totalLikesReceived: number;
  totalMissionAchievements: number;
  usersPosted: number;
  usersReceivedPraise: number;
};

export type AwardNominationRankingRow = { name: string; total: number };

/** 1位〜3位の枠。該当がないランクは null */
export type AwardNominationRankingEntry = AwardNominationRankingRow | null;

/** 各設問ごとに常に3枠（並びは回答件数の降順） */
export type AwardNominationRankingByQuestion = {
  questionId: string;
  questionText: string;
  questionGroup: string;
  displayOrder: number;
  questionType: "text" | "textarea";
  isActive: boolean;
  topThree: [
    AwardNominationRankingEntry,
    AwardNominationRankingEntry,
    AwardNominationRankingEntry,
  ];
};

export type AwardDashboardSummary = {
  surveyId: string;
  title: string;
  yearMonth: string;
  uniqueResponders: number;
  unansweredCount: number;
  totalNominations: number;
  /** 全設問（text/textarea）× 常に1〜3位の枠。期限内回答のみ。 */
  nominationRankingsByQuestion: AwardNominationRankingByQuestion[];
  nominationsByGroup: Record<string, number>;
};

export type EnpsStatisticsSlice = {
  questionId: string;
  questionText: string;
  displayOrder: number;
  latestPoint: EnpsMonthlyPoint | null;
  series: EnpsMonthlyPoint[];
} | null;

export type StatisticsDashboardData = {
  goodjob:
    | { success: true; data: GoodjobStatisticsSummary }
    | { success: false; error: string };
  goodjobPreset: GoodjobDatePreset;
  range: { startDate: string; endDate: string };
  enps: EnpsStatisticsSlice;
  award: AwardDashboardSummary | null;
  totalUsers: number;
};

export function getGoodjobRangeForPreset(preset: GoodjobDatePreset): {
  startDate: string;
  endDate: string;
} {
  if (preset === "thisMonth") {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23,
      59,
      59,
      999,
    );
    return { startDate: start.toISOString(), endDate: end.toISOString() };
  }

  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const start = new Date(end);
  start.setDate(start.getDate() - 29);
  start.setHours(0, 0, 0, 0);
  return { startDate: start.toISOString(), endDate: end.toISOString() };
}
