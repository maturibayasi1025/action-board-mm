"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { AwardGroupSummary } from "@/lib/types/award-nomination";
import { Download } from "lucide-react";

export type { AwardGroupSummary };

function escapeCsvCell(value: string): string {
  if (value.includes(",") || value.includes("\n") || value.includes('"')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function buildCsvContent(groups: AwardGroupSummary[]): string {
  const headers = ["賞", "該当者", "票数", "推薦者", "コメント"];
  const lines: string[] = [];

  for (const { label, winners } of groups) {
    for (const winner of winners) {
      for (const rec of winner.recommenders) {
        lines.push(
          [
            escapeCsvCell(label),
            escapeCsvCell(winner.name),
            escapeCsvCell(String(winner.total)),
            escapeCsvCell(rec.recommenderName),
            escapeCsvCell(rec.comment),
          ].join(","),
        );
      }
    }
  }

  return [headers.join(","), ...lines].join("\n");
}

function yyyymmddForFilename(): string {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
}

type AwardWinnerCommentSummaryProps = {
  groups: AwardGroupSummary[];
  surveyTitle?: string;
};

export function AwardWinnerCommentSummary({
  groups,
  surveyTitle,
}: AwardWinnerCommentSummaryProps) {
  if (groups.length === 0) return null;

  const hasAnyWinner = groups.some((g) => g.winners.length > 0);
  if (!hasAnyWinner) return null;

  const filenameBase = () => {
    const titlePart = surveyTitle
      ? `${surveyTitle.replace(/[/\\?%*:|"<>]/g, "_")}_`
      : "";
    return `${titlePart}表彰集計_${yyyymmddForFilename()}`;
  };

  const triggerDownload = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExcelDownload = async () => {
    const { buildAwardWinnerExcelBuffer } = await import(
      "@/lib/award/build-award-winner-excel"
    );
    const buffer = await buildAwardWinnerExcelBuffer(groups);
    triggerDownload(
      new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
      `${filenameBase()}.xlsx`,
    );
  };

  const handleCsvDownload = () => {
    const csvContent = buildCsvContent(groups);
    const bom = new Uint8Array([0xef, 0xbb, 0xbf]);
    triggerDownload(
      new Blob([bom, csvContent], { type: "text/csv;charset=utf-8" }),
      `${filenameBase()}.csv`,
    );
  };

  return (
    <Card>
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <CardTitle className="text-2xl">
            表彰集計（推薦コメント付き）
          </CardTitle>
          <CardDescription className="text-base leading-relaxed">
            各賞ごとに受賞者・票数・推薦者・コメントを一覧表示します。Excel
            出力は賞ごとの表組み（該当者・票数の結合セル、行の色分け）付きです。
          </CardDescription>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={() => void handleExcelDownload()}
          >
            <Download className="h-4 w-4 mr-1.5" />
            Excelダウンロード
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCsvDownload}
          >
            <Download className="h-4 w-4 mr-1.5" />
            CSVダウンロード
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-8">
        {groups.map((groupSummary) => (
          <section key={groupSummary.group} className="space-y-4">
            <h3 className="text-lg font-semibold border-b pb-2">
              {groupSummary.label}
            </h3>
            {groupSummary.winners.length === 0 ? (
              <p className="text-sm text-muted-foreground">指名はありません</p>
            ) : (
              <ul
                className="space-y-6"
                aria-label={`${groupSummary.label}の集計`}
              >
                {groupSummary.winners.map((winner) => (
                  <li
                    key={`${groupSummary.group}-${winner.name}`}
                    className="rounded-lg border border-border overflow-hidden"
                  >
                    <div className="flex flex-wrap items-center gap-3 bg-muted/40 px-4 py-3 border-b border-border">
                      <span className="font-semibold text-base">
                        {winner.name}
                      </span>
                      <Badge variant="secondary" className="tabular-nums">
                        {winner.total} 票
                      </Badge>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-muted/30 text-left">
                            <th className="px-4 py-2 font-medium w-[min(12rem,30%)]">
                              推薦者
                            </th>
                            <th className="px-4 py-2 font-medium">コメント</th>
                          </tr>
                        </thead>
                        <tbody>
                          {winner.recommenders.map((rec, idx) => (
                            <tr
                              key={`${winner.name}-${rec.recommenderName}-${idx}`}
                              className="border-b last:border-b-0 even:bg-muted/20"
                            >
                              <td className="px-4 py-3 align-top font-medium whitespace-nowrap">
                                {rec.recommenderName}
                              </td>
                              <td className="px-4 py-3 align-top whitespace-pre-wrap break-words">
                                {rec.comment || (
                                  <span className="text-muted-foreground">
                                    （コメントなし）
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </CardContent>
    </Card>
  );
}
