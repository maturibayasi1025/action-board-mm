import { getUserBadges } from "@/lib/services/badges";
import { BadgeDisplay } from "./badge-display";

interface UserBadgesProps {
  userId: string;
}

export async function UserBadges({ userId }: UserBadgesProps) {
  const badges = await getUserBadges(userId).catch((error) => {
    console.error("Error fetching user badges:", error);
    return null;
  });

  if (!badges) {
    return (
      <div className="flex items-center justify-center py-4">
        <p role="alert" className="text-sm text-muted-foreground">
          バッジの取得に失敗しました
        </p>
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

  return (
    <div className="flex flex-wrap gap-2">
      {
        await Promise.all(
          badges.map(async (badge) => (
            <BadgeDisplay key={badge.id} badge={badge} />
          )),
        )
      }
    </div>
  );
}
