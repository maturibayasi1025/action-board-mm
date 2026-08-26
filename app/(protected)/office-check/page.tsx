import { OfficeClosingForm } from "@/components/office-check/office-closing-form";
import {
  OfficeClosingHistory,
  type OfficeClosingHistoryItem,
} from "@/components/office-check/office-closing-history";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { getTodayStartJST } from "@/lib/utils/date-timezone";
import { redirect } from "next/navigation";

export const runtime = "edge";

type FloorRef = { name: string; display_order: number };

type FloorCheckRow = {
  checked: boolean;
  office_floors: FloorRef | FloorRef[] | null;
};

function unwrapFloor(value: FloorCheckRow["office_floors"]): FloorRef | null {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

export default async function OfficeCheckPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(
      `/sign-in?message=${encodeURIComponent("最終チェックにはログインが必要です")}`,
    );
  }

  const { data: floors } = await supabase
    .from("office_floors")
    .select("id, name, display_order")
    .eq("is_active", true)
    .order("display_order", { ascending: true });

  const todayStart = getTodayStartJST().toISOString();
  const { data: reports } = await supabase
    .from("office_closing_reports")
    .select(
      `
      id,
      user_id,
      left_at,
      note,
      office_closing_report_floors (
        checked,
        office_floors ( name, display_order )
      )
    `,
    )
    .gte("left_at", todayStart)
    .order("left_at", { ascending: false })
    .limit(20);

  const userIds = [...new Set((reports ?? []).map((report) => report.user_id))];
  const { data: reporters } =
    userIds.length > 0
      ? await supabase
          .from("private_users")
          .select("id, name")
          .in("id", userIds)
      : { data: [] };
  const nameById = new Map((reporters ?? []).map((row) => [row.id, row.name]));

  const history: OfficeClosingHistoryItem[] = (reports ?? []).map((report) => {
    const floorRows = (report.office_closing_report_floors ??
      []) as FloorCheckRow[];
    const sortedFloors = [...floorRows].sort((a, b) => {
      const orderA = unwrapFloor(a.office_floors)?.display_order ?? 0;
      const orderB = unwrapFloor(b.office_floors)?.display_order ?? 0;
      return orderA - orderB;
    });
    return {
      id: report.id,
      reporterName: nameById.get(report.user_id) ?? "不明",
      leftAt: report.left_at,
      note: report.note,
      floors: sortedFloors.map((row) => ({
        name: unwrapFloor(row.office_floors)?.name ?? "不明",
        checked: row.checked,
      })),
    };
  });

  return (
    <div className="container mx-auto max-w-2xl space-y-8 py-8">
      <Card>
        <CardHeader>
          <CardTitle>各階の最終チェック</CardTitle>
          <CardDescription>
            最終退室時に各階のチェックと退室時間を記録します。送信すると Slack
            に通知されます。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <OfficeClosingForm
            floors={(floors ?? []).map((floor) => ({
              id: floor.id,
              name: floor.name,
            }))}
          />
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">今日の報告</h2>
        <OfficeClosingHistory reports={history} />
      </section>
    </div>
  );
}
