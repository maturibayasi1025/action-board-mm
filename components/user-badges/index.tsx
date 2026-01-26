"use client";

import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getUserBadges } from "@/lib/services/badges";
import { createClient } from "@/lib/supabase/client";
import {
  type MvvBadgeType,
  type UserBadge,
  getBadgeEmoji,
  getBadgeTitle,
} from "@/lib/types/badge";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

interface UserBadgesProps {
  userId: string;
}

export function UserBadges({ userId }: UserBadgesProps) {
  const [badges, setBadges] = useState<UserBadge[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchBadges() {
      try {
        const userBadges = await getUserBadges(userId);
        setBadges(userBadges);
      } catch (error) {
        console.error("Error fetching badges:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchBadges();
  }, [userId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <div className="text-sm text-muted-foreground">読み込み中...</div>
      </div>
    );
  }

  if (badges.length === 0) {
    return (
      <div className="flex items-center justify-center py-4">
        <div className="text-sm text-muted-foreground">
          まだバッジを獲得していません
        </div>
      </div>
    );
  }

  // バッジをタイプ別にグループ化
  const groupedBadges = badges.reduce(
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

  return (
    <div className="space-y-4">
      {/* 総合ランキングバッジ */}
      {groupedBadges.ALL && (
        <div>
          <h4 className="text-sm font-medium mb-2">総合ランキング</h4>
          <div className="flex flex-wrap gap-2">
            {groupedBadges.ALL.map((badge) => (
              <BadgeItem key={badge.id} badge={badge} />
            ))}
          </div>
        </div>
      )}

      {/* デイリーランキングバッジ */}
      {groupedBadges.DAILY && (
        <div>
          <h4 className="text-sm font-medium mb-2">デイリーランキング</h4>
          <div className="flex flex-wrap gap-2">
            {groupedBadges.DAILY.map((badge) => (
              <BadgeItem key={badge.id} badge={badge} />
            ))}
          </div>
        </div>
      )}

      {/* 都道府県ランキングバッジ */}
      {groupedBadges.PREFECTURE && (
        <div>
          <h4 className="text-sm font-medium mb-2">都道府県ランキング</h4>
          <div className="flex flex-wrap gap-2">
            {groupedBadges.PREFECTURE.map((badge) => (
              <BadgeItem key={badge.id} badge={badge} />
            ))}
          </div>
        </div>
      )}

      {/* グッジョブランキングバッジ */}
      {groupedBadges.MISSION && (
        <div>
          <h4 className="text-sm font-medium mb-2">グッジョブランキング</h4>
          <div className="flex flex-wrap gap-2">
            {groupedBadges.MISSION.map((badge) => (
              <BadgeItem key={badge.id} badge={badge} />
            ))}
          </div>
        </div>
      )}

      {/* MVVバッジ */}
      {(groupedBadges.MVV_PASSIONATE_EXECUTION ||
        groupedBadges.MVV_SUPREME_RELATIONSHIPS ||
        groupedBadges.MVV_HAPPINESS_CIRCULATION ||
        groupedBadges.MVV_START_DASH) && (
        <div>
          <h4 className="text-sm font-medium mb-2">MVVバッジ</h4>
          <div className="flex flex-wrap gap-2">
            {groupedBadges.MVV_PASSIONATE_EXECUTION?.map((badge) => (
              <BadgeItem key={badge.id} badge={badge} />
            ))}
            {groupedBadges.MVV_SUPREME_RELATIONSHIPS?.map((badge) => (
              <BadgeItem key={badge.id} badge={badge} />
            ))}
            {groupedBadges.MVV_HAPPINESS_CIRCULATION?.map((badge) => (
              <BadgeItem key={badge.id} badge={badge} />
            ))}
            {groupedBadges.MVV_START_DASH?.map((badge) => (
              <BadgeItem key={badge.id} badge={badge} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// MVVバッジタイプのラベル定義
const MVV_BADGE_TYPE_LABELS: Record<MvvBadgeType, string> = {
  MVV_PASSIONATE_EXECUTION: "夢中になってやり切る",
  MVV_SUPREME_RELATIONSHIPS: "至高な人間関係",
  MVV_HAPPINESS_CIRCULATION: "幸せの循環",
  MVV_START_DASH: "スタートダッシュ",
} as const;

// MVVバッジのラベルを取得する関数
function getMvvBadgeLabel(badge: UserBadge): string | null {
  if (
    badge.badge_type === "MVV_PASSIONATE_EXECUTION" ||
    badge.badge_type === "MVV_SUPREME_RELATIONSHIPS" ||
    badge.badge_type === "MVV_HAPPINESS_CIRCULATION" ||
    badge.badge_type === "MVV_START_DASH"
  ) {
    return MVV_BADGE_TYPE_LABELS[badge.badge_type as MvvBadgeType] || null;
  }
  return null;
}

function BadgeItem({ badge }: { badge: UserBadge }) {
  const [imageError, setImageError] = useState(false);
  const isMvvBadge =
    badge.badge_type === "MVV_PASSIONATE_EXECUTION" ||
    badge.badge_type === "MVV_SUPREME_RELATIONSHIPS" ||
    badge.badge_type === "MVV_HAPPINESS_CIRCULATION" ||
    badge.badge_type === "MVV_START_DASH";

  // MVVバッジの画像URLを取得
  const badgeImageUrl = useMemo(() => {
    if (!isMvvBadge) return null;

    const supabase = createClient();
    let badgeImagePath: string | null = null;

    // データベースに画像パスが存在する場合はそれを優先
    if (badge.badge_image_path) {
      const { data } = supabase.storage
        .from("mvv_badge_images")
        .getPublicUrl(badge.badge_image_path);
      badgeImagePath = data.publicUrl;
    } else if (badge.quarter_period === "2025-Q3") {
      // フォールバック: 2025-Q3の場合のみ固定パスを使用
      const badgeImageMap: Record<string, string> = {
        MVV_PASSIONATE_EXECUTION: "/img/MVV/2025-3Q/badge-夢中.png",
        MVV_SUPREME_RELATIONSHIPS: "/img/MVV/2025-3Q/badge-人間関係.png",
        MVV_HAPPINESS_CIRCULATION: "/img/MVV/2025-3Q/badge-幸せ.png",
        MVV_START_DASH: "/img/MVV/2025-3Q/badge-スタートダッシュ.png",
      };
      badgeImagePath = badgeImageMap[badge.badge_type] || null;
    }

    return badgeImagePath;
  }, [
    isMvvBadge,
    badge.badge_type,
    badge.badge_image_path,
    badge.quarter_period,
  ]);

  // MVVバッジのラベルを取得
  const mvvBadgeLabel = useMemo(
    () => (isMvvBadge ? getMvvBadgeLabel(badge) : null),
    [isMvvBadge, badge],
  );

  // MVVバッジの場合は絵文字なし、ランキングバッジの場合はランクに応じた絵文字
  const emoji = isMvvBadge ? null : getBadgeEmoji(badge.rank);
  const title = getBadgeTitle(badge);

  // MVVバッジで画像がある場合
  if (isMvvBadge && badgeImageUrl && !imageError) {
    const tooltipText = mvvBadgeLabel || title;

    if (tooltipText) {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="relative inline-block cursor-pointer">
                <Image
                  src={badgeImageUrl}
                  alt={tooltipText}
                  width={56}
                  height={56}
                  className="object-contain rounded-lg hover:opacity-80 transition-opacity"
                  onError={() => {
                    // 画像読み込みエラー時のフォールバック
                    setImageError(true);
                  }}
                />
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>{tooltipText}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }

    return (
      <div className="relative inline-block">
        <Image
          src={badgeImageUrl}
          alt="MVVバッジ"
          width={56}
          height={56}
          className="object-contain rounded-lg cursor-pointer hover:opacity-80 transition-opacity"
          onError={() => {
            // 画像読み込みエラー時のフォールバック
            setImageError(true);
          }}
        />
      </div>
    );
  }

  // MVVバッジで画像がない場合、またはランキングバッジの場合
  const badgeContent = (
    <Badge
      variant={
        isMvvBadge
          ? "default"
          : badge.rank <= 10
            ? "default"
            : badge.rank <= 50
              ? "secondary"
              : "outline"
      }
      className="flex items-center gap-1"
    >
      {emoji && <span className="text-base">{emoji}</span>}
      <span>{title}</span>
    </Badge>
  );

  // MVVバッジでツールチップを表示
  if (isMvvBadge && mvvBadgeLabel) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{badgeContent}</TooltipTrigger>
          <TooltipContent>
            <p>{mvvBadgeLabel}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return badgeContent;
}
