"server-only";

import { createServiceClient } from "@/lib/supabase/server";
import {
  BadgeType,
  type BadgeUpdateParams,
  type MvvBadgeWithUser,
  type UserBadge,
  getCurrentQuarter,
  getQuarterPeriod,
} from "@/lib/types/badge";

/**
 * MVVバッジタイプの並び順を定義
 * 1. 夢中になってやり切る
 * 2. 至高な人間関係
 * 3. 幸せの循環
 */
const MVV_BADGE_TYPE_ORDER: Record<string, number> = {
  MVV_PASSIONATE_EXECUTION: 1,
  MVV_SUPREME_RELATIONSHIPS: 2,
  MVV_HAPPINESS_CIRCULATION: 3,
};

/**
 * MVVバッジを希望の順序でソートする
 */
function sortMvvBadgesByType<T extends { badge_type: string }>(
  badges: T[],
): T[] {
  return [...badges].sort((a, b) => {
    const orderA = MVV_BADGE_TYPE_ORDER[a.badge_type] ?? 999;
    const orderB = MVV_BADGE_TYPE_ORDER[b.badge_type] ?? 999;
    return orderA - orderB;
  });
}

/**
 * グッジョブバッジにタイトル情報を追加する
 */
async function enrichMissionBadges(badges: UserBadge[]): Promise<UserBadge[]> {
  // グッジョブタイプのバッジのグッジョブslugを収集
  const missionSlugs = badges
    .filter((badge) => badge.badge_type === "MISSION" && badge.sub_type)
    .map((badge) => badge.sub_type as string);

  if (missionSlugs.length === 0) {
    return badges;
  }

  const supabase = await createServiceClient();

  // グッジョブ情報を取得（IDも含める）
  const { data: missions, error: missionError } = await supabase
    .from("missions")
    .select("id, slug, title")
    .in("slug", missionSlugs);

  if (missionError || !missions) {
    console.error("Error fetching mission titles:", missionError);
    return badges;
  }

  // グッジョブslugとグッジョブ情報のマップを作成
  const missionMap = new Map(
    missions.map((m) => [m.slug, { id: m.id, title: m.title }]),
  );

  // バッジにグッジョブタイトルとIDを追加
  return badges.map((badge) => {
    if (badge.badge_type === "MISSION" && badge.sub_type) {
      const missionInfo = missionMap.get(badge.sub_type);
      if (missionInfo) {
        return {
          ...badge,
          mission_title: missionInfo.title,
          mission_id: missionInfo.id,
        };
      }
    }
    return badge;
  });
}

/**
 * バッジを更新する（順位が改善された場合のみ）
 */
export async function updateBadge({
  user_id,
  badge_type,
  sub_type,
  rank,
}: BadgeUpdateParams): Promise<{ success: boolean; updated: boolean }> {
  const supabase = await createServiceClient();

  try {
    // 既存バッジを確認
    const query = supabase
      .from("user_badges")
      .select("*")
      .eq("user_id", user_id)
      .eq("badge_type", badge_type);

    // sub_typeがnullの場合とそうでない場合で処理を分ける
    if (sub_type === null) {
      query.is("sub_type", null);
    } else {
      query.eq("sub_type", sub_type);
    }

    const { data: existing, error: fetchError } = await query.single();

    if (fetchError && fetchError.code !== "PGRST116") {
      // PGRST116 = no rows returned
      console.error("Error fetching existing badge:", fetchError);
      return { success: false, updated: false };
    }

    if (!existing) {
      // 新規作成
      const { error: insertError } = await supabase.from("user_badges").insert({
        user_id,
        badge_type,
        sub_type,
        rank,
        achieved_at: new Date().toISOString(),
        is_notified: false,
      });

      if (insertError) {
        console.error("Error inserting new badge:", insertError);
        return { success: false, updated: false };
      }

      return { success: true, updated: true };
    }

    if (rank < existing.rank) {
      // 順位が改善された場合のみ更新
      const { error: updateError } = await supabase
        .from("user_badges")
        .update({
          rank,
          achieved_at: new Date().toISOString(),
          is_notified: false,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);

      if (updateError) {
        console.error("Error updating badge:", updateError);
        return { success: false, updated: false };
      }

      return { success: true, updated: true };
    }

    // 順位が改善されていない場合
    return { success: true, updated: false };
  } catch (error) {
    console.error("Unexpected error in updateBadge:", error);
    return { success: false, updated: false };
  }
}

/**
 * ユーザーの現在のバッジを取得（グッジョブ情報付き）
 */
export async function getUserBadges(userId: string): Promise<UserBadge[]> {
  const supabase = await createServiceClient();

  const { data, error } = await supabase
    .from("user_badges")
    .select("*")
    .eq("user_id", userId)
    .order("badge_type")
    .order("rank");

  if (error) {
    console.error("Error fetching user badges:", {
      error: error,
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
      userId: userId,
    });
    return [];
  }

  const badges = (data || []) as UserBadge[];

  // グッジョブバッジのタイトルを取得
  const enrichedBadges = await enrichMissionBadges(badges);

  // MVVバッジを希望の順序でソート
  // バッジタイプごとにグループ化
  const groupedByType = enrichedBadges.reduce(
    (acc, badge) => {
      const key = badge.badge_type;
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(badge);
      return acc;
    },
    {} as Record<string, UserBadge[]>,
  );

  // MVVバッジタイプの順序でソート
  const mvvBadges = [
    ...(groupedByType.MVV_PASSIONATE_EXECUTION || []),
    ...(groupedByType.MVV_SUPREME_RELATIONSHIPS || []),
    ...(groupedByType.MVV_HAPPINESS_CIRCULATION || []),
  ];

  // その他のバッジタイプ（MVV以外）を取得
  const otherBadges = enrichedBadges.filter(
    (badge) =>
      badge.badge_type !== "MVV_PASSIONATE_EXECUTION" &&
      badge.badge_type !== "MVV_SUPREME_RELATIONSHIPS" &&
      badge.badge_type !== "MVV_HAPPINESS_CIRCULATION",
  );

  // MVVバッジとその他のバッジを結合（MVVバッジを先に）
  return [...mvvBadges, ...otherBadges];
}

/**
 * ユーザーの最高ランクのバッジを取得（グッジョブ情報付き）
 */
export async function getUserTopBadge(
  userId: string,
): Promise<UserBadge | null> {
  const badges = await getUserBadges(userId);

  if (badges.length === 0) {
    return null;
  }

  // ランクが最も高い（数値が小さい）バッジを返す
  return badges.reduce((topBadge, currentBadge) =>
    currentBadge.rank < topBadge.rank ? currentBadge : topBadge,
  );
}

/**
 * 未通知のバッジを取得
 */
export async function getUnnotifiedBadges(
  userId: string,
): Promise<UserBadge[]> {
  const supabase = await createServiceClient();

  const { data, error } = await supabase
    .from("user_badges")
    .select("*")
    .eq("user_id", userId)
    .eq("is_notified", false)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching unnotified badges:", {
      error: error,
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
      userId: userId,
    });
    return [];
  }

  const badges = (data || []) as UserBadge[];

  // グッジョブバッジのタイトルを取得
  return enrichMissionBadges(badges);
}

/**
 * バッジを通知済みにマーク
 */
export async function markBadgesAsNotified(
  badgeIds: string[],
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createServiceClient();

  try {
    const { error } = await supabase
      .from("user_badges")
      .update({
        is_notified: true,
        updated_at: new Date().toISOString(),
      })
      .in("id", badgeIds);

    if (error) {
      console.error("Error marking badges as notified:", error);
      return { success: false, error: "バッジの通知状態の更新に失敗しました" };
    }

    return { success: true };
  } catch (error) {
    console.error("Unexpected error in markBadgesAsNotified:", error);
    return { success: false, error: "予期しないエラーが発生しました" };
  }
}

/**
 * MVVバッジを手動で付与する
 * @param user_id ユーザーID
 * @param badge_type MVVバッジタイプ
 * @param quarter_period 四半期（省略時は現在の四半期を自動設定）
 * @param rank ランク（デフォルトは1）
 * @returns 成功/失敗の結果
 */
export async function awardMvvBadge({
  user_id,
  badge_type,
  quarter_period,
  rank = 1,
}: {
  user_id: string;
  badge_type:
    | "MVV_PASSIONATE_EXECUTION"
    | "MVV_SUPREME_RELATIONSHIPS"
    | "MVV_HAPPINESS_CIRCULATION";
  quarter_period?: string;
  rank?: number;
}): Promise<{ success: boolean; error?: string; badgeId?: string }> {
  const supabase = await createServiceClient();

  try {
    // 四半期が指定されていない場合は現在の四半期を使用
    const finalQuarterPeriod = quarter_period || getCurrentQuarter();

    // 既存バッジを確認（同じユーザー、同じバッジタイプ、同じ四半期）
    const { data: existing, error: fetchError } = await supabase
      .from("user_badges")
      .select("*")
      .eq("user_id", user_id)
      .eq("badge_type", badge_type)
      .eq("quarter_period", finalQuarterPeriod)
      .maybeSingle();

    if (fetchError && fetchError.code !== "PGRST116") {
      // PGRST116 = no rows returned
      console.error("Error fetching existing MVV badge:", fetchError);
      return {
        success: false,
        error: `既存バッジの確認に失敗しました: ${fetchError.message}`,
      };
    }

    if (existing) {
      // 既に存在する場合は更新
      const { data: updated, error: updateError } = await supabase
        .from("user_badges")
        .update({
          rank,
          achieved_at: new Date().toISOString(),
          is_notified: false,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id)
        .select()
        .single();

      if (updateError) {
        console.error("Error updating MVV badge:", updateError);
        return {
          success: false,
          error: `バッジの更新に失敗しました: ${updateError.message}`,
        };
      }

      return { success: true, badgeId: updated.id };
    }

    // 新規作成
    const { data: newBadge, error: insertError } = await supabase
      .from("user_badges")
      .insert({
        user_id,
        badge_type,
        sub_type: null,
        rank,
        quarter_period: finalQuarterPeriod,
        achieved_at: new Date().toISOString(),
        is_notified: false,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error inserting MVV badge:", insertError);
      return {
        success: false,
        error: `バッジの作成に失敗しました: ${insertError.message}`,
      };
    }

    return { success: true, badgeId: newBadge.id };
  } catch (error) {
    console.error("Unexpected error in awardMvvBadge:", error);
    return {
      success: false,
      error: "予期しないエラーが発生しました",
    };
  }
}

/**
 * 指定された四半期のMVVバッジ一覧を取得
 * @param quarter_period 四半期（YYYY-QN形式）
 * @returns MVVバッジの配列
 */
export async function getMvvBadgesByQuarter(
  quarter_period: string,
): Promise<UserBadge[]> {
  const supabase = await createServiceClient();

  const { data, error } = await supabase
    .from("user_badges")
    .select("*")
    .in("badge_type", [
      "MVV_PASSIONATE_EXECUTION",
      "MVV_SUPREME_RELATIONSHIPS",
      "MVV_HAPPINESS_CIRCULATION",
    ])
    .eq("quarter_period", quarter_period)
    .order("achieved_at", { ascending: false });

  if (error) {
    console.error("Error fetching MVV badges by quarter:", error);
    return [];
  }

  // MVVバッジタイプの順序でソート
  return sortMvvBadgesByType((data || []) as UserBadge[]);
}

/**
 * ユーザーのMVVバッジ一覧を取得
 * @param userId ユーザーID
 * @returns MVVバッジの配列
 */
export async function getUserMvvBadges(userId: string): Promise<UserBadge[]> {
  const supabase = await createServiceClient();

  const { data, error } = await supabase
    .from("user_badges")
    .select("*")
    .eq("user_id", userId)
    .in("badge_type", [
      "MVV_PASSIONATE_EXECUTION",
      "MVV_SUPREME_RELATIONSHIPS",
      "MVV_HAPPINESS_CIRCULATION",
    ])
    .order("quarter_period", { ascending: false });

  if (error) {
    console.error("Error fetching user MVV badges:", error);
    return [];
  }

  // 四半期ごとにグループ化し、各グループ内でMVVバッジタイプの順序でソート
  const badges = (data || []) as UserBadge[];
  const groupedByQuarter = badges.reduce(
    (acc, badge) => {
      const quarter = badge.quarter_period || "";
      if (!acc[quarter]) {
        acc[quarter] = [];
      }
      acc[quarter].push(badge);
      return acc;
    },
    {} as Record<string, UserBadge[]>,
  );

  // 四半期の降順でソートし、各グループ内でMVVバッジタイプの順序でソート
  return Object.keys(groupedByQuarter)
    .sort((a, b) => b.localeCompare(a)) // 四半期の降順
    .flatMap((quarter) => sortMvvBadgesByType(groupedByQuarter[quarter]));
}

/**
 * MVVバッジを削除する
 * @param badgeId バッジID
 * @returns 成功/失敗の結果
 */
export async function removeMvvBadge(
  badgeId: string,
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createServiceClient();

  try {
    const { error } = await supabase
      .from("user_badges")
      .delete()
      .eq("id", badgeId)
      .in("badge_type", [
        "MVV_PASSIONATE_EXECUTION",
        "MVV_SUPREME_RELATIONSHIPS",
        "MVV_HAPPINESS_CIRCULATION",
      ]);

    if (error) {
      console.error("Error removing MVV badge:", error);
      return {
        success: false,
        error: `バッジの削除に失敗しました: ${error.message}`,
      };
    }

    return { success: true };
  } catch (error) {
    console.error("Unexpected error in removeMvvBadge:", error);
    return {
      success: false,
      error: "予期しないエラーが発生しました",
    };
  }
}

/**
 * 指定された四半期のMVVバッジとユーザー情報を取得
 * @param quarter_period 四半期（YYYY-QN形式）
 * @returns MVVバッジとユーザー情報を結合した配列
 */
export async function getMvvBadgesWithUsers(
  quarter_period: string,
): Promise<MvvBadgeWithUser[]> {
  const supabase = await createServiceClient();

  try {
    // バッジを取得
    const badges = await getMvvBadgesByQuarter(quarter_period);

    if (badges.length === 0) {
      return [];
    }

    // ユーザーIDのリストを抽出（重複を除去）
    const userIds = Array.from(new Set(badges.map((badge) => badge.user_id)));

    // ユーザー情報を一括取得
    const { data: users, error: usersError } = await supabase
      .from("public_user_profiles")
      .select("id, name, avatar_url")
      .in("id", userIds);

    if (usersError) {
      console.error("Error fetching user profiles:", usersError);
      return [];
    }

    // ユーザー情報のマップを作成
    const userMap = new Map(
      (users || []).map((user) => [
        user.id,
        {
          name: user.name || "",
          avatar_url: user.avatar_url,
        },
      ]),
    );

    // バッジとユーザー情報を結合
    return badges
      .map((badge) => {
        const userInfo = userMap.get(badge.user_id);
        if (!userInfo) {
          return null;
        }
        return {
          ...badge,
          user_name: userInfo.name,
          user_avatar_url: userInfo.avatar_url,
        } as MvvBadgeWithUser;
      })
      .filter((badge): badge is MvvBadgeWithUser => badge !== null);
  } catch (error) {
    console.error("Unexpected error in getMvvBadgesWithUsers:", error);
    return [];
  }
}
