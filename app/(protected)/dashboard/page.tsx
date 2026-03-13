import { DashboardPeriodToggle } from "@/components/dashboard/dashboard-period-toggle";
import { LikesChart } from "@/components/dashboard/likes-chart";
import { MissionsChart } from "@/components/dashboard/missions-chart";
import { SummaryCards } from "@/components/dashboard/summary-cards";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type DashboardPeriod,
  getDashboardData,
} from "@/lib/services/dashboard";

export const runtime = "edge";

interface DashboardPageProps {
  searchParams: Promise<{
    period?: string;
  }>;
}

function resolvePeriod(period?: string): DashboardPeriod {
  return period === "monthly" ? "monthly" : "weekly";
}

export default async function DashboardPage({
  searchParams,
}: DashboardPageProps) {
  const params = await searchParams;
  const period = resolvePeriod(params.period);
  const dashboardData = await getDashboardData(period);

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 py-4">
      <div className="mx-auto w-full max-w-6xl space-y-6 px-4">
        <header className="space-y-3 text-center">
          <h1 className="text-2xl font-bold md:text-3xl">
            アクションボード ダッシュボード
          </h1>
          <p className="text-sm text-muted-foreground md:text-base">
            ユーザーグッジョブの投稿数といいね数を、日次推移で確認できます。
          </p>
          <DashboardPeriodToggle defaultPeriod={period} />
        </header>

        <SummaryCards
          totalMissions={dashboardData.summary.totalMissions}
          totalLikes={dashboardData.summary.totalLikes}
          previousPeriodMissions={dashboardData.summary.previousPeriodMissions}
          previousPeriodLikes={dashboardData.summary.previousPeriodLikes}
        />

        <section className="grid gap-4 lg:grid-cols-2">
          <Card className="bg-white">
            <CardHeader>
              <CardTitle>グッジョブ投稿数（日次）</CardTitle>
            </CardHeader>
            <CardContent>
              <MissionsChart
                data={dashboardData.missionCounts}
                period={period}
              />
            </CardContent>
          </Card>

          <Card className="bg-white">
            <CardHeader>
              <CardTitle>いいね数（日次）</CardTitle>
            </CardHeader>
            <CardContent>
              <LikesChart data={dashboardData.likesCounts} period={period} />
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}
