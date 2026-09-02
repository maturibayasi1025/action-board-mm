import { QuarterlyRankingComments } from "@/app/(protected)/admin/award-surveys/_components/quarterly-ranking-comments";
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

function competitionRanks(votes: number[]): number[] {
  const ranks: number[] = [];
  for (let index = 0; index < votes.length; index += 1) {
    if (index > 0 && votes[index] === votes[index - 1]) {
      ranks.push(ranks[index - 1]);
    } else {
      ranks.push(index + 1);
    }
  }
  return ranks;
}

export function QuarterlyRanking({ data }: QuarterlyRankingProps) {
  const hasAnyRows = data.groups.some((g) => g.rows.length > 0);
  const hasIntegrityIssue =
    data.missingYearMonths.length > 0 ||
    data.responseCountMismatch ||
    data.rankingBlocked ||
    !data.checksumOk ||
    !data.monthlyCrossCheckOk ||
    data.unmatchedVoteCount > 0;
  const showRanking = !data.rankingBlocked;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        対象アンケート: {data.surveyCount}/{data.expectedSurveyCount}件（
        {data.label}）
        {data.surveyCount === 0 &&
          " — この四半期の月次アンケートはまだありません"}
      </p>

      {data.rankingBlocked && data.rankingBlockedReason && (
        <div
          className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-950 dark:border-red-800 dark:bg-red-950/40 dark:text-red-100"
          role="alert"
        >
          <p className="font-medium">集計結果を表示できません</p>
          <p className="mt-1">{data.rankingBlockedReason}</p>
        </div>
      )}

      {data.surveyCount > 0 && (
        <QuarterlyIntegrityPanel
          data={data}
          warning={hasIntegrityIssue}
          blocked={data.rankingBlocked}
        />
      )}

      {showRanking && !hasAnyRows && data.surveyCount > 0 && (
        <p className="text-sm text-muted-foreground">
          指名データがありません。
        </p>
      )}

      {showRanking && (
        <div className="grid gap-4 md:grid-cols-2">
          {data.groups.map((group) => {
            const ranks = competitionRanks(group.rows.map((row) => row.votes));
            return (
              <Card key={group.group}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">{group.label}</CardTitle>
                  <CardDescription>
                    指名票数
                    上位5名（同票は同順位。期限内・期限後を含む）。コメントは閉じてあり、押すと開きます。
                  </CardDescription>
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
                        const rank = ranks[index];
                        const { label, className: rankClass } = rankStyle(rank);
                        return (
                          <li
                            key={`${group.group}-${row.key}`}
                            className="rounded-md border border-border px-3 py-2"
                          >
                            <div className="flex items-center gap-3">
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
                                {row.unmatched ? (
                                  <span className="ml-2 text-xs font-normal text-amber-700 dark:text-amber-300">
                                    未突合
                                  </span>
                                ) : null}
                              </span>
                              <span className="shrink-0 tabular-nums text-muted-foreground">
                                {row.votes}票
                              </span>
                            </div>
                            <p className="mt-1 pl-11 text-xs text-muted-foreground">
                              期限内 {row.onTimeVotes} / 期限後 {row.lateVotes}
                              {data.months.length > 0
                                ? ` ・ ${data.months
                                    .map(
                                      (month) =>
                                        `${month.yearMonth.slice(5)}月 ${row.votesByMonth[month.yearMonth] ?? 0}`,
                                    )
                                    .join(" / ")}`
                                : ""}
                            </p>
                            <QuarterlyRankingComments
                              comments={row.comments}
                              nomineeName={row.name}
                            />
                          </li>
                        );
                      })}
                    </ol>
                  )}
                  {group.totalVotes > 0 && (
                    <p className="mt-3 text-xs text-muted-foreground">
                      このバリューの指名票合計: {group.totalVotes}票
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function QuarterlyIntegrityPanel({
  data,
  warning,
  blocked,
}: {
  data: AwardQuarterlyRankingResult;
  warning: boolean;
  blocked: boolean;
}) {
  return (
    <div
      className={cn(
        "space-y-3 rounded-md border px-4 py-3 text-sm",
        blocked
          ? "border-red-300 bg-red-50 text-red-950 dark:border-red-800 dark:bg-red-950/40 dark:text-red-100"
          : warning
            ? "border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
            : "border-border bg-muted/40",
      )}
    >
      <p className="font-medium">
        {blocked
          ? data.responseCountMismatch
            ? "集計の検算（ランキングは件数不一致のため非表示）"
            : "集計の検算（ランキングは取得失敗のため非表示）"
          : "集計の検算（月次と突き合わせてください）"}
      </p>
      <ul className="list-disc space-y-1 pl-5 text-muted-foreground dark:text-current/80">
        <li>
          回答行数: 取得 {data.responseRowCount}件
          {data.dbResponseCount != null
            ? ` / DB件数 ${data.dbResponseCount}件`
            : ""}
          {data.responseCountMismatch
            ? " — 件数が一致しません。集計結果は表示しません"
            : " — 一致"}
        </li>
        <li>
          指名票: 四半期合計 {data.nominationVoteCount}票 = 月次内訳合計{" "}
          {data.monthlyNominationSum}票
          {data.checksumOk ? " — 検算OK" : " — 検算不一致"}
        </li>
        <li>
          月次3カ月分の再取得:{" "}
          {data.independentMonthlyRowCount != null
            ? `回答 ${data.independentMonthlyRowCount}件 / 指名票 ${data.independentMonthlyNominationSum ?? 0}票`
            : data.monthlyCrossCheckWarning
              ? "再取得失敗"
              : "照合なし"}
          {data.independentMonthlyRowCount != null && data.monthlyCrossCheckOk
            ? " — 四半期と一致"
            : data.monthlyCrossCheckWarning
              ? ` — 警告: ${data.monthlyCrossCheckWarning}`
              : ""}
        </li>
        <li>
          期限内 {data.onTimeNominationVoteCount}票 / 期限後{" "}
          {data.lateNominationVoteCount}票（四半期ランキングは両方を含みます）
        </li>
        <li>
          未突合票: {data.unmatchedVoteCount}票
          {data.unmatchedVoteCount > 0
            ? " — 氏名の手入力や停止ユーザーなど、メンバーIDに結びつかない票です"
            : ""}
        </li>
        {data.missingYearMonths.length > 0 && (
          <li>欠けている月: {data.missingYearMonths.join("、")}</li>
        )}
      </ul>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[32rem] text-left text-xs">
          <caption className="sr-only">月次内訳</caption>
          <thead>
            <tr className="border-b border-border">
              <th className="py-1 pr-3 font-medium">対象月</th>
              <th className="py-1 pr-3 font-medium">アンケート</th>
              <th className="py-1 pr-3 font-medium tabular-nums">回答者</th>
              <th className="py-1 pr-3 font-medium tabular-nums">指名票</th>
              <th className="py-1 pr-3 font-medium tabular-nums">期限内</th>
              <th className="py-1 font-medium tabular-nums">期限後</th>
            </tr>
          </thead>
          <tbody>
            {data.months.map((month) => (
              <tr key={month.yearMonth} className="border-b border-border/60">
                <td className="py-1 pr-3 tabular-nums">{month.yearMonth}</td>
                <td className="py-1 pr-3">{month.surveyTitle ?? "未作成"}</td>
                <td className="py-1 pr-3 tabular-nums">
                  {month.surveyId ? month.uniqueResponderCount : "—"}
                </td>
                <td className="py-1 pr-3 tabular-nums">
                  {month.surveyId ? month.nominationVoteCount : "—"}
                </td>
                <td className="py-1 pr-3 tabular-nums">
                  {month.surveyId ? month.onTimeNominationVoteCount : "—"}
                </td>
                <td className="py-1 tabular-nums">
                  {month.surveyId ? month.lateNominationVoteCount : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground dark:text-current/70">
        各月の「集計を見る」の指名票（期限内＋期限後）を足すと、上の月次合計と一致するはずです。
      </p>
    </div>
  );
}
