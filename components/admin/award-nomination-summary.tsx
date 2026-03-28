import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { AwardNominationDetail } from "@/lib/types/award-nomination";
import { cn } from "@/lib/utils/utils";

export type { AwardNominationDetail };

type AwardNominationSummaryProps = {
  rows: AwardNominationDetail[];
  groupOrder: string[];
  groupLabels: Record<string, string>;
};

function rankStyle(rank: number): { label: string; className: string } {
  if (rank === 1) {
    return {
      label: "1",
      className:
        "size-9 shrink-0 rounded-full bg-amber-100 text-amber-900 ring-2 ring-amber-300/80 dark:bg-amber-950/80 dark:text-amber-100 dark:ring-amber-700",
    };
  }
  if (rank === 2) {
    return {
      label: "2",
      className:
        "size-9 shrink-0 rounded-full bg-slate-200 text-slate-800 ring-2 ring-slate-400/60 dark:bg-slate-700 dark:text-slate-100 dark:ring-slate-500",
    };
  }
  if (rank === 3) {
    return {
      label: "3",
      className:
        "size-9 shrink-0 rounded-full bg-orange-100 text-orange-900 ring-2 ring-orange-300/70 dark:bg-orange-950/80 dark:text-orange-100 dark:ring-orange-800",
    };
  }
  return {
    label: String(rank),
    className:
      "size-9 shrink-0 rounded-full bg-muted text-muted-foreground tabular-nums",
  };
}

export function AwardNominationSummary({
  rows,
  groupOrder,
  groupLabels,
}: AwardNominationSummaryProps) {
  if (rows.length === 0) return null;

  const maxTotal = Math.max(...rows.map((r) => r.total), 1);

  return (
    <Card>
      <CardHeader className="space-y-2">
        <CardTitle className="text-2xl">他者指名 集計</CardTitle>
        <CardDescription className="text-base leading-relaxed">
          4つのバリューごとの「指名」回答を合算した票数です。同じ方が複数のバリューで選ばれると、その回数ぶん重複して数えます。最下段のバリューは、メンバー個人ではなくチーム名・プロジェクト名などが入ることがあります。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          棒グラフの長さは、一覧の中で最も票数が多い人を100%とした相対表示です。
        </p>

        <ul className="space-y-3" aria-label="他者指名の得票一覧">
          {rows.map((row, index) => {
            const rank = index + 1;
            const { label, className: rankClass } = rankStyle(rank);
            const barPct = (row.total / maxTotal) * 100;

            return (
              <li
                key={row.name}
                className="rounded-lg border border-border bg-card p-4 shadow-sm"
                aria-label={`${rank}位 ${row.name}、合計${row.total}票`}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                  <div
                    className="flex items-center gap-3 min-w-0 flex-1"
                    title={`${rank}位`}
                  >
                    <span
                      className={cn(
                        "flex items-center justify-center text-sm font-bold tabular-nums",
                        rankClass,
                      )}
                    >
                      {label}
                    </span>
                    <span className="min-w-0 break-words text-base font-semibold leading-snug sm:text-lg">
                      {row.name}
                    </span>
                  </div>

                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <div
                      className="h-2.5 w-full overflow-hidden rounded-full bg-muted"
                      role="presentation"
                      aria-hidden
                    >
                      <div
                        className="h-full rounded-full bg-primary transition-[width] duration-300"
                        style={{ width: `${barPct}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex shrink-0 justify-end sm:justify-start">
                    <Badge
                      variant="secondary"
                      className="tabular-nums px-3 py-1 text-sm font-semibold"
                    >
                      計 {row.total} 票
                    </Badge>
                  </div>
                </div>

                <dl className="mt-4 grid gap-2 border-t border-border/80 pt-3 sm:grid-cols-2 lg:grid-cols-4">
                  {groupOrder.map((group) => {
                    const count = row.byGroup[group] ?? 0;
                    const gLabel = groupLabels[group] ?? group;
                    return (
                      <div
                        key={group}
                        className="flex items-center justify-between gap-2 rounded-md bg-muted/50 px-2.5 py-1.5 text-xs sm:flex-col sm:items-stretch sm:gap-1"
                      >
                        <dt className="font-medium leading-tight text-muted-foreground">
                          {gLabel}
                        </dt>
                        <dd className="text-right font-semibold tabular-nums text-foreground sm:text-left">
                          {count > 0 ? `${count} 票` : "—"}
                        </dd>
                      </div>
                    );
                  })}
                </dl>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
