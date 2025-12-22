export type BadgeType =
  | "DAILY"
  | "ALL"
  | "PREFECTURE"
  | "MISSION"
  | "MVV_PASSIONATE_EXECUTION"
  | "MVV_SUPREME_RELATIONSHIPS"
  | "MVV_HAPPINESS_CIRCULATION";

export type MvvBadgeType =
  | "MVV_PASSIONATE_EXECUTION"
  | "MVV_SUPREME_RELATIONSHIPS"
  | "MVV_HAPPINESS_CIRCULATION";

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
  // MVVバッジの場合、四半期情報（YYYY-QN形式、例：2024-Q1）
  quarter_period?: string | null;
  // MVVバッジの場合、バッジ画像のパス（Supabase Storageのパス）
  badge_image_path?: string | null;
  // MVVバッジの場合、アイコン画像のパス（Supabase Storageのパス）
  icon_image_path?: string | null;
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

export interface MvvBadgeWithUser extends UserBadge {
  user_name: string;
  user_avatar_url: string | null;
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
    case "MVV_PASSIONATE_EXECUTION":
      return `夢中になってやり切る${badge.quarter_period ? ` (${badge.quarter_period})` : ""}`;
    case "MVV_SUPREME_RELATIONSHIPS":
      return `至高な人間関係${badge.quarter_period ? ` (${badge.quarter_period})` : ""}`;
    case "MVV_HAPPINESS_CIRCULATION":
      return `幸せの循環${badge.quarter_period ? ` (${badge.quarter_period})` : ""}`;
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
  MVV_PASSIONATE_EXECUTION: "MVV_PASSIONATE_EXECUTION",
  MVV_SUPREME_RELATIONSHIPS: "MVV_SUPREME_RELATIONSHIPS",
  MVV_HAPPINESS_CIRCULATION: "MVV_HAPPINESS_CIRCULATION",
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
    case BadgeType.MVV_PASSIONATE_EXECUTION:
    case BadgeType.MVV_SUPREME_RELATIONSHIPS:
    case BadgeType.MVV_HAPPINESS_CIRCULATION:
      // MVVバッジはランキングページへのリンクなし
      return null;
    default:
      return null;
  }
}

/**
 * 四半期を計算する
 * Q1: 4月〜6月
 * Q2: 7月〜8月
 * Q3: 9月〜11月
 * Q4: 12月〜2月（次の年度）
 * @param date 日付（省略時は現在日時）
 * @returns 四半期文字列（YYYY-QN形式、例：2024-Q1）
 */
export function getQuarterPeriod(date?: Date): string {
  const targetDate = date || new Date();
  // 日本時間（JST）で計算
  const jstDate = new Date(
    targetDate.toLocaleString("en-US", { timeZone: "Asia/Tokyo" }),
  );
  const year = jstDate.getFullYear();
  const month = jstDate.getMonth() + 1; // 0-indexedなので+1

  let quarter: number;
  let fiscalYear: number;

  if (month >= 4 && month <= 6) {
    // Q1: 4月〜6月
    quarter = 1;
    fiscalYear = year;
  } else if (month >= 7 && month <= 8) {
    // Q2: 7月〜8月
    quarter = 2;
    fiscalYear = year;
  } else if (month >= 9 && month <= 11) {
    // Q3: 9月〜11月
    quarter = 3;
    fiscalYear = year;
  } else {
    // Q4: 12月〜2月（次の年度）
    quarter = 4;
    fiscalYear = month === 12 ? year : year - 1;
  }

  return `${fiscalYear}-Q${quarter}`;
}

/**
 * 現在の四半期を取得
 * @returns 四半期文字列（YYYY-QN形式、例：2024-Q1）
 */
export function getCurrentQuarter(): string {
  return getQuarterPeriod();
}

/**
 * 表彰すべき四半期を取得
 * 各四半期の終了月にその四半期を表彰する
 * - 6月に表彰されるのはQ1（4月〜6月）
 * - 9月に表彰されるのはQ2（7月〜8月）
 * - 12月に表彰されるのはQ3（9月〜11月）
 * - 3月に表彰されるのはQ4（12月〜2月）
 * その他の月（四半期の途中）の場合は、現在の四半期を返す
 * @param date 日付（省略時は現在日時）
 * @returns 四半期文字列（YYYY-QN形式、例：2024-Q1）
 */
export function getAwardQuarter(date?: Date): string {
  const targetDate = date || new Date();
  // 日本時間（JST）で計算
  const jstDate = new Date(
    targetDate.toLocaleString("en-US", { timeZone: "Asia/Tokyo" }),
  );
  const year = jstDate.getFullYear();
  const month = jstDate.getMonth() + 1; // 0-indexedなので+1

  let quarter: number;
  let fiscalYear: number;

  // 表彰月の判定
  if (month === 6) {
    // 6月に表彰されるのはQ1（4月〜6月）
    quarter = 1;
    fiscalYear = year;
  } else if (month === 9) {
    // 9月に表彰されるのはQ2（7月〜8月）
    quarter = 2;
    fiscalYear = year;
  } else if (month === 12) {
    // 12月に表彰されるのはQ3（9月〜11月）
    quarter = 3;
    fiscalYear = year;
  } else if (month === 3) {
    // 3月に表彰されるのはQ4（12月〜2月）
    quarter = 4;
    fiscalYear = year - 1;
  } else {
    // その他の月（四半期の途中）の場合は、現在の四半期を返す
    return getQuarterPeriod(date);
  }

  return `${fiscalYear}-Q${quarter}`;
}

/**
 * 利用可能な四半期のリストを生成（過去2年分）
 * @returns 四半期文字列の配列（YYYY-QN形式）
 */
export function getAvailableQuarters(): string[] {
  const quarters: string[] = [];
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  // 現在の年度を計算（4月が年度開始月）
  let fiscalYear = currentYear;
  if (currentMonth < 4) {
    fiscalYear = currentYear - 1;
  }

  // 過去2年分の四半期を生成
  for (let yearOffset = 1; yearOffset >= -1; yearOffset--) {
    const targetYear = fiscalYear + yearOffset;
    for (let quarter = 1; quarter <= 4; quarter++) {
      quarters.push(`${targetYear}-Q${quarter}`);
    }
  }

  return quarters.reverse(); // 最新の四半期が最後に来るように
}
