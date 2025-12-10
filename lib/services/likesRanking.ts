import "server-only";

import type { RankingPeriod } from "@/components/ranking/period-toggle";
import { createClient } from "@/lib/supabase/server";

export interface UserLikesRanking {
  user_id: string | null;
  address_prefecture: string | null;
  name: string | null;
  rank: number | null;
  likes_count: number | null;
}

export async function getLikesRanking(
  limit = 10,
  period: RankingPeriod = "all",
): Promise<UserLikesRanking[]> {
  try {
    const supabase = await createClient();

    // 期間に応じた日付フィルタを設定
    let dateFilter: Date | null = null;
    const now = new Date();

    switch (period) {
      case "daily":
        // 本日の0時0分を基準にする
        dateFilter = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
          0,
          0,
          0,
        );
        break;
      default:
        dateFilter = null;
    }

    // データベース関数を使用していいね数ランキングを取得
    const { data: rankings, error: rankingsError } = await supabase.rpc(
      period === "all" ? "get_likes_ranking" : "get_period_likes_ranking",
      period === "all"
        ? {
            limit_count: limit,
          }
        : {
            p_limit: limit,
            p_start_date: dateFilter?.toISOString(),
          },
    );

    if (rankingsError) {
      console.error("Failed to fetch likes rankings:", rankingsError);
      throw new Error(
        `いいね数ランキングデータの取得に失敗しました: ${rankingsError.message}`,
      );
    }

    if (!rankings || rankings.length === 0) {
      return [];
    }

    // ランキングデータを変換
    return rankings.map(
      (ranking: Record<string, unknown>) =>
        ({
          user_id: ranking.user_id,
          name: ranking.user_name,
          address_prefecture: ranking.address_prefecture,
          rank: ranking.rank,
          likes_count: ranking.likes_count,
        }) as UserLikesRanking,
    );
  } catch (error) {
    console.error("Likes ranking service error:", error);
    throw error;
  }
}

export async function getUserLikesRanking(
  userId: string,
  period: RankingPeriod = "all",
): Promise<UserLikesRanking | null> {
  try {
    const supabase = await createClient();

    // 期間に応じた日付フィルタを設定
    let dateFilter: Date | null = null;
    const now = new Date();

    switch (period) {
      case "daily":
        // 本日の0時0分を基準にする
        dateFilter = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
          0,
          0,
          0,
        );
        break;
      default:
        dateFilter = null;
    }

    // データベース関数を使用して特定ユーザーのランキングを取得
    const { data: rankings, error: rankingsError } = await supabase.rpc(
      period === "all"
        ? "get_user_likes_ranking"
        : "get_user_period_likes_ranking",
      period === "all"
        ? {
            target_user_id: userId,
          }
        : {
            p_user_id: userId,
            p_start_date: dateFilter?.toISOString(),
          },
    );

    if (rankingsError) {
      console.error("Failed to fetch user likes ranking:", rankingsError);
      throw new Error(
        `ユーザーのいいね数ランキングデータの取得に失敗しました: ${rankingsError.message}`,
      );
    }

    if (!rankings || rankings.length === 0) {
      return null;
    }

    const ranking = rankings[0] as Record<string, unknown>;
    return {
      user_id: ranking.user_id,
      name: ranking.user_name,
      address_prefecture: ranking.address_prefecture,
      rank: ranking.rank,
      likes_count: ranking.likes_count,
    } as UserLikesRanking;
  } catch (error) {
    console.error("User likes ranking service error:", error);
    throw error;
  }
}
