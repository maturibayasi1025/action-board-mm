import { createClient } from "@/lib/supabase/server";
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

export default async function Missions({
  userId,
  maxSize,
  showAchievedMissions,
  filterFeatured,
  filterImportant,
  title = "📈 グッジョブ",
  id,
}: MissionsProps) {
  const supabase = await createClient();

  // ユーザーが達成したグッジョブIDのリスト
  let achievedMissionIds: string[] = [];
  // ユーザーの各グッジョブに対する達成回数のマップ
  let userAchievementCountMap = new Map<string, number>();

  if (userId) {
    // ユーザーの達成情報を取得
    const { data: achievements } = await supabase
      .from("achievements")
      .select("mission_id")
      .eq("user_id", userId);

    // 達成したグッジョブIDのリストを作成
    achievedMissionIds =
      achievements?.map((achievement) => achievement.mission_id ?? "") ?? [];

    // 各グッジョブの達成回数をカウント
    if (achievements && achievements.length > 0) {
      const missionCounts = achievements.reduce((counts, achievement) => {
        const missionId = achievement.mission_id;
        if (missionId) {
          counts.set(missionId, (counts.get(missionId) || 0) + 1);
        }
        return counts;
      }, new Map<string, number>());

      userAchievementCountMap = missionCounts;
    }
  }

  // すべてのグッジョブに対する達成人数を取得
  const { data: achievement_count } = await supabase
    .from("mission_achievement_count_view")
    .select("mission_id, achievement_count");
  const achievement_count_map = new Map(
    achievement_count?.map((achievement) => [
      achievement.mission_id,
      achievement.achievement_count,
    ]),
  );

  let query = supabase
    .from("missions")
    .select()
    .eq("is_hidden", false) // 非表示のグッジョブを除外
    .order("difficulty", { ascending: true })
    .order("created_at", { ascending: false });

  if (filterImportant) {
    // 重要グッジョブをフィルタリング
    query = query.eq("is_important", true);
  } else if (filterFeatured) {
    query = query.eq("is_featured", true);
  }

  if (!showAchievedMissions) {
    query = query.not("id", "in", `("${achievedMissionIds.join('","')}")`);
  }
  let { data: missions } = maxSize ? await query.limit(maxSize) : await query;

  // 重要グッジョブの場合、期間チェックをクライアント側で行う
  if (filterImportant && missions) {
    const now = new Date();
    missions = missions.filter((mission) => {
      const startDate = mission.important_display_start_date
        ? new Date(mission.important_display_start_date)
        : null;
      const endDate = mission.important_display_end_date
        ? new Date(mission.important_display_end_date)
        : null;

      // 開始日が設定されている場合、現在日時が開始日以降である必要がある
      if (startDate && now < startDate) {
        return false;
      }

      // 終了日が設定されている場合、現在日時が終了日以前である必要がある
      if (endDate && now > endDate) {
        return false;
      }

      return true;
    });
  }

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
          {missions && missions.length > 0 ? (
            missions.map((mission) => (
              <Mission
                key={mission.id}
                mission={mission}
                achieved={achievedMissionIds.includes(mission.id)}
                achievementsCount={achievement_count_map.get(mission.id) ?? 0}
                userAchievementCount={
                  userAchievementCountMap.get(mission.id) ?? 0
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
