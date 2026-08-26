import { OfficeCheckinButton } from "@/components/office-check/office-checkin-button";
import { OfficeClosingForm } from "@/components/office-check/office-closing-form";
import {
  OfficeClosingHistory,
  type OfficeClosingHistoryItem,
} from "@/components/office-check/office-closing-history";
import { OfficePresenceList } from "@/components/office-check/office-presence-list";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { remainingUserIds } from "@/lib/office-check/remaining";
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

  const todayStart = getTodayStartJST().toISOString();

  const [
    { data: floors },
    { data: reports },
    { data: checkins },
    { data: leaves },
  ] = await Promise.all([
    supabase
      .from("office_floors")
      .select("id, name, display_order")
      .eq("is_active", true)
      .order("display_order", { ascending: true }),
    supabase
      .from("office_closing_reports")
      .select(
        `
          id,
          user_id,
          left_at,
          leave_kind,
          note,
          office_closing_report_floors (
            checked,
            office_floors ( name, display_order )
          )
        `,
      )
      .gte("left_at", todayStart)
      .order("left_at", { ascending: false })
      .limit(20),
    supabase
      .from("office_checkins")
      .select("user_id, checked_in_at")
      .gte("checked_in_at", todayStart),
    supabase
      .from("office_closing_reports")
      .select("user_id, left_at")
      .gte("left_at", todayStart),
  ]);

  const remainingIds = remainingUserIds(
    (checkins ?? []).map((row) => ({
      userId: row.user_id,
      at: row.checked_in_at,
    })),
    (leaves ?? []).map((row) => ({
      userId: row.user_id,
      at: row.left_at,
    })),
  );
  const nameUserIds = [
    ...new Set([
      ...(reports ?? []).map((report) => report.user_id),
      ...remainingIds,
    ]),
  ];
  const { data: people } =
    nameUserIds.length > 0
      ? await supabase
          .from("private_users")
          .select("id, name")
          .in("id", nameUserIds)
      : { data: [] };
  const nameById = new Map((people ?? []).map((row) => [row.id, row.name]));
  const remainingNames = remainingIds
    .map((id) => nameById.get(id) ?? "不明")
    .sort((a, b) => a.localeCompare(b, "ja"));

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
      leaveKind: report.leave_kind === "midday" ? "midday" : "final",
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
          <CardTitle>現在の在室</CardTitle>
          <CardDescription>
            入室すると在室に入ります。途中退室・最終退室の Slack
            通知にも、いま残っている人が表示されます。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <OfficePresenceList names={remainingNames} />
          <OfficeCheckinButton isPresent={remainingIds.includes(user.id)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>退室・最終チェック</CardTitle>
          <CardDescription>
            途中退室でも Slack
            に通知します。最後に帰る人は最終退室で各階チェックを入れてください。
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
        <h2 className="text-lg font-semibold">今日の退室</h2>
        <OfficeClosingHistory reports={history} />
      </section>
    </div>
  );
}
