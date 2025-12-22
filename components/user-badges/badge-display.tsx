import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { createClient } from "@/lib/supabase/server";
import {
  type MvvBadgeType,
  type UserBadge,
  getBadgeEmoji,
  getBadgeRankingUrl,
  getBadgeTitle,
} from "@/lib/types/badge";
import Image from "next/image";
import Link from "next/link";

interface BadgeDisplayProps {
  badge: UserBadge;
  showTitle?: boolean;
  className?: string;
  clickable?: boolean;
}

// MVVバッジタイプのラベル定義
const MVV_BADGE_TYPE_LABELS: Record<MvvBadgeType, string> = {
  MVV_PASSIONATE_EXECUTION: "夢中になってやり切る",
  MVV_SUPREME_RELATIONSHIPS: "至高な人間関係",
  MVV_HAPPINESS_CIRCULATION: "幸せの循環",
  MVV_START_DASH: "スタートダッシュ",
} as const;

export function getGradientClass(rank: number): string {
  return "bg-gradient-to-r from-emerald-500 to-emerald-600 text-white border-0";
}

// MVVバッジの画像URLを取得する関数
async function getMvvBadgeImageUrl(badge: UserBadge): Promise<string | null> {
  const supabase = await createClient();
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
}

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

export async function BadgeDisplay({
  badge,
  showTitle = true,
  className = "",
  clickable = true,
}: BadgeDisplayProps) {
  const isMvvBadge =
    badge.badge_type === "MVV_PASSIONATE_EXECUTION" ||
    badge.badge_type === "MVV_SUPREME_RELATIONSHIPS" ||
    badge.badge_type === "MVV_HAPPINESS_CIRCULATION" ||
    badge.badge_type === "MVV_START_DASH";

  // MVVバッジの画像URLを取得
  const badgeImageUrl = isMvvBadge ? await getMvvBadgeImageUrl(badge) : null;
  const mvvBadgeLabel = isMvvBadge ? getMvvBadgeLabel(badge) : null;

  // MVVバッジで画像がある場合
  if (isMvvBadge && badgeImageUrl) {
    const title = showTitle ? getBadgeTitle(badge) : null;
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
        />
      </div>
    );
  }

  // MVVバッジで画像がない場合、またはランキングバッジの場合
  const emoji = isMvvBadge ? null : getBadgeEmoji(badge.rank);
  const title = showTitle ? getBadgeTitle(badge) : null;
  const url = getBadgeRankingUrl(badge);

  const badgeContent = (
    <Badge
      className={`flex items-center gap-1 shadow-sm ${
        isMvvBadge ? "" : getGradientClass(badge.rank)
      } ${
        clickable && url
          ? "cursor-pointer hover:opacity-80 transition-opacity"
          : ""
      } ${className}`}
    >
      {emoji && <span className="text-base">{emoji}</span>}
      {title && <span className="font-medium">{title}</span>}
    </Badge>
  );

  // MVVバッジでツールチップを表示
  if (isMvvBadge && mvvBadgeLabel) {
    const wrappedContent =
      clickable && url ? (
        <Link href={url} className="inline-block">
          {badgeContent}
        </Link>
      ) : (
        badgeContent
      );

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{wrappedContent}</TooltipTrigger>
          <TooltipContent>
            <p>{mvvBadgeLabel}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (clickable && url) {
    return (
      <Link href={url} className="inline-block">
        {badgeContent}
      </Link>
    );
  }

  return badgeContent;
}
