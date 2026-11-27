import { getUserTopBadge } from "@/lib/services/badges";
import { BadgeDisplay } from "./badge-display";

interface UserTopBadgeProps {
  userId: string;
}

export async function UserTopBadge({ userId }: UserTopBadgeProps) {
  // ヒーローの飾りなので、取得に失敗したらバッジだけを出さずにトップ全体を残す
  const topBadge = await getUserTopBadge(userId).catch((error) => {
    console.error("Error fetching user top badge:", error);
    return null;
  });

  if (!topBadge) {
    return null;
  }

  return <BadgeDisplay badge={topBadge} className="w-fit" />;
}
