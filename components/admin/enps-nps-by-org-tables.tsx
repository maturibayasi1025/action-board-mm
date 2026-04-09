import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { EnpsOrgNpsRow } from "@/lib/admin/enps-nps-by-business-unit";

function cellOrg(value: string): string {
  return value === "" ? "—" : value;
}

function OrgNpsTable({ rows }: { rows: EnpsOrgNpsRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        該当する回答がありません。
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            <th
              scope="col"
              className="py-2.5 px-3 text-left font-medium whitespace-nowrap"
            >
              会社
            </th>
            <th
              scope="col"
              className="py-2.5 px-3 text-left font-medium whitespace-nowrap"
            >
              事業部
            </th>
            <th
              scope="col"
              className="py-2.5 px-3 text-right font-medium tabular-nums whitespace-nowrap"
            >
              回答者数
            </th>
            <th
              scope="col"
              className="py-2.5 px-3 text-right font-medium tabular-nums whitespace-nowrap"
            >
              NPS
            </th>
            <th
              scope="col"
              className="py-2.5 px-3 text-right font-medium text-green-700 tabular-nums whitespace-nowrap"
            >
              推奨
            </th>
            <th
              scope="col"
              className="py-2.5 px-3 text-right font-medium text-yellow-700 tabular-nums whitespace-nowrap"
            >
              中立
            </th>
            <th
              scope="col"
              className="py-2.5 px-3 text-right font-medium text-red-700 tabular-nums whitespace-nowrap"
            >
              批判
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row, i) => (
            <tr
              key={`${row.company_name}\0${row.business_unit_name}\0${i}`}
              className={i % 2 === 0 ? "bg-muted/25" : ""}
            >
              <td className="py-2 px-3 align-top max-w-[12rem] truncate">
                {cellOrg(row.company_name)}
              </td>
              <td className="py-2 px-3 align-top max-w-[12rem] truncate">
                {cellOrg(row.business_unit_name)}
              </td>
              <td className="py-2 px-3 text-right tabular-nums">
                {row.respondent_count}
              </td>
              <td className="py-2 px-3 text-right font-semibold tabular-nums">
                {row.respondent_count === 0
                  ? "—"
                  : `${row.nps > 0 ? "+" : ""}${row.nps}`}
              </td>
              <td className="py-2 px-3 text-right tabular-nums text-green-700">
                {row.promoters}
              </td>
              <td className="py-2 px-3 text-right tabular-nums text-yellow-700">
                {row.passives}
              </td>
              <td className="py-2 px-3 text-right tabular-nums text-red-700">
                {row.detractors}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type QuestionMeta = { id: string; question_text: string };

export function EnpsNpsByOrgTables(props: {
  scoreQuestions: QuestionMeta[];
  rowsByQuestion: Record<string, EnpsOrgNpsRow[]>;
  variant: "on_time" | "late_only";
}) {
  const { scoreQuestions, rowsByQuestion, variant } = props;

  const hasAny = scoreQuestions.some(
    (q) => (rowsByQuestion[q.id]?.length ?? 0) > 0,
  );
  if (!hasAny) return null;

  const title =
    variant === "on_time"
      ? "事業部別 NPS（期限内）"
      : "事業部別 NPS（期限後・承認済みのみ）";

  const footnote =
    variant === "on_time"
      ? "同一ユーザー・同一質問は最新の回答1件のみを集計しています（事業部未設定は「—」行）。"
      : "同一ユーザー・同一質問は最新の回答1件のみを集計しています。";

  return (
    <div className="space-y-6">
      {scoreQuestions.map((q) => {
        const rows = rowsByQuestion[q.id] ?? [];
        if (rows.length === 0) return null;
        return (
          <Card key={`org-${variant}-${q.id}`}>
            <CardHeader>
              <CardTitle className="text-lg">{title}</CardTitle>
              <CardDescription className="text-pretty">
                {q.question_text}
              </CardDescription>
              <CardDescription className="text-xs text-muted-foreground">
                {footnote}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <OrgNpsTable rows={rows} />
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
