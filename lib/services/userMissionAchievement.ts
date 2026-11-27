import "server-only";

import { fetchAllRows } from "@/lib/supabase/fetch-all-rows";
import { createClient as createServerClient } from "@/lib/supabase/server";

export interface MissionAchievementSummary {
  mission_id: string;
  mission_title: string;
  achievement_count: number;
}

/** 上限なしグッジョブごとの本人の達成回数。取得に失敗したら例外にする */
export async function getUserRepeatableMissionAchievements(
  userId: string,
): Promise<MissionAchievementSummary[]> {
  const supabase = await createServerClient();

  type AchievementWithMission = {
    mission_id: string | null;
    missions: { id: string; title: string } | null;
  };
  const data = await fetchAllRows<AchievementWithMission>((from, to) =>
    supabase
      .from("achievements")
      .select(`
      mission_id,
      missions!inner (
        id,
        title,
        max_achievement_count
      )
    `)
      .eq("user_id", userId)
      .is("missions.max_achievement_count", null)
      .order("id", { ascending: true })
      .range(from, to)
      .returns<AchievementWithMission[]>(),
  );

  const achievementCounts = data.reduce(
    (acc, achievement) => {
      const missionId = achievement.mission_id;
      if (!missionId || !achievement.missions) return acc;

      if (!acc[missionId]) {
        acc[missionId] = {
          mission_id: missionId,
          mission_title: achievement.missions.title || "",
          achievement_count: 0,
        };
      }
      acc[missionId].achievement_count += 1;
      return acc;
    },
    {} as Record<string, MissionAchievementSummary>,
  );

  return Object.values(achievementCounts).filter(
    (achievement) => achievement.achievement_count > 0,
  );
}
