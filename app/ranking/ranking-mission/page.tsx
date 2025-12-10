import { CurrentUserCardMission } from "@/components/ranking/current-user-card-mission";
import { MissionSelect } from "@/components/ranking/mission-select";
import {
  PeriodToggle,
  type RankingPeriod,
} from "@/components/ranking/period-toggle";
import RankingMission from "@/components/ranking/ranking-mission";
import { RankingTabs } from "@/components/ranking/ranking-tabs";
import {
  getUserMissionRanking,
  getUserPostingCount,
} from "@/lib/services/missionsRanking";
import { createClient } from "@/lib/supabase/server";

export const runtime = "edge";

interface PageProps {
  searchParams: Promise<{
    missionId?: string;
    period?: RankingPeriod;
  }>;
}

export default async function RankingMissionPage({ searchParams }: PageProps) {
  const supabase = await createClient();
  const resolvedSearchParams = await searchParams;

  // ユーザー情報取得
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  // グッジョブ一覧を取得（max_achievement_countがnullのもののみ、特定のmissionIdのみ）
  const { data: missions, error: missionsError } = await supabase
    .from("missions")
    .select("*")
    .is("max_achievement_count", null)
    .eq("id", "e1f1d556-df31-4f79-b96d-6a1badeb5a0b")
    .order("is_featured", { ascending: false }) // is_featuredがtrueのものを先頭に
    .order("difficulty", { ascending: true }); // その後、難易度の昇順でソート

  // エラーハンドリング
  if (missionsError) {
    console.error("グッジョブ取得エラー:", missionsError);
    return (
      <div className="p-4 text-red-600">
        グッジョブの取得中にエラーが発生しました。
      </div>
    );
  }

  if (!missions || missions.length === 0) {
    return (
      <div className="p-4 text-gray-600">
        現在利用可能なグッジョブがありません。
      </div>
    );
  }

  // 選択されたグッジョブまたは最初のグッジョブ（is_featured優先）を取得
  const selectedMission = resolvedSearchParams.missionId
    ? missions.find((m) => m.id === resolvedSearchParams.missionId)
    : missions[0]; // is_featuredがtrueのものが先頭に来ているため、最初のものを選択

  if (!selectedMission) {
    return (
      <div className="p-4 text-gray-600">
        選択されたグッジョブが見つかりません。
      </div>
    );
  }

  let userRanking = null;

  if (user) {
    // 現在のユーザーのグッジョブ別ランキングを探す
    userRanking = await getUserMissionRanking(selectedMission.id, user.id);
  }

  // グッジョブタイプに応じてbadgeTextを生成、ポスティンググッジョブの場合はポスティング枚数を取得
  const isPostingMission = selectedMission.required_artifact_type === "POSTING";
  const userPostingCount =
    user && isPostingMission ? await getUserPostingCount(user.id) : 0;
  let badgeText = "";

  if (userRanking) {
    if (isPostingMission) {
      badgeText = `${userPostingCount.toLocaleString()}枚`;
    } else {
      badgeText = `${(userRanking.user_achievement_count ?? 0).toLocaleString()}回`;
    }
  }

  return (
    <div className="flex flex-col min-h-screen py-4 w-full">
      <RankingTabs>
        {/* グッジョブ選択 */}
        <section className="py-4 bg-white">
          <MissionSelect missions={missions} />
        </section>

        {/* ユーザーのランキングカード */}
        {userRanking && (
          <section className="py-4 bg-white">
            <CurrentUserCardMission
              currentUser={userRanking}
              mission={selectedMission}
              badgeText={badgeText}
            />
          </section>
        )}

        <section className="py-4 bg-white">
          {/* グッジョブ別ランキング */}
          <RankingMission
            limit={100}
            mission={selectedMission}
            isPostingMission={isPostingMission}
          />
        </section>
      </RankingTabs>
    </div>
  );
}
