/**
 * レポート表示の共通フォーマット。サーバー・クライアントの両方から使う。
 */

import type { QuestionMetric } from "@/lib/admin/enps-report/comparison";

export const MASKED_LABEL = "n<5";
export const EMPTY_LABEL = "—";

export function formatNps(nps: number | null): string {
  if (nps === null) return EMPTY_LABEL;
  return `${nps > 0 ? "+" : ""}${nps}`;
}

export function formatDelta(delta: number | null): string {
  if (delta === null) return EMPTY_LABEL;
  if (delta === 0) return "±0";
  return `${delta > 0 ? "+" : ""}${delta}`;
}

export function formatResponseRate(rate: number | null): string {
  if (rate === null) return EMPTY_LABEL;
  return `${rate}%`;
}

/**
 * 回答者が少ないバケットは数値を伏せる。owner 限定の画面でも、
 * 少人数の事業部では個人のスコアが逆算できてしまうため。
 */
export function formatMetricNps(metric: QuestionMetric | undefined): string {
  if (!metric) return EMPTY_LABEL;
  if (metric.masked) return MASKED_LABEL;
  return formatNps(metric.nps_respondent_base);
}

export function formatMetricDelta(metric: QuestionMetric | undefined): string {
  if (!metric || metric.masked) return EMPTY_LABEL;
  return formatDelta(metric.delta_from_previous);
}

export function deltaToneClass(delta: number | null): string {
  if (delta === null || delta === 0) return "text-muted-foreground";
  return delta > 0 ? "text-green-700" : "text-red-700";
}

/**
 * グループ平均との乖離。レポートでは「どの会社が全体から外れているか」が起点になる。
 */
export function gapToneClass(gap: number | null): string {
  if (gap === null) return "text-muted-foreground";
  if (gap >= 10) return "text-green-700";
  if (gap <= -10) return "text-red-700";
  return "text-muted-foreground";
}
