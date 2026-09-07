import { collectAwardPeerReceivedData } from "@/lib/admin/export-award-peer-received-data";
import {
  buildAwardQuarterSummaryCsvContent,
  mergeAwardQuarterSummaryRows,
} from "@/lib/admin/export-award-quarter-summary";
import { collectAwardSelfEvalData } from "@/lib/admin/export-award-self-eval-data";
import type { Database } from "@/lib/types/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

export type AwardQuarterSummaryExportResult = {
  csvContent: string;
  filename: string;
  personCount: number;
  selfEvalCount: number;
  nomineeCount: number;
  targetYearMonths: string[];
};

export async function buildAwardQuarterSummaryCsv(
  supabase: SupabaseClient<Database>,
  yearMonths: string[],
  filenameLabel: string,
): Promise<AwardQuarterSummaryExportResult> {
  const [selfEval, peer] = await Promise.all([
    collectAwardSelfEvalData(supabase, yearMonths),
    collectAwardPeerReceivedData(supabase, yearMonths),
  ]);

  const rows = mergeAwardQuarterSummaryRows(selfEval.rows, peer.rows);
  const targetYearMonths = Array.from(
    new Set([...selfEval.targetYearMonths, ...peer.targetYearMonths]),
  ).sort();

  return {
    csvContent: buildAwardQuarterSummaryCsvContent(rows),
    filename: `award-summary-${filenameLabel}.csv`,
    personCount: rows.length,
    selfEvalCount: selfEval.rows.length,
    nomineeCount: peer.rows.length,
    targetYearMonths,
  };
}
