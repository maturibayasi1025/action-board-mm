"use client";

import { triggerCsvDownload } from "@/components/admin/trigger-csv-download";
import { Button } from "@/components/ui/button";
import { exportAwardH1SummaryCsv } from "@/lib/actions/admin/award-surveys";
import { Download, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type AwardH1SummaryCsvDownloadProps = {
  year: number;
  disabled?: boolean;
};

export function AwardH1SummaryCsvDownload({
  year,
  disabled = false,
}: AwardH1SummaryCsvDownloadProps) {
  const [loading, setLoading] = useState(false);

  const handleDownload = async () => {
    setLoading(true);
    try {
      const result = await exportAwardH1SummaryCsv(year);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      triggerCsvDownload(result.csv, result.filename);
      toast.success(
        `上半期まとめCSVをダウンロードしました（${result.personCount}人・自己評価${result.selfEvalCount}人・他薦${result.nomineeCount}人・${result.targetYearMonths.join(", ")}）`,
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
      上半期まとめCSV（{year} 1Q+2Q）
    </Button>
  );
}
