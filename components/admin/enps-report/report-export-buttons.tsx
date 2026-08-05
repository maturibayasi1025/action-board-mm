"use client";

import { Button } from "@/components/ui/button";
import type {
  BusinessUnitRow,
  CompanyComparisonRow,
  CompanyTrendPoint,
} from "@/lib/admin/enps-report/comparison";
import {
  buildCompanyComparisonCsv,
  buildCompanyReportCsv,
  sanitizeFilenameSegment,
  yyyymmddForFilename,
} from "@/lib/admin/enps-report/csv";
import { downloadUtf8Csv } from "@/lib/admin/enps-report/download-csv";
import { Download, Printer } from "lucide-react";

type QuestionMeta = { id: string; question_text: string };

export function ComparisonExportButton({
  yearMonth,
  previousYearMonth,
  questions,
  rows,
}: {
  yearMonth: string;
  previousYearMonth: string | null;
  questions: QuestionMeta[];
  rows: CompanyComparisonRow[];
}) {
  const onDownload = () => {
    const lines = buildCompanyComparisonCsv({
      yearMonth,
      previousYearMonth,
      questions,
      rows,
    });
    downloadUtf8Csv(
      `eNPS会社別サマリー_${sanitizeFilenameSegment(yearMonth)}_${yyyymmddForFilename()}.csv`,
      lines,
    );
  };

  return (
    <Button type="button" variant="outline" size="sm" onClick={onDownload}>
      <Download className="h-4 w-4 mr-1.5" />
      CSVダウンロード
    </Button>
  );
}

export function CompanyReportExportButtons({
  companyName,
  yearMonth,
  questionText,
  businessUnits,
  trend,
  segmentLabel = "事業部",
  scopeLabel = "会社",
}: {
  companyName: string;
  yearMonth: string;
  questionText: string;
  businessUnits: BusinessUnitRow[];
  trend: CompanyTrendPoint[];
  segmentLabel?: string;
  scopeLabel?: string;
}) {
  const onDownload = () => {
    const lines = buildCompanyReportCsv({
      companyName,
      yearMonth,
      questionText,
      businessUnits,
      trend,
      segmentLabel,
      scopeLabel,
    });
    downloadUtf8Csv(
      `eNPSレポート_${sanitizeFilenameSegment(companyName)}_${sanitizeFilenameSegment(
        yearMonth,
      )}_${yyyymmddForFilename()}.csv`,
      lines,
    );
  };

  return (
    <div className="flex flex-wrap gap-2">
      <Button type="button" variant="outline" size="sm" onClick={onDownload}>
        <Download className="h-4 w-4 mr-1.5" />
        CSVダウンロード
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => window.print()}
      >
        <Printer className="h-4 w-4 mr-1.5" />
        印刷 / PDF保存
      </Button>
    </div>
  );
}
