import { StatisticsDashboard } from "@/components/admin/statistics-dashboard";
import { isOwner } from "@/lib/utils/isOwner";
import { redirect } from "next/navigation";
import { getStatisticsDashboardData } from "./actions";

export const runtime = "edge";

export default async function AdminStatisticsPage() {
  const owner = await isOwner();
  if (!owner) {
    redirect("/");
  }

  const data = await getStatisticsDashboardData("last30d");

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-6xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">統計ダッシュボード</h1>
          <p className="text-muted-foreground">
            グッジョブ活動、eNPS、表彰アンケートのサマリーをまとめて確認できます。詳細は各管理画面へリンクします。
          </p>
        </div>

        <StatisticsDashboard initial={data} />
      </div>
    </div>
  );
}
