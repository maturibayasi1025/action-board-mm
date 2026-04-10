function isNewer(a: string, b: string): boolean {
  return new Date(a).getTime() > new Date(b).getTime();
}

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
  const byUser = new Map<string, ResponseRowForDedupe>();
  for (const r of rows) {
    const prev = byUser.get(r.user_id);
    if (!prev || isNewer(r.created_at, prev.created_at)) {
      byUser.set(r.user_id, r);
    }
  }
  return Array.from(byUser.values()).map((r) => r.score_value);
}

export function computeNpsBreakdownFromScores(scores: number[]): {
  respondent_count: number;
  promoters: number;
  passives: number;
  detractors: number;
  nps: number | null;
} {
  const respondent_count = scores.length;
  if (respondent_count === 0) {
    return {
      respondent_count: 0,
      promoters: 0,
      passives: 0,
      detractors: 0,
      nps: null,
    };
  }
  const promoters = scores.filter((s) => s >= 9).length;
  const passives = scores.filter((s) => s >= 7 && s < 9).length;
  const detractors = scores.filter((s) => s < 7).length;
  const nps = Math.round(((promoters - detractors) / respondent_count) * 100);
  return {
    respondent_count,
    promoters,
    passives,
    detractors,
    nps,
  };
}
