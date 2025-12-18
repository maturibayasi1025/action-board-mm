import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import UserAvatar from "@/components/user-avatar";
import { getMvvBadgesWithUsers } from "@/lib/services/badges";
import {
  type MvvBadgeWithUser,
  getAwardQuarter,
  getBadgeTitle,
} from "@/lib/types/badge";
import Link from "next/link";

const MVV_BADGE_TYPE_LABELS = {
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

  return (
    <section className="py-12 md:py-16 bg-white">
      <div className="container mx-auto px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold mb-8 text-center">
            🏆 MVVバッジ表彰
          </h2>
          <p className="text-center text-muted-foreground mb-8">
            {awardQuarter} 四半期のMVVバッジを獲得したメンバーを表彰します
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {badgesWithUsers.map((badge) => (
              <UserBadgeCard key={badge.id} badge={badge} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function UserBadgeCard({ badge }: { badge: MvvBadgeWithUser }) {
  const badgeTypeLabel = MVV_BADGE_TYPE_LABELS[badge.badge_type];

  return (
    <Link href={`/users/${badge.user_id}`}>
      <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
        <CardContent className="p-4">
          <div className="flex items-center gap-4 mb-3">
            <UserAvatar
              userProfile={{
                name: badge.user_name,
                avatar_url: badge.user_avatar_url,
              }}
              size="lg"
            />
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-lg truncate">
                {badge.user_name}
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <Badge variant="default" className="w-full justify-center py-1.5">
              {badgeTypeLabel}
            </Badge>
            <div className="text-xs text-center text-muted-foreground">
              {badge.quarter_period}
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
