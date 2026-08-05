/**
 * eNPS のスコア判定と NPS 算出の唯一の実装。
 * 集計を行うモジュールは必ずここを経由し、セグメント境界や 0 人時の扱いを揃える。
 */

export const PROMOTER_MIN_SCORE = 9;
export const PASSIVE_MIN_SCORE = 7;

export type NpsSegment = "promoter" | "passive" | "detractor";

export type NpsBreakdown = {
  respondent_count: number;
  promoters: number;
  passives: number;
  detractors: number;
  /** 回答者が 0 人のときは NULL。0 と区別できないと「中立で良好」に見えてしまう */
  nps: number | null;
};

export function scoreToSegment(score: number): NpsSegment {
  if (score >= PROMOTER_MIN_SCORE) return "promoter";
  if (score >= PASSIVE_MIN_SCORE) return "passive";
  return "detractor";
}

export function computeNps(scores: number[]): NpsBreakdown {
  let promoters = 0;
  let passives = 0;
  let detractors = 0;

  for (const score of scores) {
    switch (scoreToSegment(score)) {
      case "promoter":
        promoters += 1;
        break;
      case "passive":
        passives += 1;
        break;
      case "detractor":
        detractors += 1;
        break;
    }
  }

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

  return {
    respondent_count,
    promoters,
    passives,
    detractors,
    nps: Math.round(((promoters - detractors) / respondent_count) * 100),
  };
}

export type UserTimestampedRow = { user_id: string; created_at: string };

/**
 * 同一ユーザーの複数行から created_at が最新の 1 件だけを残す。
 * 回答の再送信（RPC は毎回 DELETE→INSERT する）で行が増えても二重計上しないための共通処理。
 */
export function dedupeLatestByUser<T extends UserTimestampedRow>(
  rows: T[],
): T[] {
  const byUser = new Map<string, T>();
  for (const row of rows) {
    const prev = byUser.get(row.user_id);
    if (
      !prev ||
      new Date(row.created_at).getTime() > new Date(prev.created_at).getTime()
    ) {
      byUser.set(row.user_id, row);
    }
  }
  return Array.from(byUser.values());
}

/** 回答率。対象者が 0 人なら NULL */
export function computeResponseRate(
  respondentCount: number,
  targetCount: number,
): number | null {
  if (targetCount <= 0) return null;
  return Math.round((respondentCount / targetCount) * 1000) / 10;
}
