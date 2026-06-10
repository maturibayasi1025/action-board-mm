"use client";

import { Button } from "@/components/ui/button";
import type { AwardQuarter } from "@/lib/actions/admin/award-surveys";
import {
  exportAwardSelfEvalCsvAll,
  exportAwardSelfEvalCsvForQuarter,
} from "@/lib/actions/admin/award-surveys";
import { Download, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type AwardSelfEvalCsvDownloadProps = {
  year: number;
  quarter: AwardQuarter;
  disabled?: boolean;
};

function triggerCsvDownload(csv: string, filename: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

async function downloadSelfEvalCsv(
  fetchCsv: () => Promise<
    | {
        ok: true;
        csv: string;
        filename: string;
        responderCount: number;
        targetYearMonths: string[];
      }
    | { ok: false; error: string }
  >,
): Promise<boolean> {
  const result = await fetchCsv();
  if (!result.ok) {
    toast.error(result.error);
    return false;
  }

  triggerCsvDownload(result.csv, result.filename);
  toast.success(
    `自己評価CSVをダウンロードしました（${result.responderCount}人・${result.targetYearMonths.join(", ")}）`,
  );
  return true;
}

export function AwardSelfEvalCsvDownload({
  year,
  quarter,
  disabled = false,
}: AwardSelfEvalCsvDownloadProps) {
  const [loading, setLoading] = useState(false);

  const handleDownload = async () => {
    setLoading(true);
    try {
      await downloadSelfEvalCsv(() =>
        exportAwardSelfEvalCsvForQuarter(year, quarter),
      );
    } catch {
      toast.error("CSVのダウンロードに失敗しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={disabled || loading}
      onClick={() => void handleDownload()}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
      ) : (
        <Download className="h-4 w-4 mr-1.5" />
      )}
      自己評価CSV
    </Button>
  );
}

type AwardSelfEvalCsvDownloadAllProps = {
  disabled?: boolean;
};

export function AwardSelfEvalCsvDownloadAll({
  disabled = false,
}: AwardSelfEvalCsvDownloadAllProps) {
  const [loading, setLoading] = useState(false);

  const handleDownload = async () => {
    setLoading(true);
    try {
      await downloadSelfEvalCsv(() => exportAwardSelfEvalCsvAll());
    } catch {
      toast.error("CSVのダウンロードに失敗しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={disabled || loading}
      onClick={() => void handleDownload()}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
      ) : (
        <Download className="h-4 w-4 mr-1.5" />
      )}
      自己評価CSV（全月）
    </Button>
  );
}
