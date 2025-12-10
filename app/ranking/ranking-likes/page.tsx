import { CurrentUserCardLikes } from "@/components/ranking/current-user-card-likes";
import {
  PeriodToggle,
  type RankingPeriod,
} from "@/components/ranking/period-toggle";
import RankingLikes from "@/components/ranking/ranking-likes";
import { RankingTabs } from "@/components/ranking/ranking-tabs";
import { getUserLikesRanking } from "@/lib/services/likesRanking";
import { createClient } from "@/lib/supabase/server";

export const runtime = "edge";

interface PageProps {
  searchParams: Promise<{
    period?: RankingPeriod;
  }>;
}

export default async function RankingLikesPage({ searchParams }: PageProps) {
  const supabase = await createClient();
  const resolvedSearchParams = await searchParams;
  const period = resolvedSearchParams.period || "daily";

  // ユーザー情報取得（エラーハンドリング付き）
  let user = null;
  try {
    const {
      data: { user: userData },
    } = await supabase.auth.getUser();
    user = userData;
  } catch (error) {
    console.warn("Failed to get user:", error);
  }

  let userRanking = null;

  if (user) {
    try {
      userRanking = await getUserLikesRanking(user.id, period);
    } catch (error) {
      console.warn("Failed to fetch user likes ranking:", error);
    }
  }

  return (
    <div className="flex flex-col min-h-screen py-4 w-full">
      <h2 className="text-2xl font-bold text-center mb-4">
        いいね数ランキング
      </h2>
      <RankingTabs>
        {/* 期間選択トグル */}
        <section className="py-4 bg-white">
          <PeriodToggle defaultPeriod={period} />
        </section>

        {/* ユーザーのランキングカード */}
        {userRanking && (
          <section className="py-4 bg-white">
            <CurrentUserCardLikes currentUser={userRanking} />
          </section>
        )}

        <section className="py-4 bg-white">
          {/* ランキング */}
          <RankingLikes limit={100} period={period} />
        </section>
      </RankingTabs>
    </div>
  );
}
