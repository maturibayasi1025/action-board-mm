// import Activities from "@/components/activities";
import Hero from "@/components/hero";
import dynamic from "next/dynamic";

export const runtime = "edge";

// クライアントコンポーネントを動的インポート（Edge runtime互換性向上）
const BadgeNotificationCheck = dynamic(() =>
  import("@/components/badge-notification-check").then((mod) => ({
    default: mod.BadgeNotificationCheck,
  })),
);

const LevelUpCheck = dynamic(() =>
  import("@/components/level-up-check").then((mod) => ({
    default: mod.LevelUpCheck,
  })),
);
import MetricsWithSuspense from "@/components/metrics/MetricsWithSuspense";
import FeaturedMissions from "@/components/mission/FeaturedMissions";
import ImportantMissions from "@/components/mission/ImportantMissions";
import MissionsByCategory from "@/components/mission/MissionsByCategory";
// import Missions from "@/components/mission/missions";
// import RankingTop from "@/components/ranking/ranking-top";
// import RankingSection from "@/components/top/ranking-section";
import UserMissionsSection from "@/components/top/user-missions-section";
// import { Button } from "@/components/ui/button";
// import { Card } from "@/components/ui/card";
import { generateRootMetadata } from "@/lib/metadata";
import { checkBadgeNotifications } from "@/lib/services/badgeNotification";
import { checkLevelUpNotification } from "@/lib/services/levelUpNotification";
import {
  hasFeaturedMissions,
  hasImportantMissions,
} from "@/lib/services/missions";
import { createClient } from "@/lib/supabase/server";
// import { Edit3, MessageCircle } from "lucide-react";
// import Link from "next/link";
import { redirect } from "next/navigation";

// メタデータ生成を外部関数に委譲
export const generateMetadata = generateRootMetadata;

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const supabase = await createClient();
  const params = await searchParams;
  const referralCode = params.ref;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // レベルアップ通知とバッジ通知をチェック
  let levelUpNotification = null;
  let badgeNotifications = null;

  if (user) {
    const { data: privateUser } = await supabase
      .from("private_users")
      .select("id")
      .eq("id", user.id)
      .single();
    if (!privateUser) {
      redirect("/settings/profile?new=true");
    }

    // レベルアップ通知をチェック
    // 自動グッジョブ（紹介など）でレベルアップした場合の通知を表示するため有効化
    const levelUpCheck = await checkLevelUpNotification(user.id);
    if (levelUpCheck.shouldNotify && levelUpCheck.levelUp) {
      levelUpNotification = levelUpCheck.levelUp;
    }

    // バッジ通知をチェック
    const badgeCheck = await checkBadgeNotifications(user.id);
    if (badgeCheck.hasNewBadges && badgeCheck.newBadges) {
      badgeNotifications = badgeCheck.newBadges;
    }
  }

  //フューチャードグッジョブの存在確認
  // const showFeatured = await hasFeaturedMissions();
  //重要グッジョブの存在確認
  const showImportant = await hasImportantMissions();

  return (
    <div className="flex flex-col min-h-screen py-4">
      {/* レベルアップ通知 */}
      {levelUpNotification && (
        <LevelUpCheck levelUpData={levelUpNotification} />
      )}

      {/* バッジ通知 */}
      {badgeNotifications && (
        <BadgeNotificationCheck badgeData={badgeNotifications} />
      )}

      {/* ヒーローセクション */}
      <section>
        <Hero />
      </section>

      {/* メトリクスセクション */}
      {/* <MetricsWithSuspense /> */}

      {/* ランキングセクション - 一時的に非表示 */}
      {/* <section className="py-12 md:py-16 bg-white">
        <RankingSection />
      </section> */}

      {/* フューチャードグッジョブセクション */}
      {/* {showFeatured && (
        <section className="py-12 md:py-16 bg-white">
          <FeaturedMissions userId={user?.id} showAchievedMissions={true} />
        </section>
      )} */}

      {/* 重要グッジョブセクション */}
      {showImportant && (
        <section className="py-12 md:py-16 bg-white">
          <ImportantMissions userId={user?.id} showAchievedMissions={true} />
        </section>
      )}

      {/* グッジョブセクション */}
      <section className="py-12 md:py-16 bg-white">
        <MissionsByCategory
          userId={user?.id}
          showAchievedMissions={true}
          id="missions"
        />
      </section>

      {/* ユーザーグッジョブセクション */}
      <UserMissionsSection />

      {/* アクティビティセクション - 一時的に非表示 */}
      {/* <section className="py-12 md:py-16 bg-white">
        <Activities />
      </section> */}
    </div>
  );
}
