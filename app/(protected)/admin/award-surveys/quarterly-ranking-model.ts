export type AwardQuarter = 1 | 2 | 3 | 4;

export type AwardQuarterOption = {
  year: number;
  quarter: AwardQuarter;
  label: string;
};

export type AwardQuarterRankingRow = {
  name: string;
  votes: number;
};

export type AwardQuarterGroupRanking = {
  group: string;
  label: string;
  rows: AwardQuarterRankingRow[];
};

export type AwardQuarterlyRankingResult = {
  year: number;
  quarter: AwardQuarter;
  label: string;
  surveyCount: number;
  groups: AwardQuarterGroupRanking[];
};

export const AWARD_QUESTION_GROUP_ORDER = [
  "passionate_execution",
  "supreme_relations",
  "happiness_cycle",
  "team_value",
] as const;

export const AWARD_QUESTION_GROUP_LABELS: Record<string, string> = {
  passionate_execution: "夢中になってやり切る",
  supreme_relations: "至高な人間関係を",
  happiness_cycle: "幸せの循環",
  team_value: "チーム/組織のバリュー体現",
};

const QUARTER_MONTH_RANGES: Record<AwardQuarter, [number, number, number]> = {
  1: [1, 2, 3],
  2: [4, 5, 6],
  3: [7, 8, 9],
  4: [10, 11, 12],
};

export function monthToQuarter(month: number): AwardQuarter {
  if (month >= 1 && month <= 3) return 1;
  if (month >= 4 && month <= 6) return 2;
  if (month >= 7 && month <= 9) return 3;
  return 4;
}

export function getMonthsForQuarter(quarter: AwardQuarter): number[] {
  return [...QUARTER_MONTH_RANGES[quarter]];
}

export function formatQuarterLabel(
  year: number,
  quarter: AwardQuarter,
): string {
  const months = QUARTER_MONTH_RANGES[quarter];
  return `${year}年 ${months[0]}–${months[2]}月`;
}

export function yearMonthKeysForQuarter(
  year: number,
  quarter: AwardQuarter,
): string[] {
  return getMonthsForQuarter(quarter).map(
    (m) => `${year}-${String(m).padStart(2, "0")}`,
  );
}

export function quarterKey(year: number, quarter: AwardQuarter): string {
  return `${year}-Q${quarter}`;
}

export function parseQuarterKey(
  key: string,
): { year: number; quarter: AwardQuarter } | null {
  const match = /^(\d{4})-Q([1-4])$/.exec(key);
  if (!match) return null;
  const year = Number(match[1]);
  const quarter = Number(match[2]) as AwardQuarter;
  if (!Number.isFinite(year)) return null;
  return { year, quarter };
}

export function parseYearMonth(
  yearMonth: string,
): { year: number; month: number } | null {
  const match = /^(\d{4})-(\d{2})$/.exec(yearMonth);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isFinite(year) || month < 1 || month > 12) return null;
  return { year, month };
}
