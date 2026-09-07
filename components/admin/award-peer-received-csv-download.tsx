"use client";

import { triggerCsvDownload } from "@/components/admin/trigger-csv-download";
import { Button } from "@/components/ui/button";
import type { AwardQuarter } from "@/lib/actions/admin/award-surveys";
import { exportAwardPeerReceivedCsvForQuarter } from "@/lib/actions/admin/award-surveys";
import { Download, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type AwardPeerReceivedCsvDownloadProps = {
  year: number;
  quarter: AwardQuarter;
  disabled?: boolean;
};

export function AwardPeerReceivedCsvDownload({
  year,
  quarter,
  disabled = false,
}: AwardPeerReceivedCsvDownloadProps) {
  const [loading, setLoading] = useState(false);

  const handleDownload = async () => {
    setLoading(true);
    try {
      const result = await exportAwardPeerReceivedCsvForQuarter(year, quarter);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      triggerCsvDownload(result.csv, result.filename);
      triggerCsvDownload(result.detailCsv, result.detailFilename);
      toast.success(
        `他薦（受けた評価）CSVをダウンロードしました（${result.nomineeCount}人・${result.nominationCount}件・${result.targetYearMonths.join(", ")}）`,
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
      他薦（受けた評価）CSV
    </Button>
  );
}
