import { Card, CardContent } from "@/components/ui/card";
import type { QuestionMetric } from "@/lib/admin/enps-report/comparison";
import {
  EMPTY_LABEL,
  deltaToneClass,
  formatDelta,
  formatNps,
  formatResponseRate,
  gapToneClass,
} from "@/lib/admin/enps-report/format";

function SummaryTile({
  label,
  value,
  sub,
  valueClassName,
}: {
  label: string;
  value: string;
  sub?: string;
  valueClassName?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-6 text-center space-y-1">
        <div
          className={`text-3xl font-bold tabular-nums ${valueClassName ?? ""}`}
        >
          {value}
        </div>
        <p className="text-sm text-muted-foreground">{label}</p>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}

/**
 * 主指標は回答者ベース。未回答0点補完は回答率の影響を強く受けるため、補助として併記する。
 */
export function CompanyReportSummary({
  metric,
  previousYearMonth,
}: {
  metric: QuestionMetric | undefined;
  previousYearMonth: string | null;
}) {
  if (!metric) {
    return (
      <p className="text-sm text-muted-foreground">
        選択したスコア質問のデータがありません。
      </p>
    );
  }

  if (metric.masked) {
    return (
      <div className="rounded-md border border-border bg-muted/20 p-6">
        <p className="text-sm text-muted-foreground">
          回答者が5人未満のため、個人特定を避けるためデータを表示していません。
        </p>
        <p className="text-xs text-muted-foreground mt-2">
          対象者数: {metric.target_count}人
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <SummaryTile
        label="eNPS（回答者ベース）"
        value={formatNps(metric.nps_respondent_base)}
        sub={`推奨 ${metric.promoters} / 中立 ${metric.passives} / 批判 ${metric.detractors}`}
      />
      <SummaryTile
        label="前月差"
        value={formatDelta(metric.delta_from_previous)}
        sub={
          previousYearMonth
            ? `${previousYearMonth} との比較`
            : "比較できる前月がありません"
        }
        valueClassName={deltaToneClass(metric.delta_from_previous)}
      />
      <SummaryTile
        label="グループ全体との差"
        value={formatDelta(metric.delta_from_group)}
        sub="同じ月・同じ設問での比較"
        valueClassName={gapToneClass(metric.delta_from_group)}
      />
      <SummaryTile
        label="回答率"
        value={formatResponseRate(metric.response_rate)}
        sub={`回答 ${metric.respondent_count} 人 / 対象 ${metric.target_count} 人`}
      />
      <Card className="sm:col-span-2 lg:col-span-4">
        <CardContent className="pt-6 flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <p className="text-sm font-medium">
              参考: 未回答を0点として補完した eNPS
            </p>
            <p className="text-xs text-muted-foreground">
              未回答者を批判者として算入した値です。回答率が下がるほど低く出るため、施策の効果を見るときは回答者ベースと合わせて読んでください。
            </p>
          </div>
          <div className="text-2xl font-bold tabular-nums">
            {metric.nps_imputed_base === null
              ? EMPTY_LABEL
              : formatNps(metric.nps_imputed_base)}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
