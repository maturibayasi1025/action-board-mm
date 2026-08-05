import type { BusinessUnitRow } from "@/lib/admin/enps-report/comparison";
import {
  MASKED_LABEL,
  deltaToneClass,
  formatDelta,
  formatMetricNps,
  formatResponseRate,
} from "@/lib/admin/enps-report/format";

/**
 * eNPS の水準を背景色で表す。数値の並びだけでは差が読み取りにくいため。
 */
function npsToneClass(nps: number | null, masked: boolean): string {
  if (masked || nps === null) return "bg-muted/30";
  if (nps >= 30) return "bg-green-100 dark:bg-green-950";
  if (nps >= 0) return "bg-green-50 dark:bg-green-900/40";
  if (nps >= -30) return "bg-orange-50 dark:bg-orange-900/40";
  return "bg-red-100 dark:bg-red-950";
}

export function BusinessUnitHeatmap({ rows }: { rows: BusinessUnitRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        この会社に紐づく事業部のデータがありません。
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th
                scope="col"
                className="py-2.5 px-3 text-left font-medium min-w-[10rem] whitespace-nowrap"
              >
                事業部
              </th>
              <th
                scope="col"
                className="py-2.5 px-3 text-right font-medium whitespace-nowrap"
              >
                eNPS
              </th>
              <th
                scope="col"
                className="py-2.5 px-3 text-right font-medium whitespace-nowrap"
              >
                前月差
              </th>
              <th
                scope="col"
                className="py-2.5 px-3 text-right font-medium whitespace-nowrap"
              >
                回答／対象
              </th>
              <th
                scope="col"
                className="py-2.5 px-3 text-right font-medium whitespace-nowrap"
              >
                回答率
              </th>
              <th
                scope="col"
                className="py-2.5 px-3 text-right font-medium whitespace-nowrap"
              >
                推奨／中立／批判
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map(({ business_unit_name, metric }) => (
              <tr key={business_unit_name}>
                <td className="py-2 px-3 whitespace-nowrap">
                  {business_unit_name}
                </td>
                <td
                  className={`py-2 px-3 text-right font-semibold tabular-nums ${npsToneClass(
                    metric.nps_respondent_base,
                    metric.masked,
                  )}`}
                >
                  {formatMetricNps(metric)}
                </td>
                <td
                  className={`py-2 px-3 text-right tabular-nums ${deltaToneClass(
                    metric.masked ? null : metric.delta_from_previous,
                  )}`}
                >
                  {metric.masked
                    ? MASKED_LABEL
                    : formatDelta(metric.delta_from_previous)}
                </td>
                <td className="py-2 px-3 text-right tabular-nums text-muted-foreground">
                  {metric.respondent_count} / {metric.target_count}
                </td>
                <td className="py-2 px-3 text-right tabular-nums text-muted-foreground">
                  {formatResponseRate(metric.response_rate)}
                </td>
                <td className="py-2 px-3 text-right tabular-nums text-muted-foreground">
                  {metric.masked
                    ? MASKED_LABEL
                    : `${metric.promoters} / ${metric.passives} / ${metric.detractors}`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        回答者が5人未満の事業部は、個人のスコアが逆算できてしまうため{" "}
        {MASKED_LABEL} と表示し、並び順も末尾に置いています。
      </p>
    </div>
  );
}
