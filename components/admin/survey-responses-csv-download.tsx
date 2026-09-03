"use client";

import { Button } from "@/components/ui/button";
import { downloadUtf8Csv } from "@/lib/admin/enps-report/download-csv";
import type { AdminSurveyResponseRow } from "@/lib/admin/group-survey-responses";
import {
  type SurveyExportQuestion,
  buildSurveyResponsesCsv,
} from "@/lib/survey/export-responses-csv";
import { Download } from "lucide-react";

type SurveyResponsesCsvDownloadProps = {
  questions: SurveyExportQuestion[];
  responses: AdminSurveyResponseRow[];
  filename: string;
};

export function SurveyResponsesCsvDownload({
  questions,
  responses,
  filename,
}: SurveyResponsesCsvDownloadProps) {
  if (responses.length === 0) {
    return null;
  }

  const onDownload = () => {
    const { lines } = buildSurveyResponsesCsv({ questions, responses });
    downloadUtf8Csv(filename, lines);
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={onDownload}
      className="shrink-0"
    >
      <Download className="h-4 w-4 mr-1.5" />
      回答CSV
    </Button>
  );
}
