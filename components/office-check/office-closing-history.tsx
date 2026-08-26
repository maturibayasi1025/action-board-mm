import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatJstDateTime } from "@/lib/office-check/left-at";

export type OfficeClosingHistoryItem = {
  id: string;
  reporterName: string;
  leftAt: string;
  leaveKind: "midday" | "final";
  note: string | null;
  floors: { name: string; checked: boolean }[];
};

type Props = {
  reports: OfficeClosingHistoryItem[];
};

function leaveKindLabel(kind: OfficeClosingHistoryItem["leaveKind"]): string {
  switch (kind) {
    case "midday":
      return "途中退室";
    case "final":
      return "最終退室";
    default: {
      const exhaustive: never = kind;
      return exhaustive;
    }
  }
}

export function OfficeClosingHistory({ reports }: Props) {
  if (reports.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        今日の退室報告はまだありません。
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {reports.map((report) => (
        <Card key={report.id}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              {report.reporterName} ・ {leaveKindLabel(report.leaveKind)}{" "}
              {formatJstDateTime(new Date(report.leftAt))}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {report.leaveKind === "final" && report.floors.length > 0 ? (
              <ul className="flex flex-wrap gap-3">
                {report.floors.map((floor) => (
                  <li key={floor.name}>
                    {floor.name}: {floor.checked ? "済" : "未"}
                  </li>
                ))}
              </ul>
            ) : null}
            {report.note ? (
              <p className="text-muted-foreground">備考: {report.note}</p>
            ) : null}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
