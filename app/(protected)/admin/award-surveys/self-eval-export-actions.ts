"use server";

import type { AwardQuarter } from "@/app/(protected)/admin/award-surveys/quarterly-ranking-model";
import { yearMonthKeysForQuarter } from "@/app/(protected)/admin/award-surveys/quarterly-ranking-model";
import { buildAwardSelfEvalCsv } from "@/lib/admin/export-award-self-eval-data";
import { createServiceClient } from "@/lib/supabase/server";
import { requireOwner } from "@/lib/utils/isOwner";

export type AwardSelfEvalCsvExportResult =
  | {
      ok: true;
      csv: string;
      filename: string;
      responderCount: number;
      responseCount: number;
      targetYearMonths: string[];
    }
  | { ok: false; error: string };

export async function exportAwardSelfEvalCsvForQuarter(
  year: number,
  quarter: AwardQuarter,
): Promise<AwardSelfEvalCsvExportResult> {
  await requireOwner();
  const supabase = await createServiceClient();
  const yearMonths = yearMonthKeysForQuarter(year, quarter);

  try {
    const result = await buildAwardSelfEvalCsv(supabase, yearMonths);
    if (result.responderCount === 0) {
      return {
        ok: false,
        error: "対象四半期に自己評価の回答がありません。",
      };
    }
    return {
      ok: true,
      csv: result.csvContent,
      filename: result.filename,
      responderCount: result.responderCount,
      responseCount: result.responseCount,
      targetYearMonths: result.targetYearMonths,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "CSVの生成に失敗しました";
    return { ok: false, error: message };
  }
}

export async function exportAwardSelfEvalCsvAll(): Promise<AwardSelfEvalCsvExportResult> {
  await requireOwner();
  const supabase = await createServiceClient();

  try {
    const result = await buildAwardSelfEvalCsv(supabase, null);
    if (result.responderCount === 0) {
      return {
        ok: false,
        error: "自己評価の回答がありません。",
      };
    }
    return {
      ok: true,
      csv: result.csvContent,
      filename: result.filename,
      responderCount: result.responderCount,
      responseCount: result.responseCount,
      targetYearMonths: result.targetYearMonths,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "CSVの生成に失敗しました";
    return { ok: false, error: message };
  }
}
