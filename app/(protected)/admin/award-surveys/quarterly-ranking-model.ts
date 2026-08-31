import {
  type MvvAwardQuarter,
  formatAwardQuarterPeriodLabel,
  getAwardQuarterYearMonthKeys,
  getFiscalYearAndQuarterFromMonth,
} from "@/lib/types/badge";

export type AwardQuarter = MvvAwardQuarter;

export type AwardQuarterOption = {
  /** Q1 の年度（3月を含む年） */
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

export function fiscalYearAndQuarterFromYearMonth(
  year: number,
  month: number,
): { fiscalYear: number; quarter: AwardQuarter } {
  return getFiscalYearAndQuarterFromMonth(year, month);
}

export function getMonthsForQuarter(quarter: AwardQuarter): number[] {
  return getAwardQuarterYearMonthKeys(2000, quarter).map((key) =>
    Number(key.slice(5)),
  );
}

export function formatQuarterLabel(
  fiscalYear: number,
  quarter: AwardQuarter,
): string {
  return formatAwardQuarterPeriodLabel(fiscalYear, quarter);
}

export function yearMonthKeysForQuarter(
  fiscalYear: number,
  quarter: AwardQuarter,
): string[] {
  return getAwardQuarterYearMonthKeys(fiscalYear, quarter);
}

export function quarterKey(fiscalYear: number, quarter: AwardQuarter): string {
  return `${fiscalYear}-Q${quarter}`;
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
