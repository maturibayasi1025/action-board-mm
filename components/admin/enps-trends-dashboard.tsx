"use client";

import type {
  BusinessUnitRow,
  CompanyRow,
} from "@/app/(protected)/admin/business-units/actions";
import {
  type EnpsMonthlyPoint,
  type EnpsMonthlyScoreExportRow,
  type EnpsOrgFilter,
  getEnpsMonthlyScoreExportRows,
  getEnpsMonthlyTrendsForQuestion,
} from "@/app/(protected)/admin/enps-surveys/trends/actions";
import { Button } from "@/components/ui/button";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { toast } from "sonner";

const NONE_COMPANY = "__none_company";
const NONE_UNIT = "__none_unit";
/** 質問②未選択（2質問CSV用） */
const NONE_SECOND_QUESTION_FOR_CSV = "__none_second_q";

type ScoreQuestion = {
  id: string;
  question_text: string;
  display_order: number;
};

const chartConfig = {
  nps: {
    color: "hsl(var(--chart-1))",
    label: "eNPS",
  },
} satisfies ChartConfig;

function formatNps(n: number | null): string {
  if (n === null) return "—";
  return `${n > 0 ? "+" : ""}${n}`;
}

/** CSV・画面マトリクス共通の行定義 */
const ENPS_MATRIX_METRICS: ReadonlyArray<{
  key: string;
  label: string;
  format: (s: EnpsMonthlyPoint) => string;
}> = [
  {
    key: "nps",
    label: "eNPS",
    format: (s) => formatNps(s.nps),
  },
  {
    key: "respondent_count",
    label: "回答者数（期限内・重複除く）",
    format: (s) => String(s.respondent_count),
  },
  {
    key: "promoters",
    label: "推奨（9–10）",
    format: (s) => String(s.promoters),
  },
  {
    key: "passives",
    label: "中立（7–8）",
    format: (s) => String(s.passives),
  },
  {
    key: "detractors",
    label: "批判（0–6）",
    format: (s) => String(s.detractors),
  },
];

function emptyMonthlyPointSkeleton(
  template: EnpsMonthlyPoint,
): EnpsMonthlyPoint {
  return {
    survey_id: template.survey_id,
    year_month: template.year_month,
    title: template.title,
    respondent_count: 0,
    promoters: 0,
    passives: 0,
    detractors: 0,
    nps: null,
  };
}

/** 質問ごとの取得結果を、基準となる月次並びにsurvey_idで揃える */
function alignMonthlySeriesOrder(
  template: EnpsMonthlyPoint[],
  other: EnpsMonthlyPoint[],
): EnpsMonthlyPoint[] {
  const m = new Map(other.map((p) => [p.survey_id, p]));
  return template.map(
    (t) => m.get(t.survey_id) ?? emptyMonthlyPointSkeleton(t),
  );
}

function buildMatrixCsvDataLines(seriesData: EnpsMonthlyPoint[]): string[] {
  if (seriesData.length === 0) return [];
  const months = seriesData.map((s) => s.year_month);
  const headerLine = ["指標", ...months.map((m) => escapeCsvCell(m))].join(",");
  const dataLines = ENPS_MATRIX_METRICS.map((row) =>
    [
      escapeCsvCell(row.label),
      ...seriesData.map((s) => escapeCsvCell(row.format(s))),
    ].join(","),
  );
  return [headerLine, ...dataLines];
}

function csvRowKindLabel(k: EnpsMonthlyScoreExportRow["row_kind"]): string {
  switch (k) {
    case "on_time":
      return "期限内回答";
    case "imputed_zero":
      return "未回答補完(スコア0)";
  }
}

function escapeCsvCell(value: string | number): string {
  const str = String(value);
  if (str.includes(",") || str.includes("\n") || str.includes('"')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function sanitizeFilenameSegment(s: string): string {
  const t = s.trim().replace(/\s+/g, "_");
  const cleaned = t.replace(/[/\\:*?"<>|#]+/g, "_").slice(0, 72);
  return cleaned.length > 0 ? cleaned : "export";
}

function yyyymmddForFilename(): string {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
}

function downloadUtf8Csv(filename: string, rows: string[]) {
  const bom = new Uint8Array([0xef, 0xbb, 0xbf]);
  const blob = new Blob([bom, rows.join("\n")], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function EnpsTrendsDashboard({
  questions,
  initialQuestionId,
  initialSeries,
  companies,
  units,
  organizationsLoadError = null,
}: {
  questions: ScoreQuestion[];
  initialQuestionId: string;
  initialSeries: EnpsMonthlyPoint[];
  companies: CompanyRow[];
  units: BusinessUnitRow[];
  organizationsLoadError?: string | null;
}) {
  const [questionId, setQuestionId] = useState(initialQuestionId);
  const [series, setSeries] = useState<EnpsMonthlyPoint[]>(initialSeries);
  const [selectedCompanyId, setSelectedCompanyId] =
    useState<string>(NONE_COMPANY);
  const [selectedUnitId, setSelectedUnitId] = useState<string>(NONE_UNIT);
  const [appliedOrg, setAppliedOrg] = useState<EnpsOrgFilter | null>(null);
  const [selectedSurveyIdForCsv, setSelectedSurveyIdForCsv] = useState(() => {
    return initialSeries.at(-1)?.survey_id ?? "";
  });
  const [csvExporting, setCsvExporting] = useState(false);
  const [isPending, startTransition] = useTransition();

  const load = useCallback((qid: string, org: EnpsOrgFilter | null) => {
    startTransition(async () => {
      const data = await getEnpsMonthlyTrendsForQuestion(qid, org);
      setSeries(data);
    });
  }, []);

  const activeCompanies = useMemo(() => {
    return companies.filter((c) => {
      if (!c.is_active) return false;
      return units.some((u) => u.company_id === c.id && u.is_active);
    });
  }, [companies, units]);

  const unitsForSelectedCompany = useMemo(() => {
    if (selectedCompanyId === NONE_COMPANY) return [];
    return units.filter(
      (u) => u.company_id === selectedCompanyId && u.is_active,
    );
  }, [units, selectedCompanyId]);

  /** 会社が選ばれていてマスタ上も有効 */
  const companySelectionValid = useMemo(() => {
    if (selectedCompanyId === NONE_COMPANY) return false;
    const company = companies.find((c) => c.id === selectedCompanyId);
    return !!company?.is_active;
  }, [companies, selectedCompanyId]);

  /** 事業部まで選んだときの組み合わせが妥当 */
  const buSelectionValid = useMemo(() => {
    if (selectedUnitId === NONE_UNIT) return false;
    const company = companies.find((c) => c.id === selectedCompanyId);
    const unit = units.find((u) => u.id === selectedUnitId);
    return (
      !!company?.is_active &&
      !!unit?.is_active &&
      !!company &&
      !!unit &&
      unit.company_id === company.id
    );
  }, [companies, units, selectedCompanyId, selectedUnitId]);

  /** 会社のみ、または会社＋事業部のどちらでも適用可 */
  const canApplyOrgFilter = useMemo(
    () =>
      companySelectionValid &&
      (selectedUnitId === NONE_UNIT || buSelectionValid),
    [companySelectionValid, buSelectionValid, selectedUnitId],
  );

  const orgFilterBroken = organizationsLoadError != null;

  const onCompanyChange = (value: string) => {
    setSelectedCompanyId(value);
    setSelectedUnitId(NONE_UNIT);
  };

  const onQuestionChange = (value: string) => {
    setQuestionId(value);
    load(value, appliedOrg);
  };

  const onApplyOrgFilter = () => {
    if (orgFilterBroken || !canApplyOrgFilter) return;
    const company = companies.find((c) => c.id === selectedCompanyId);
    if (!company?.is_active) return;

    if (selectedUnitId === NONE_UNIT) {
      const org: EnpsOrgFilter = { companyName: company.name.trim() };
      setAppliedOrg(org);
      load(questionId, org);
      return;
    }

    const unit = units.find((u) => u.id === selectedUnitId);
    if (
      !unit?.is_active ||
      unit.company_id !== company.id ||
      !buSelectionValid
    ) {
      return;
    }

    const org: EnpsOrgFilter = {
      companyName: company.name.trim(),
      businessUnitName: unit.name.trim(),
    };
    setAppliedOrg(org);
    load(questionId, org);
  };

  const onClearOrgFilter = () => {
    setSelectedCompanyId(NONE_COMPANY);
    setSelectedUnitId(NONE_UNIT);
    setAppliedOrg(null);
    load(questionId, null);
  };

  const months = useMemo(() => series.map((s) => s.year_month), [series]);

  const chartData = useMemo(
    () =>
      series.map((s) => ({
        monthLabel: s.year_month,
        nps: s.nps,
      })),
    [series],
  );

  const [secondQuestionIdForCsv, setSecondQuestionIdForCsv] = useState<string>(
    NONE_SECOND_QUESTION_FOR_CSV,
  );

  useEffect(() => {
    if (
      secondQuestionIdForCsv !== NONE_SECOND_QUESTION_FOR_CSV &&
      secondQuestionIdForCsv === questionId
    ) {
      setSecondQuestionIdForCsv(NONE_SECOND_QUESTION_FOR_CSV);
    }
  }, [questionId, secondQuestionIdForCsv]);

  useEffect(() => {
    if (
      secondQuestionIdForCsv !== NONE_SECOND_QUESTION_FOR_CSV &&
      !questions.some((q) => q.id === secondQuestionIdForCsv)
    ) {
      setSecondQuestionIdForCsv(NONE_SECOND_QUESTION_FOR_CSV);
    }
  }, [questions, secondQuestionIdForCsv]);

  const twoQuestionPairCsvValid = useMemo(
    () =>
      questions.length >= 2 &&
      secondQuestionIdForCsv !== NONE_SECOND_QUESTION_FOR_CSV &&
      secondQuestionIdForCsv !== questionId,
    [questions.length, questionId, secondQuestionIdForCsv],
  );

  const secondQuestionCsvLabel = useMemo(() => {
    return (
      questions.find((q) => q.id === secondQuestionIdForCsv)?.question_text ??
      ""
    );
  }, [questions, secondQuestionIdForCsv]);

  const activeQuestionLabel = useMemo(() => {
    return questions.find((q) => q.id === questionId)?.question_text ?? "";
  }, [questions, questionId]);

  useEffect(() => {
    if (series.length === 0) {
      setSelectedSurveyIdForCsv("");
      return;
    }
    setSelectedSurveyIdForCsv((prev) =>
      prev && series.some((s) => s.survey_id === prev)
        ? prev
        : series[series.length - 1].survey_id,
    );
  }, [series]);

  const orgFilenamePart = useMemo(() => {
    if (!appliedOrg) return "全体";
    const bu = appliedOrg.businessUnitName?.trim();
    if (bu) {
      return `${appliedOrg.companyName}_${bu}`;
    }
    return `${appliedOrg.companyName}_会社全体`;
  }, [appliedOrg]);

  const downloadMatrixCsvCombined = () => {
    const qSlug = sanitizeFilenameSegment(activeQuestionLabel || "質問");
    const orgSlug = sanitizeFilenameSegment(orgFilenamePart);
    const dateSlug = yyyymmddForFilename();
    const filename = `月次eNPS_まとめて_${orgSlug}_${qSlug}_${dateSlug}.csv`;

    const matrixLines = buildMatrixCsvDataLines(series);

    downloadUtf8Csv(filename, [
      `${escapeCsvCell("スコア質問（表示中）")},${escapeCsvCell(activeQuestionLabel)}`,
      `${escapeCsvCell("絞り込み")},${escapeCsvCell(appliedOrg ? orgFilenamePart.replace(/_/g, " / ") : "なし（全体）")}`,
      "",
      ...matrixLines,
    ]);
  };

  const downloadMatrixCsvTwoQuestions = async () => {
    if (!twoQuestionPairCsvValid) return;
    setCsvExporting(true);
    try {
      const [sPrimary, sSecond] = await Promise.all([
        getEnpsMonthlyTrendsForQuestion(questionId, appliedOrg),
        getEnpsMonthlyTrendsForQuestion(secondQuestionIdForCsv, appliedOrg),
      ]);
      const sSecondAligned = alignMonthlySeriesOrder(sPrimary, sSecond);

      const orgSlug = sanitizeFilenameSegment(orgFilenamePart);
      const dateSlug = yyyymmddForFilename();
      const filename = `月次eNPS_まとめて_2質問_${orgSlug}_${dateSlug}.csv`;

      const block1 = buildMatrixCsvDataLines(sPrimary);
      const block2 = buildMatrixCsvDataLines(sSecondAligned);

      downloadUtf8Csv(filename, [
        `${escapeCsvCell("質問①（画面上の選択）")},${escapeCsvCell(activeQuestionLabel)}`,
        `${escapeCsvCell("質問②（組み合わせ選択）")},${escapeCsvCell(secondQuestionCsvLabel)}`,
        `${escapeCsvCell("絞り込み")},${escapeCsvCell(appliedOrg ? orgFilenamePart.replace(/_/g, " / ") : "なし（全体）")}`,
        "",
        `${escapeCsvCell("【質問①】")}`,
        ...block1,
        "",
        `${escapeCsvCell("【質問②】")}`,
        ...block2,
      ]);
    } catch {
      toast.error("CSV用データの取得に失敗しました。");
    } finally {
      setCsvExporting(false);
    }
  };

  const downloadSingleMonthCsv = async () => {
    if (!selectedSurveyIdForCsv) {
      toast.error("対象の月を選んでください。");
      return;
    }
    setCsvExporting(true);
    try {
      const result = await getEnpsMonthlyScoreExportRows(
        questionId,
        selectedSurveyIdForCsv,
        appliedOrg,
      );
      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      const ymSlug = sanitizeFilenameSegment(
        result.survey.year_month || "月次",
      );
      const qSlug = sanitizeFilenameSegment(activeQuestionLabel || "質問");
      const orgSlug = sanitizeFilenameSegment(orgFilenamePart);
      const dateSlug = yyyymmddForFilename();
      const filename = `月次eNPS_単月_${ymSlug}_${orgSlug}_${qSlug}_${dateSlug}.csv`;

      const headerLine = [
        "ユーザーID",
        "氏名",
        "会社",
        "事業部",
        "スコア(0〜10)",
        "行区分",
        "期限内回答日時（ISO8601・補完行は空）",
      ].join(",");

      const dataLines = result.rows.map((r) =>
        [
          escapeCsvCell(r.user_id),
          escapeCsvCell(r.user_name),
          escapeCsvCell(r.company_name),
          escapeCsvCell(r.business_unit_name),
          escapeCsvCell(r.score_0_10),
          escapeCsvCell(csvRowKindLabel(r.row_kind)),
          escapeCsvCell(r.responded_at ?? ""),
        ].join(","),
      );

      downloadUtf8Csv(filename, [
        `${escapeCsvCell("対象年月")},${escapeCsvCell(result.survey.year_month)}`,
        `${escapeCsvCell("サーベイトラック名")},${escapeCsvCell(result.survey.title)}`,
        `${escapeCsvCell("スコア質問")},${escapeCsvCell(activeQuestionLabel)}`,
        `${escapeCsvCell("絞り込み")},${escapeCsvCell(appliedOrg ? orgFilenamePart.replace(/_/g, " / ") : "なし（全体）")}`,
        "",
        headerLine,
        ...dataLines,
      ]);
    } finally {
      setCsvExporting(false);
    }
  };

  const downloadSingleMonthTwoQuestionsCsv = async () => {
    if (!selectedSurveyIdForCsv) {
      toast.error("対象の月を選んでください。");
      return;
    }
    if (!twoQuestionPairCsvValid) {
      toast.error(
        "質問②を選んでください（表示中のスコア質問と別の質問を選びます）。",
      );
      return;
    }
    setCsvExporting(true);
    try {
      const [ra, rb] = await Promise.all([
        getEnpsMonthlyScoreExportRows(
          questionId,
          selectedSurveyIdForCsv,
          appliedOrg,
        ),
        getEnpsMonthlyScoreExportRows(
          secondQuestionIdForCsv,
          selectedSurveyIdForCsv,
          appliedOrg,
        ),
      ]);
      if (!ra.ok) {
        toast.error(ra.error);
        return;
      }
      if (!rb.ok) {
        toast.error(rb.error);
        return;
      }

      const mapa = new Map(ra.rows.map((r) => [r.user_id, r]));
      const mapb = new Map(rb.rows.map((r) => [r.user_id, r]));
      const mergedIds = Array.from(
        new Set([...Array.from(mapa.keys()), ...Array.from(mapb.keys())]),
      ).sort((x, y) => x.localeCompare(y));

      const ymSlug = sanitizeFilenameSegment(ra.survey.year_month || "月次");
      const orgSlug = sanitizeFilenameSegment(orgFilenamePart);
      const dateSlug = yyyymmddForFilename();
      const filename = `月次eNPS_単月_2質問_${ymSlug}_${orgSlug}_${dateSlug}.csv`;

      const headerLine = [
        "ユーザーID",
        "氏名",
        "会社",
        "事業部",
        "スコア①(0〜10)",
        "質問①行区分",
        "質問①期限内回答日時（ISO8601）",
        "スコア②(0〜10)",
        "質問②行区分",
        "質問②期限内回答日時（ISO8601）",
      ].join(",");

      const dataLines = mergedIds.map((uid) => {
        const a = mapa.get(uid);
        const b = mapb.get(uid);
        const name = a?.user_name ?? b?.user_name ?? "";
        const co = a?.company_name ?? b?.company_name ?? "";
        const bu = a?.business_unit_name ?? b?.business_unit_name ?? "";
        return [
          escapeCsvCell(uid),
          escapeCsvCell(name),
          escapeCsvCell(co),
          escapeCsvCell(bu),
          a ? escapeCsvCell(a.score_0_10) : "",
          a ? escapeCsvCell(csvRowKindLabel(a.row_kind)) : "",
          a ? escapeCsvCell(a.responded_at ?? "") : "",
          b ? escapeCsvCell(b.score_0_10) : "",
          b ? escapeCsvCell(csvRowKindLabel(b.row_kind)) : "",
          b ? escapeCsvCell(b.responded_at ?? "") : "",
        ].join(",");
      });

      downloadUtf8Csv(filename, [
        `${escapeCsvCell("対象年月")},${escapeCsvCell(ra.survey.year_month)}`,
        `${escapeCsvCell("サーベイトラック名")},${escapeCsvCell(ra.survey.title)}`,
        `${escapeCsvCell("質問①（画面上の選択）")},${escapeCsvCell(activeQuestionLabel)}`,
        `${escapeCsvCell("質問②（組み合わせ選択）")},${escapeCsvCell(secondQuestionCsvLabel)}`,
        `${escapeCsvCell("絞り込み")},${escapeCsvCell(appliedOrg ? orgFilenamePart.replace(/_/g, " / ") : "なし（全体）")}`,
        "",
        headerLine,
        ...dataLines,
      ]);
    } finally {
      setCsvExporting(false);
    }
  };

  if (questions.length === 0) {
    return null;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="space-y-2 min-w-[12rem] max-w-xl flex-1">
          <Label htmlFor="enps-trends-question">スコア質問</Label>
          <Select value={questionId} onValueChange={onQuestionChange}>
            <SelectTrigger id="enps-trends-question" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {questions.map((q) => (
                <SelectItem key={q.id} value={q.id} title={q.question_text}>
                  <span className="line-clamp-2 text-left">
                    {q.question_text}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-lg border border-border p-4 space-y-3">
        <p className="text-sm font-medium">会社・事業部で絞り込み（任意）</p>
        <p className="text-xs text-muted-foreground">
          会社だけ選んで「適用」するとその会社全体（全事業部）、事業部も選ぶとその事業部のみに絞り込みます。「絞り込みを解除」で全体表示に戻します。
        </p>
        {organizationsLoadError ? (
          <p className="text-xs text-destructive">{organizationsLoadError}</p>
        ) : activeCompanies.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            有効な会社・事業部マスタがありません。管理画面から登録してください。
          </p>
        ) : null}
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="space-y-1.5 min-w-[10rem] flex-1 sm:max-w-xs">
            <Label htmlFor="enps-trends-co">会社名（マスタから選択）</Label>
            <Select
              value={selectedCompanyId}
              onValueChange={onCompanyChange}
              disabled={
                orgFilterBroken || activeCompanies.length === 0 || isPending
              }
            >
              <SelectTrigger id="enps-trends-co" className="w-full">
                <SelectValue placeholder="選択してください" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE_COMPANY}>選択してください</SelectItem>
                {activeCompanies.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 min-w-[10rem] flex-1 sm:max-w-xs">
            <Label htmlFor="enps-trends-bu">事業部名（マスタから選択）</Label>
            <Select
              value={selectedUnitId}
              onValueChange={setSelectedUnitId}
              disabled={
                orgFilterBroken ||
                selectedCompanyId === NONE_COMPANY ||
                unitsForSelectedCompany.length === 0 ||
                isPending
              }
            >
              <SelectTrigger id="enps-trends-bu" className="w-full">
                <SelectValue placeholder="まず会社を選択" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE_UNIT}>
                  {selectedCompanyId === NONE_COMPANY
                    ? "まず会社を選択"
                    : unitsForSelectedCompany.length === 0
                      ? "事業部がありません"
                      : "選択してください"}
                </SelectItem>
                {unitsForSelectedCompany.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={isPending || orgFilterBroken || !canApplyOrgFilter}
              onClick={onApplyOrgFilter}
            >
              適用
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={onClearOrgFilter}
            >
              絞り込みを解除
            </Button>
          </div>
        </div>
        {appliedOrg ? (
          <p className="text-xs text-muted-foreground">
            現在（絞り込み適用）: {appliedOrg.companyName}
            {appliedOrg.businessUnitName
              ? ` / ${appliedOrg.businessUnitName}`
              : "（会社全体・全事業部）"}
          </p>
        ) : null}
      </div>

      {series.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          表示できる月次データがありません。
        </p>
      ) : (
        <>
          <div className="space-y-2">
            <h3 className="text-sm font-medium">eNPS の推移</h3>
            <ChartContainer
              config={chartConfig}
              className="block aspect-auto h-[200px] w-full max-w-full [&_.recharts-responsive-container]:h-full"
            >
              <LineChart data={chartData} margin={{ left: 8, right: 8 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis
                  dataKey="monthLabel"
                  tickLine={false}
                  axisLine={false}
                  minTickGap={16}
                  tick={{ fontSize: 11 }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={40}
                  tick={{ fontSize: 12 }}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value) => [
                        value === null || value === undefined
                          ? "—"
                          : `${Number(value) > 0 ? "+" : ""}${value}`,
                        "eNPS",
                      ]}
                      hideLabel
                    />
                  }
                />
                <Line
                  dataKey="nps"
                  type="monotone"
                  stroke="var(--color-nps)"
                  strokeWidth={2}
                  connectNulls
                  dot={{ fill: "var(--color-nps)", r: 3 }}
                  activeDot={{ r: 5 }}
                  name="eNPS"
                />
              </LineChart>
            </ChartContainer>
          </div>

          <div className="space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
              <h3 className="text-sm font-medium shrink-0">月次マトリクス</h3>
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
                <div className="space-y-1 min-w-[10rem] sm:max-w-xs">
                  <Label htmlFor="enps-trends-csv-month" className="text-xs">
                    単月CSVの対象
                  </Label>
                  <Select
                    value={selectedSurveyIdForCsv || undefined}
                    onValueChange={setSelectedSurveyIdForCsv}
                    disabled={isPending || series.length === 0 || csvExporting}
                  >
                    <SelectTrigger
                      id="enps-trends-csv-month"
                      className="w-full sm:w-[min(22rem,100%)]"
                    >
                      <SelectValue placeholder="年月を選択" />
                    </SelectTrigger>
                    <SelectContent>
                      {series.map((s) => (
                        <SelectItem key={s.survey_id} value={s.survey_id}>
                          {s.year_month}（{s.title}）
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isPending || series.length === 0 || csvExporting}
                    onClick={downloadMatrixCsvCombined}
                  >
                    <Download className="h-4 w-4 mr-1.5" />
                    まとめてCSV
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={
                      isPending ||
                      csvExporting ||
                      !selectedSurveyIdForCsv ||
                      series.length === 0
                    }
                    onClick={() => void downloadSingleMonthCsv()}
                  >
                    <Download className="h-4 w-4 mr-1.5" />
                    単月CSV
                  </Button>
                </div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              「まとめて」はグラフ直下のマトリクスと同じ集計（列＝年月）。「単月」はその月のユーザー別スコア（画面上の推移集計と同じく、終了済みのみ未回答を0として補完）。
            </p>
            {questions.length >= 2 ? (
              <div className="rounded-md border border-border bg-muted/20 p-3 space-y-3">
                <p className="text-sm font-medium">
                  2つのスコア質問を1ファイルにまとめて出力
                </p>
                <p className="text-xs text-muted-foreground">
                  質問①は上の「スコア質問」の選択、質問②は下で選びます。まとめてCSVは各質問のマトリクスを縦に連結、単月CSVは同一ユーザーの2スコアを横並びにします。
                </p>
                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
                  <div className="space-y-1 min-w-[12rem] flex-1 sm:max-w-xl">
                    <Label
                      htmlFor="enps-trends-second-q-csv"
                      className="text-xs"
                    >
                      質問②（組み合わせ）
                    </Label>
                    <Select
                      value={secondQuestionIdForCsv}
                      onValueChange={setSecondQuestionIdForCsv}
                      disabled={isPending || csvExporting}
                    >
                      <SelectTrigger
                        id="enps-trends-second-q-csv"
                        className="w-full"
                      >
                        <SelectValue placeholder="質問②を選択" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE_SECOND_QUESTION_FOR_CSV}>
                          選んでください
                        </SelectItem>
                        {questions
                          .filter((q) => q.id !== questionId)
                          .map((q) => (
                            <SelectItem
                              key={q.id}
                              value={q.id}
                              title={q.question_text}
                            >
                              <span className="line-clamp-2 text-left">
                                {q.question_text}
                              </span>
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={
                        isPending ||
                        series.length === 0 ||
                        csvExporting ||
                        !twoQuestionPairCsvValid
                      }
                      onClick={() => void downloadMatrixCsvTwoQuestions()}
                    >
                      <Download className="h-4 w-4 mr-1.5" />
                      まとめてCSV（2質問）
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={
                        isPending ||
                        csvExporting ||
                        !selectedSurveyIdForCsv ||
                        series.length === 0 ||
                        !twoQuestionPairCsvValid
                      }
                      onClick={() => void downloadSingleMonthTwoQuestionsCsv()}
                    >
                      <Download className="h-4 w-4 mr-1.5" />
                      単月CSV（2質問）
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th
                      scope="col"
                      className="sticky left-0 z-[1] bg-muted/95 py-2.5 px-3 text-left font-medium min-w-[10rem] whitespace-nowrap backdrop-blur-sm"
                    >
                      指標
                    </th>
                    {months.map((m) => (
                      <th
                        key={m}
                        scope="col"
                        className="py-2.5 px-3 text-center font-medium tabular-nums whitespace-nowrap min-w-[5rem]"
                      >
                        {m}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {ENPS_MATRIX_METRICS.map((row, ri) => (
                    <tr
                      key={row.key}
                      className={ri % 2 === 0 ? "bg-muted/25" : ""}
                    >
                      <td className="sticky left-0 z-[1] bg-muted/95 py-2 px-3 font-medium whitespace-nowrap backdrop-blur-sm">
                        {row.label}
                      </td>
                      {series.map((s) => (
                        <td
                          key={`${row.key}-${s.survey_id}`}
                          className="py-2 px-3 text-center tabular-nums"
                        >
                          {row.format(s)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {isPending ? (
        <p className="text-xs text-muted-foreground">更新中…</p>
      ) : null}
    </div>
  );
}
