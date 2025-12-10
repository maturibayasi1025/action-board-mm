import { getLikesRanking } from "@/lib/services/likesRanking";
import type { UserRanking } from "@/lib/services/ranking";
import BaseRanking from "./base-ranking";
import type { RankingPeriod } from "./period-toggle";
import { RankingItem } from "./ranking-item";

interface RankingLikesProps {
  title?: string;
  limit?: number;
  showDetailedInfo?: boolean;
  period?: RankingPeriod;
}

export default async function RankingLikes({
  title,
  limit = 10,
  showDetailedInfo = false,
  period = "all",
}: RankingLikesProps) {
  const rankings = await getLikesRanking(limit, period);

  const periodLabel = period === "daily" ? "今日の" : "全期間";

  // UserLikesRankingをUserRanking型に変換
  const convertedRankings: UserRanking[] = rankings.map((user) => ({
    user_id: user.user_id,
    name: user.name,
    address_prefecture: user.address_prefecture,
    rank: user.rank,
    level: null,
    xp: null,
    updated_at: null,
    likes_count: user.likes_count,
  }));

  return (
    <BaseRanking
      title={title ?? `👍${periodLabel}いいね数トップ${limit}`}
      detailsHref="/ranking/ranking-likes"
      showDetailedInfo={showDetailedInfo}
    >
      {convertedRankings.map((user) => (
        <RankingItem key={user.user_id} user={user} />
      ))}
    </BaseRanking>
  );
}
