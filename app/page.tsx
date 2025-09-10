import Activities from "@/components/activities";
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
import MissionsByCategory from "@/components/mission/MissionsByCategory";
import Missions from "@/components/mission/missions";
import RankingTop from "@/components/ranking/ranking-top";
import RankingSection from "@/components/top/ranking-section";
import UserMissionsSection from "@/components/top/user-missions-section";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { generateRootMetadata } from "@/lib/metadata";
import { checkBadgeNotifications } from "@/lib/services/badgeNotification";
import { checkLevelUpNotification } from "@/lib/services/levelUpNotification";
import { hasFeaturedMissions } from "@/lib/services/missions";
import { createClient } from "@/lib/supabase/server";
import { Edit3, MessageCircle } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

// メタデータ生成を外部関数に委譲
export const generateMetadata = generateRootMetadata;

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  try {
    const supabase = await createClient();
    const params = await searchParams;
    const referralCode = params.ref;

    // Cloudflare Pages環境での環境変数チェック
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      console.warn("[Home] Supabase environment variables not configured");
      // 環境変数が設定されていない場合のフォールバック
      return (
        <div className="flex flex-col min-h-screen py-4">
          <section>
            <Hero />
          </section>
          <div className="flex items-center justify-center py-12">
            <Card className="p-6 max-w-md">
              <h2 className="text-xl font-semibold mb-4">設定が必要です</h2>
              <p className="text-muted-foreground mb-4">
                環境変数を設定してからアプリケーションを再デプロイしてください。
              </p>
              <Button asChild>
                <Link href="/privacy">プライバシーポリシー</Link>
              </Button>
            </Card>
          </div>
        </div>
      );
    }

    let user = null;
    try {
      const { data } = await supabase.auth.getUser();
      user = data.user;
    } catch (authError) {
      console.warn("[Home] Auth error:", authError);
      // 認証エラーは無視して続行
    }

    // レベルアップ通知とバッジ通知をチェック
    let levelUpNotification = null;
    let badgeNotifications = null;

    if (user) {
      try {
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
        try {
          const levelUpCheck = await checkLevelUpNotification(user.id);
          if (levelUpCheck.shouldNotify && levelUpCheck.levelUp) {
            levelUpNotification = levelUpCheck.levelUp;
          }
        } catch (levelUpError) {
          console.warn("[Home] Level up check error:", levelUpError);
        }

        // バッジ通知をチェック
        try {
          const badgeCheck = await checkBadgeNotifications(user.id);
          if (badgeCheck.hasNewBadges && badgeCheck.newBadges) {
            badgeNotifications = badgeCheck.newBadges;
          }
        } catch (badgeError) {
          console.warn("[Home] Badge check error:", badgeError);
        }
      } catch (userError) {
        console.warn("[Home] User data error:", userError);
      }
    }

    //フューチャードグッジョブの存在確認
    let showFeatured = false;
    try {
      showFeatured = await hasFeaturedMissions();
    } catch (featuredError) {
      console.warn("[Home] Featured missions check error:", featuredError);
    }

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
        <MetricsWithSuspense />

        {/* ランキングセクション - 一時的に非表示 */}
        {/* <section className="py-12 md:py-16 bg-white">
        <RankingSection />
      </section> */}

        {/* フューチャードグッジョブセクション */}
        {showFeatured && (
          <section className="py-12 md:py-16 bg-white">
            <FeaturedMissions userId={user?.id} showAchievedMissions={true} />
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
  } catch (error) {
    console.error("[Home] Critical error:", error);
    // 致命的なエラーが発生した場合のフォールバック表示
    return (
      <div className="flex flex-col min-h-screen py-4">
        <section>
          <Hero />
        </section>
        <div className="flex items-center justify-center py-12">
          <Card className="p-6 max-w-md">
            <h2 className="text-xl font-semibold mb-4 text-red-600">
              エラーが発生しました
            </h2>
            <p className="text-muted-foreground mb-4">
              アプリケーションの読み込み中にエラーが発生しました。しばらく待ってから再度お試しください。
            </p>
            <div className="space-y-2">
              <Button asChild className="w-full">
                <Link href="/privacy">プライバシーポリシー</Link>
              </Button>
              <Button asChild variant="outline" className="w-full">
                <Link href="/terms">利用規約</Link>
              </Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }
}
