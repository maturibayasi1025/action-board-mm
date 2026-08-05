import {
  type NpsBreakdown,
  computeNps,
  dedupeLatestByUser,
} from "@/lib/admin/enps-report/nps";

export type ResponseRowForDedupe = {
  user_id: string;
  score_value: number;
  created_at: string;
};

/**
 * 同一アンケート内でユーザーごとに最新のスコアのみ残す。
 */
export function dedupeLatestScorePerUser(
  rows: ResponseRowForDedupe[],
): number[] {
  return dedupeLatestByUser(rows).map((r) => r.score_value);
}

export function computeNpsBreakdownFromScores(scores: number[]): NpsBreakdown {
  return computeNps(scores);
}
