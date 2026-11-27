import { getUserTopBadge } from "@/lib/services/badges";
import { SupabaseQueryError } from "@/lib/supabase/fetch-all-rows";
import { BadgeDisplay } from "./badge-display";

interface UserTopBadgeProps {
  userId: string;
}

export async function UserTopBadge({ userId }: UserTopBadgeProps) {
  // ヒーローの飾りなので、取得に失敗したらバッジだけを出さずにトップ全体を残す。
  // それ以外の例外は実装の誤りなので握りつぶさず、リクエストエラーとして記録させる
  const topBadge = await getUserTopBadge(userId).catch((error: unknown) => {
    if (!(error instanceof SupabaseQueryError)) {
      throw error;
    }
    console.error("Error fetching user top badge:", error);
    return null;
  });

  if (!topBadge) {
    return null;
  }

  return <BadgeDisplay badge={topBadge} className="w-fit" />;
}
