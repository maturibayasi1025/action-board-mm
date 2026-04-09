import "server-only";

import { createClient } from "@/lib/supabase/server";

export type DashboardPeriod = "weekly" | "monthly";

export function resolveDashboardPeriod(period?: string): DashboardPeriod {
  return period === "monthly" ? "monthly" : "weekly";
}

type DailyCountRow = {
  count: number | null;
  date: string | null;
};

export interface DailyCount {
  count: number;
  date: string;
}

export interface DashboardData {
  likesCounts: DailyCount[];
  missionCounts: DailyCount[];
  summary: {
    previousPeriodLikes: number;
    previousPeriodMissions: number;
    totalLikes: number;
    totalMissions: number;
  };
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function getTodayStartJSTInUtc(): Date {
  const now = new Date();
  const start = new Date(now);
  start.setUTCHours(15, 0, 0, 0);
  if (start > now) {
    start.setUTCDate(start.getUTCDate() - 1);
  }
  return start;
}

function toJstDateKey(date: Date): string {
  const offsetMs = 9 * 60 * 60 * 1000;
  return new Date(date.getTime() + offsetMs).toISOString().slice(0, 10);
}

function createDateRange(start: Date, days: number): string[] {
  return Array.from({ length: days }, (_, index) =>
    toJstDateKey(addDays(start, index)),
  );
}

function toMap(rows: DailyCountRow[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of rows) {
    if (!row.date) continue;
    map.set(row.date, row.count ?? 0);
  }
  return map;
}

function mergeSeries(days: string[], map: Map<string, number>): DailyCount[] {
  return days.map((date) => ({
    count: map.get(date) ?? 0,
    date,
  }));
}

function sumCounts(rows: DailyCount[]): number {
  return rows.reduce((sum, row) => sum + row.count, 0);
}

export async function getDashboardData(
  period: DashboardPeriod,
): Promise<DashboardData> {
  const days = period === "weekly" ? 7 : 30;
  const currentPeriodEnd = addDays(getTodayStartJSTInUtc(), 1);
  const currentPeriodStart = addDays(currentPeriodEnd, -days);
  const previousPeriodStart = addDays(currentPeriodStart, -days);

  const supabase = await createClient();

  const [
    { data: currentMissionRows, error: currentMissionError },
    { data: previousMissionRows, error: previousMissionError },
    { data: currentLikeRows, error: currentLikeError },
    { data: previousLikeRows, error: previousLikeError },
  ] = await Promise.all([
    supabase.rpc("get_daily_user_mission_counts", {
      p_end_date: currentPeriodEnd.toISOString(),
      p_start_date: currentPeriodStart.toISOString(),
    }),
    supabase.rpc("get_daily_user_mission_counts", {
      p_end_date: currentPeriodStart.toISOString(),
      p_start_date: previousPeriodStart.toISOString(),
    }),
    supabase.rpc("get_daily_user_mission_likes_counts", {
      p_end_date: currentPeriodEnd.toISOString(),
      p_start_date: currentPeriodStart.toISOString(),
    }),
    supabase.rpc("get_daily_user_mission_likes_counts", {
      p_end_date: currentPeriodStart.toISOString(),
      p_start_date: previousPeriodStart.toISOString(),
    }),
  ]);

  if (
    currentMissionError ||
    previousMissionError ||
    currentLikeError ||
    previousLikeError
  ) {
    console.error("Failed to fetch dashboard data", {
      currentLikeError,
      currentMissionError,
      previousLikeError,
      previousMissionError,
    });
    throw new Error("ダッシュボードデータの取得に失敗しました");
  }

  const dateRange = createDateRange(currentPeriodStart, days);
  const missionCounts = mergeSeries(
    dateRange,
    toMap((currentMissionRows as DailyCountRow[] | null) ?? []),
  );
  const likesCounts = mergeSeries(
    dateRange,
    toMap((currentLikeRows as DailyCountRow[] | null) ?? []),
  );

  const previousPeriodMissions = sumCounts(
    mergeSeries(
      createDateRange(previousPeriodStart, days),
      toMap((previousMissionRows as DailyCountRow[] | null) ?? []),
    ),
  );
  const previousPeriodLikes = sumCounts(
    mergeSeries(
      createDateRange(previousPeriodStart, days),
      toMap((previousLikeRows as DailyCountRow[] | null) ?? []),
    ),
  );

  return {
    likesCounts,
    missionCounts,
    summary: {
      previousPeriodLikes,
      previousPeriodMissions,
      totalLikes: sumCounts(likesCounts),
      totalMissions: sumCounts(missionCounts),
    },
  };
}
