export type BadgeType = "DAILY" | "ALL" | "PREFECTURE" | "MISSION";

export interface UserBadge {
  id: string;
  user_id: string;
  badge_type: BadgeType;
  sub_type: string | null;
  rank: number;
  achieved_at: string;
  is_notified: boolean;
  created_at: string;
  updated_at: string;
  // グッジョブバッジの場合、グッジョブのタイトル
  mission_title?: string;
  // グッジョブバッジの場合、グッジョブのID（リンク生成用）
  mission_id?: string;
}

export interface BadgeUpdateParams {
  user_id: string;
  badge_type: BadgeType;
  sub_type: string | null;
  rank: number;
}

export interface BadgeNotification {
  badge: UserBadge;
  badgeTitle: string;
  badgeDescription: string;
}

export const getBadgeTitle = (badge: UserBadge): string => {
  switch (badge.badge_type) {
    case "DAILY":
      return `デイリーランキング ${badge.rank}位`;
    case "ALL":
      return `総合ランキング ${badge.rank}位`;
    case "PREFECTURE":
      return `${badge.sub_type}ランキング ${badge.rank}位`;
    case "MISSION":
      return `${badge.mission_title || badge.sub_type} ${badge.rank}位`;
    default:
      return `ランキング ${badge.rank}位`;
  }
};

export const getBadgeEmoji = (rank: number): string => {
  if (rank <= 10) return "🥇";
  if (rank <= 50) return "🥈";
  return "🥉";
};

export const BadgeType = {
  DAILY: "DAILY",
  ALL: "ALL",
  PREFECTURE: "PREFECTURE",
  MISSION: "MISSION",
} as const;

/**
 * バッジタイプに応じたランキングページのURLを取得
 */
export function getBadgeRankingUrl(badge: UserBadge): string | null {
  switch (badge.badge_type) {
    case BadgeType.DAILY:
      return "/ranking?period=daily";
    case BadgeType.ALL:
      return "/ranking?period=all";
    case BadgeType.PREFECTURE:
      // 都道府県名をURLエンコード
      if (badge.sub_type) {
        return `/ranking/ranking-prefecture?prefecture=${encodeURIComponent(badge.sub_type)}`;
      }
      return "/ranking/ranking-prefecture";
    case BadgeType.MISSION:
      // グッジョブIDがあればそれを使用
      if (badge.mission_id) {
        return `/ranking/ranking-mission?missionId=${badge.mission_id}`;
      }
      // mission_idがない場合は汎用グッジョブページへ
      return "/ranking/ranking-mission";
    default:
      return null;
  }
}
