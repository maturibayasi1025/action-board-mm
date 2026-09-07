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

type PeerCsvKind = "aggregated" | "detail";

export function AwardPeerReceivedCsvDownload({
  year,
  quarter,
  disabled = false,
}: AwardPeerReceivedCsvDownloadProps) {
  const [loadingKind, setLoadingKind] = useState<PeerCsvKind | null>(null);

  const handleDownload = async (kind: PeerCsvKind) => {
    setLoadingKind(kind);
    try {
      const result = await exportAwardPeerReceivedCsvForQuarter(year, quarter);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      if (kind === "aggregated") {
        triggerCsvDownload(result.csv, result.filename);
        toast.success(
          `他薦（受けた評価）CSVをダウンロードしました（${result.nomineeCount}人・${result.nominationCount}件・${result.targetYearMonths.join(", ")}）`,
        );
        return;
      }

      triggerCsvDownload(result.detailCsv, result.detailFilename);
      toast.success(
        `他薦詳細CSVをダウンロードしました（${result.nominationCount}件・${result.targetYearMonths.join(", ")}）`,
      );
    } catch {
      toast.error("CSVのダウンロードに失敗しました");
    } finally {
      setLoadingKind(null);
    }
  };

  const loading = loadingKind != null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled || loading}
        onClick={() => void handleDownload("aggregated")}
      >
        {loadingKind === "aggregated" ? (
          <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
        ) : (
          <Download className="h-4 w-4 mr-1.5" />
        )}
        他薦（受けた評価）CSV
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled || loading}
        onClick={() => void handleDownload("detail")}
      >
        {loadingKind === "detail" ? (
          <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
        ) : (
          <Download className="h-4 w-4 mr-1.5" />
        )}
        他薦詳細CSV
      </Button>
    </div>
  );
}
