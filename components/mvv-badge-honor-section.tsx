import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getMvvBadgesWithUsers } from "@/lib/services/badges";
import { createClient } from "@/lib/supabase/server";
import {
  type MvvBadgeType,
  type MvvBadgeWithUser,
  getAwardQuarter,
} from "@/lib/types/badge";
import Image from "next/image";
import Link from "next/link";

const MVV_BADGE_TYPE_LABELS: Record<MvvBadgeType, string> = {
  MVV_PASSIONATE_EXECUTION: "夢中になってやり切る",
  MVV_SUPREME_RELATIONSHIPS: "至高な人間関係",
  MVV_HAPPINESS_CIRCULATION: "幸せの循環",
} as const;

export default async function MvvBadgeHonorSection() {
  const awardQuarter = getAwardQuarter();
  const badgesWithUsers = await getMvvBadgesWithUsers(awardQuarter);

  // バッジが0件の場合は非表示
  if (badgesWithUsers.length === 0) {
    return null;
  }

  // すべてのバッジの画像パスを事前に取得
  const supabase = await createClient();
  const badgesWithImages = await Promise.all(
    badgesWithUsers.map(async (badge) => {
      let badgeImagePath: string | null = null;
      let iconImagePath: string | null = null;

      // データベースに保存された画像パスから公開URLを取得
      if (badge.badge_image_path) {
        const { data } = supabase.storage
          .from("mvv_badge_images")
          .getPublicUrl(badge.badge_image_path);
        badgeImagePath = data.publicUrl;
      }

      if (badge.icon_image_path) {
        const { data } = supabase.storage
          .from("mvv_badge_images")
          .getPublicUrl(badge.icon_image_path);
        iconImagePath = data.publicUrl;
      }

      return {
        ...badge,
        badgeImagePath,
        iconImagePath,
      };
    }),
  );

  return (
    <section className="py-12 md:py-16 bg-white">
      <div className="container mx-auto px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold mb-8 text-center">
            🏆 今回の表彰者
          </h2>
          <p className="text-center text-muted-foreground mb-8">
            11期3Qで表彰されたメンバー
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {badgesWithImages.map((badge) => (
              <UserBadgeCard
                key={badge.id}
                badge={badge}
                badgeImagePath={badge.badgeImagePath}
                iconImagePath={badge.iconImagePath}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function UserBadgeCard({
  badge,
  badgeImagePath,
  iconImagePath,
}: {
  badge: MvvBadgeWithUser;
  badgeImagePath: string | null;
  iconImagePath: string | null;
}) {
  // getMvvBadgesWithUsers は MVV バッジのみを返すため、型アサーションで安全にアクセス
  const badgeTypeLabel =
    MVV_BADGE_TYPE_LABELS[badge.badge_type as MvvBadgeType];

  return (
    <Link href={`/users/${badge.user_id}`}>
      <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full sparkle-effect relative border-2 border-yellow-200/50 shadow-md">
        <CardContent className="p-4 relative z-10">
          <div className="flex items-center justify-center gap-4 mb-3">
            {iconImagePath && (
              <div className="flex-shrink-0">
                <Image
                  src={iconImagePath}
                  alt={badgeTypeLabel}
                  width={48}
                  height={48}
                  className="object-contain rounded-lg"
                />
              </div>
            )}
            <div className="flex items-center gap-2">
              <div className="font-semibold text-lg">{badge.user_name}</div>
              {badgeImagePath && (
                <div className="flex-shrink-0">
                  <Image
                    src={badgeImagePath}
                    alt={badgeTypeLabel}
                    width={28}
                    height={28}
                    className="object-contain rounded-lg"
                  />
                </div>
              )}
            </div>
          </div>
          <div className="space-y-2">
            {!iconImagePath && (
              <Badge variant="default" className="w-full justify-center py-1.5">
                {badgeTypeLabel}
              </Badge>
            )}
            <div className="text-xs text-center text-muted-foreground">
              {badge.quarter_period}
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
