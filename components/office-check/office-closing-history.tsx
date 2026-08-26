import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatJstDateTime } from "@/lib/office-check/left-at";

export type OfficeClosingHistoryItem = {
  id: string;
  reporterName: string;
  leftAt: string;
  note: string | null;
  floors: { name: string; checked: boolean }[];
};

type Props = {
  reports: OfficeClosingHistoryItem[];
};

export function OfficeClosingHistory({ reports }: Props) {
  if (reports.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        今日の最終チェックはまだありません。
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {reports.map((report) => (
        <Card key={report.id}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              {report.reporterName} ・ 退室{" "}
              {formatJstDateTime(new Date(report.leftAt))}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <ul className="flex flex-wrap gap-3">
              {report.floors.map((floor) => (
                <li key={floor.name}>
                  {floor.name}: {floor.checked ? "済" : "未"}
                </li>
              ))}
            </ul>
            {report.note ? (
              <p className="text-muted-foreground">備考: {report.note}</p>
            ) : null}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
