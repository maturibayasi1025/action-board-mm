"use server";

import type { AwardQuarter } from "@/app/(protected)/admin/award-surveys/quarterly-ranking-model";
import {
  yearMonthKeysForFirstHalf,
  yearMonthKeysForQuarter,
} from "@/app/(protected)/admin/award-surveys/quarterly-ranking-model";
import {
  awardH1FilenameLabel,
  awardQuarterFilenameLabel,
} from "@/lib/admin/export-award-peer-received";
import { buildAwardPeerReceivedCsv } from "@/lib/admin/export-award-peer-received-data";
import { buildAwardQuarterSummaryCsv } from "@/lib/admin/export-award-quarter-summary-data";
import { createServiceClient } from "@/lib/supabase/server";
import { requireOwner } from "@/lib/utils/isOwner";

export type AwardPeerReceivedCsvExportResult =
  | {
      ok: true;
      csv: string;
      filename: string;
      detailCsv: string;
      detailFilename: string;
      nomineeCount: number;
      nominationCount: number;
      targetYearMonths: string[];
    }
  | { ok: false; error: string };

export type AwardQuarterSummaryCsvExportResult =
  | {
      ok: true;
      csv: string;
      filename: string;
      personCount: number;
      selfEvalCount: number;
      nomineeCount: number;
      targetYearMonths: string[];
    }
  | { ok: false; error: string };

export async function exportAwardPeerReceivedCsvForQuarter(
  year: number,
  quarter: AwardQuarter,
): Promise<AwardPeerReceivedCsvExportResult> {
  await requireOwner();
  const supabase = await createServiceClient();
  const yearMonths = yearMonthKeysForQuarter(year, quarter);

  try {
    const result = await buildAwardPeerReceivedCsv(
      supabase,
      yearMonths,
      awardQuarterFilenameLabel(year, quarter),
    );
    if (result.nomineeCount === 0) {
      return {
        ok: false,
        error: "対象四半期に他薦（受けた評価）がありません。",
      };
    }
    return {
      ok: true,
      csv: result.csvContent,
      filename: result.filename,
      detailCsv: result.detailCsvContent,
      detailFilename: result.detailFilename,
      nomineeCount: result.nomineeCount,
      nominationCount: result.nominationCount,
      targetYearMonths: result.targetYearMonths,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "CSVの生成に失敗しました";
    return { ok: false, error: message };
  }
}

export async function exportAwardH1SummaryCsv(
  year: number,
): Promise<AwardQuarterSummaryCsvExportResult> {
  await requireOwner();
  const supabase = await createServiceClient();
  const yearMonths = yearMonthKeysForFirstHalf(year);

  try {
    const result = await buildAwardQuarterSummaryCsv(
      supabase,
      yearMonths,
      awardH1FilenameLabel(year),
    );
    if (result.personCount === 0) {
      return {
        ok: false,
        error:
          "対象年度の1Q・2Qに自己評価または他薦（受けた評価）がありません。",
      };
    }
    return {
      ok: true,
      csv: result.csvContent,
      filename: result.filename,
      personCount: result.personCount,
      selfEvalCount: result.selfEvalCount,
      nomineeCount: result.nomineeCount,
      targetYearMonths: result.targetYearMonths,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "CSVの生成に失敗しました";
    return { ok: false, error: message };
  }
}
