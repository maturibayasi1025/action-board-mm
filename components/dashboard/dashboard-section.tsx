import { DashboardPeriodToggle } from "@/components/dashboard/dashboard-period-toggle";
import { LikesChart } from "@/components/dashboard/likes-chart";
import { MissionsChart } from "@/components/dashboard/missions-chart";
import { SummaryCards } from "@/components/dashboard/summary-cards";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type DashboardPeriod,
  getDashboardData,
} from "@/lib/services/dashboard";

interface DashboardSectionProps {
  period: DashboardPeriod;
}

export async function DashboardSection({ period }: DashboardSectionProps) {
  const dashboardData = await getDashboardData(period);

  return (
    <section
      id="dashboard"
      className="w-full min-w-0 max-w-full bg-slate-50 py-12 md:py-16"
      aria-labelledby="dashboard-heading"
    >
      <div className="mx-auto w-full min-w-0 max-w-6xl space-y-6 px-4">
        <header className="min-w-0 space-y-3 text-center">
          <h2 id="dashboard-heading" className="text-2xl font-bold md:text-3xl">
            アクションボード ダッシュボード
          </h2>
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

        <div className="grid min-w-0 gap-4 lg:grid-cols-2">
          <Card className="min-w-0 bg-white">
            <CardHeader>
              <CardTitle>グッジョブ投稿数（日次）</CardTitle>
            </CardHeader>
            <CardContent className="min-w-0 max-w-full">
              <MissionsChart
                data={dashboardData.missionCounts}
                period={period}
              />
            </CardContent>
          </Card>

          <Card className="min-w-0 bg-white">
            <CardHeader>
              <CardTitle>いいね数（日次）</CardTitle>
            </CardHeader>
            <CardContent className="min-w-0 max-w-full">
              <LikesChart data={dashboardData.likesCounts} period={period} />
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
