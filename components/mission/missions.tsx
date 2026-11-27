import {
  filterImportantMissionsByDisplayPeriod,
  getMissionAchievementCountMap,
  getUserAchievementCountMap,
} from "@/lib/services/missions";
import { fetchAllRows } from "@/lib/supabase/fetch-all-rows";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/types/supabase";
import { MissionListLoadError } from "./MissionListLoadError";
import Mission from "./mission";

export type MissionsProps = {
  userId?: string;
  maxSize?: number;
  showAchievedMissions: boolean;
  filterFeatured?: boolean;
  filterImportant?: boolean;
  title?: string;
  id?: string;
};

/**
 * 表示するグッジョブと達成状況を取る。取得に失敗したら例外にする。
 * 達成済みの除外と件数の絞り込みは、候補を全件取ってから手元で行う。
 * 除外する ID を `not in` で送ると、達成済みの数に比例して URL が伸び、
 * 達成ゼロのときは空文字列を uuid 列に渡してしまうためである。
 */
async function loadMissions({
  userId,
  maxSize,
  showAchievedMissions,
  filterFeatured,
  filterImportant,
}: MissionsProps) {
  const supabase = await createClient();

  const [userAchievementCountMap, achievementCountMap, candidates] =
    await Promise.all([
      userId
        ? getUserAchievementCountMap(supabase, userId)
        : new Map<string, number>(),
      getMissionAchievementCountMap(supabase),
      fetchAllRows<Tables<"missions">>((from, to) => {
        let query = supabase.from("missions").select().eq("is_hidden", false); // 非表示のグッジョブを除外
        if (filterImportant) {
          query = query.eq("is_important", true);
        } else if (filterFeatured) {
          query = query.eq("is_featured", true);
        }
        return query
          .order("difficulty", { ascending: true })
          .order("created_at", { ascending: false })
          .order("id", { ascending: true })
          .range(from, to);
      }),
    ]);

  let missions = filterImportant
    ? filterImportantMissionsByDisplayPeriod(candidates)
    : candidates;
  if (!showAchievedMissions) {
    missions = missions.filter(
      (mission) => !userAchievementCountMap.has(mission.id),
    );
  }

  return {
    missions: maxSize ? missions.slice(0, maxSize) : missions,
    userAchievementCountMap,
    achievementCountMap,
  };
}

export default async function Missions(props: MissionsProps) {
  const { title = "📈 グッジョブ", id } = props;
  const list = await loadMissions(props).catch((error) => {
    console.error("グッジョブ一覧の取得エラー:", error);
    return null;
  });

  return (
    <div className="max-w-6xl mx-auto px-4">
      <div className="flex flex-col gap-6">
        <div className="text-center">
          <h2
            id={id}
            className="text-2xl md:text-4xl font-black text-gray-900 mb-2 scroll-mt-20"
          >
            {title}
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {!list ? (
            <MissionListLoadError />
          ) : list.missions.length > 0 ? (
            list.missions.map((mission) => (
              <Mission
                key={mission.id}
                mission={mission}
                achieved={list.userAchievementCountMap.has(mission.id)}
                achievementsCount={
                  list.achievementCountMap.get(mission.id) ?? 0
                }
                userAchievementCount={
                  list.userAchievementCountMap.get(mission.id) ?? 0
                }
              />
            ))
          ) : (
            <div className="col-span-full text-center py-12">
              <p className="text-gray-500 text-lg">
                未達成のグッジョブはありません
              </p>
              <p className="text-gray-400 text-sm mt-2">
                新しいグッジョブが追加されるまでお待ちください
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
