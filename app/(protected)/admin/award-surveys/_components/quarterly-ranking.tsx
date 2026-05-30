import type { AwardQuarterlyRankingResult } from "@/app/(protected)/admin/award-surveys/quarterly-ranking-model";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils/utils";

type QuarterlyRankingProps = {
  data: AwardQuarterlyRankingResult;
};

function rankStyle(rank: number): { label: string; className: string } {
  if (rank === 1) {
    return {
      label: "1",
      className:
        "size-8 shrink-0 rounded-full bg-amber-100 text-amber-900 ring-2 ring-amber-300/80 dark:bg-amber-950/80 dark:text-amber-100 dark:ring-amber-700",
    };
  }
  if (rank === 2) {
    return {
      label: "2",
      className:
        "size-8 shrink-0 rounded-full bg-slate-200 text-slate-800 ring-2 ring-slate-400/60 dark:bg-slate-700 dark:text-slate-100 dark:ring-slate-500",
    };
  }
  if (rank === 3) {
    return {
      label: "3",
      className:
        "size-8 shrink-0 rounded-full bg-orange-100 text-orange-900 ring-2 ring-orange-300/70 dark:bg-orange-950/80 dark:text-orange-100 dark:ring-orange-800",
    };
  }
  return {
    label: String(rank),
    className:
      "size-8 shrink-0 rounded-full bg-muted text-muted-foreground tabular-nums",
  };
}

export function QuarterlyRanking({ data }: QuarterlyRankingProps) {
  const hasAnyRows = data.groups.some((g) => g.rows.length > 0);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        対象アンケート: {data.surveyCount}件（{data.label}）
        {data.surveyCount === 0 &&
          " — この四半期の月次アンケートはまだありません"}
      </p>

      {!hasAnyRows && data.surveyCount > 0 && (
        <p className="text-sm text-muted-foreground">
          指名データがありません。
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {data.groups.map((group) => (
          <Card key={group.group}>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">{group.label}</CardTitle>
              <CardDescription>指名票数 上位5名</CardDescription>
            </CardHeader>
            <CardContent>
              {group.rows.length === 0 ? (
                <p className="text-sm text-muted-foreground">該当なし</p>
              ) : (
                <ol
                  className="space-y-2"
                  aria-label={`${group.label}のランキング`}
                >
                  {group.rows.map((row, index) => {
                    const rank = index + 1;
                    const { label, className: rankClass } = rankStyle(rank);
                    return (
                      <li
                        key={`${group.group}-${row.name}`}
                        className="flex items-center gap-3 rounded-md border border-border px-3 py-2"
                      >
                        <span
                          className={cn(
                            "flex items-center justify-center text-sm font-semibold",
                            rankClass,
                          )}
                          aria-hidden
                        >
                          {label}
                        </span>
                        <span className="min-w-0 flex-1 truncate font-medium">
                          {row.name}
                        </span>
                        <span className="shrink-0 tabular-nums text-muted-foreground">
                          {row.votes}票
                        </span>
                      </li>
                    );
                  })}
                </ol>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
