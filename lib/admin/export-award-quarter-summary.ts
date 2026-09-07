import {
  NOMINATION_GROUP_ORDER,
  type NominationGroupKey,
  type PeerReceivedRow,
  emptyCommentsByGroup,
  emptyVotesByGroup,
  receivedCommentColumnLabel,
  voteColumnLabel,
} from "@/lib/admin/export-award-peer-received";
import {
  VALUE_ORDER,
  buildCsvContent,
} from "@/lib/admin/export-award-self-eval";
import type { AwardSelfEvalPersonRow } from "@/lib/admin/export-award-self-eval-data";

export type AwardQuarterSummaryRow = {
  key: string;
  name: string;
  companyName: string;
  businessUnitName: string;
  selfEval: AwardSelfEvalPersonRow | null;
  received: PeerReceivedRow | null;
  totalVotes: number;
};

function selfEvalKey(row: AwardSelfEvalPersonRow): string {
  return `uid:${row.userId}`;
}

export function mergeAwardQuarterSummaryRows(
  selfEvalRows: AwardSelfEvalPersonRow[],
  receivedRows: PeerReceivedRow[],
): AwardQuarterSummaryRow[] {
  const byKey = new Map<string, AwardQuarterSummaryRow>();

  for (const row of selfEvalRows) {
    const key = selfEvalKey(row);
    byKey.set(key, {
      key,
      name: row.name,
      companyName: row.companyName,
      businessUnitName: row.businessUnitName,
      selfEval: row,
      received: null,
      totalVotes: 0,
    });
  }

  for (const row of receivedRows) {
    const existing = byKey.get(row.nomineeKey);
    if (existing) {
      existing.received = row;
      existing.totalVotes = row.totalVotes;
      if (!existing.companyName) existing.companyName = row.companyName;
      if (!existing.businessUnitName) {
        existing.businessUnitName = row.businessUnitName;
      }
      if (existing.name === "不明" && row.name) {
        existing.name = row.name;
      }
      continue;
    }
    byKey.set(row.nomineeKey, {
      key: row.nomineeKey,
      name: row.name,
      companyName: row.companyName,
      businessUnitName: row.businessUnitName,
      selfEval: null,
      received: row,
      totalVotes: row.totalVotes,
    });
  }

  return Array.from(byKey.values()).sort((a, b) => {
    if (a.totalVotes !== b.totalVotes) return b.totalVotes - a.totalVotes;
    return a.name.localeCompare(b.name, "ja");
  });
}

function selfEvalColumnLabel(valueKey: (typeof VALUE_ORDER)[number]): string {
  switch (valueKey) {
    case "passionate_execution":
      return "夢中になってやり切る（自己評価）";
    case "supreme_relations":
      return "至高な人間関係を（自己評価）";
    case "happiness_cycle":
      return "幸せの循環（自己評価）";
    default: {
      const _exhaustive: never = valueKey;
      return _exhaustive;
    }
  }
}

function votesOf(
  row: AwardQuarterSummaryRow,
  group: NominationGroupKey,
): number {
  return row.received?.votesByGroup[group] ?? emptyVotesByGroup()[group];
}

function commentsOf(
  row: AwardQuarterSummaryRow,
  group: NominationGroupKey,
): string {
  return row.received?.commentsByGroup[group] ?? emptyCommentsByGroup()[group];
}

export function buildAwardQuarterSummaryCsvContent(
  rows: AwardQuarterSummaryRow[],
): string {
  const headers = [
    "氏名",
    "会社",
    "部署",
    ...VALUE_ORDER.map((key) => selfEvalColumnLabel(key)),
    "総票数",
    ...NOMINATION_GROUP_ORDER.map((group) => voteColumnLabel(group)),
    ...NOMINATION_GROUP_ORDER.map((group) => receivedCommentColumnLabel(group)),
  ];

  const dataRows = rows.map((row) => [
    row.name,
    row.companyName,
    row.businessUnitName,
    ...VALUE_ORDER.map((key) => row.selfEval?.valueCells[key] ?? ""),
    String(row.totalVotes),
    ...NOMINATION_GROUP_ORDER.map((group) => String(votesOf(row, group))),
    ...NOMINATION_GROUP_ORDER.map((group) => commentsOf(row, group)),
  ]);

  return buildCsvContent(headers, dataRows);
}
