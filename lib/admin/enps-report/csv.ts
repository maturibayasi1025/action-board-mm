/**
 * レポートのCSV出力。画面と同じ集計・同じマスキングで書き出す。
 * CSVは配布されやすいため、回答者5人未満の区分は画面と同様に数値を伏せる。
 */

import type {
  BusinessUnitRow,
  CompanyComparisonRow,
  CompanyTrendPoint,
} from "@/lib/admin/enps-report/comparison";
import {
  EMPTY_LABEL,
  MASKED_LABEL,
  formatDelta,
  formatNps,
  formatResponseRate,
} from "@/lib/admin/enps-report/format";

export function escapeCsvCell(value: string | number | null): string {
  const str = value === null ? "" : String(value);
  if (str.includes(",") || str.includes("\n") || str.includes('"')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toLine(cells: (string | number | null)[]): string {
  return cells.map(escapeCsvCell).join(",");
}

export function sanitizeFilenameSegment(value: string): string {
  const cleaned = value
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[/\\:*?"<>|#]+/g, "_")
    .slice(0, 72);
  return cleaned.length > 0 ? cleaned : "export";
}

export function yyyymmddForFilename(now: Date = new Date()): string {
  return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(
    2,
    "0",
  )}${String(now.getDate()).padStart(2, "0")}`;
}

type QuestionMeta = { id: string; question_text: string };

export function buildCompanyComparisonCsv(params: {
  yearMonth: string;
  previousYearMonth: string | null;
  questions: QuestionMeta[];
  rows: CompanyComparisonRow[];
}): string[] {
  const { yearMonth, previousYearMonth, questions, rows } = params;

  const header = [
    "会社",
    ...questions.flatMap((q) => [
      `${q.question_text} / eNPS(回答者ベース)`,
      `${q.question_text} / 前月差`,
      `${q.question_text} / eNPS(未回答0点補完)`,
      `${q.question_text} / 回答者数`,
      `${q.question_text} / 対象者数`,
      `${q.question_text} / 回答率`,
    ]),
  ];

  const dataLines = rows.map((row) =>
    toLine([
      row.company_name,
      ...questions.flatMap((q) => {
        const metric = row.metrics[q.id];
        if (!metric) {
          return [
            EMPTY_LABEL,
            EMPTY_LABEL,
            EMPTY_LABEL,
            EMPTY_LABEL,
            EMPTY_LABEL,
            EMPTY_LABEL,
          ];
        }
        if (metric.masked) {
          return [
            MASKED_LABEL,
            MASKED_LABEL,
            MASKED_LABEL,
            MASKED_LABEL,
            String(metric.target_count),
            MASKED_LABEL,
          ];
        }
        return [
          formatNps(metric.nps_respondent_base),
          formatDelta(metric.delta_from_previous),
          formatNps(metric.nps_imputed_base),
          String(metric.respondent_count),
          String(metric.target_count),
          formatResponseRate(metric.response_rate),
        ];
      }),
    ]),
  );

  return [
    toLine(["対象年月", yearMonth]),
    toLine(["前月比較の対象", previousYearMonth ?? "なし"]),
    toLine([
      "注記",
      `回答者${MASKED_LABEL.replace("n<", "")}人未満の区分は個人特定を避けるため伏せています`,
    ]),
    "",
    toLine(header),
    ...dataLines,
  ];
}

export function buildCompanyReportCsv(params: {
  companyName: string;
  yearMonth: string;
  questionText: string;
  businessUnits: BusinessUnitRow[];
  trend: CompanyTrendPoint[];
}): string[] {
  const { companyName, yearMonth, questionText, businessUnits, trend } = params;

  const unitHeader = toLine([
    "事業部",
    "eNPS(回答者ベース)",
    "前月差",
    "eNPS(未回答0点補完)",
    "回答者数",
    "対象者数",
    "回答率",
    "推奨",
    "中立",
    "批判",
  ]);

  const unitLines = businessUnits.map(({ business_unit_name, metric }) =>
    metric.masked
      ? toLine([
          business_unit_name,
          MASKED_LABEL,
          MASKED_LABEL,
          MASKED_LABEL,
          MASKED_LABEL,
          metric.target_count,
          MASKED_LABEL,
          MASKED_LABEL,
          MASKED_LABEL,
          MASKED_LABEL,
        ])
      : toLine([
          business_unit_name,
          formatNps(metric.nps_respondent_base),
          formatDelta(metric.delta_from_previous),
          formatNps(metric.nps_imputed_base),
          metric.respondent_count,
          metric.target_count,
          formatResponseRate(metric.response_rate),
          metric.promoters,
          metric.passives,
          metric.detractors,
        ]),
  );

  const trendHeader = toLine([
    "年月",
    "eNPS(回答者ベース)",
    "eNPS(未回答0点補完)",
    "回答者数",
    "対象者数",
    "回答率",
    "推奨",
    "中立",
    "批判",
  ]);

  const trendLines = trend.map((point) =>
    toLine([
      point.year_month,
      formatNps(point.nps_respondent_base),
      formatNps(point.nps_imputed_base),
      point.respondent_count,
      point.target_count,
      formatResponseRate(point.response_rate),
      point.promoters,
      point.passives,
      point.detractors,
    ]),
  );

  return [
    toLine(["会社", companyName]),
    toLine(["対象年月", yearMonth]),
    toLine(["スコア質問", questionText]),
    "",
    toLine(["【事業部別】"]),
    unitHeader,
    ...unitLines,
    "",
    toLine(["【月次推移】"]),
    trendHeader,
    ...trendLines,
  ];
}
