"use client";

import type {
  BusinessUnitRow,
  CompanyRow,
} from "@/app/(protected)/admin/business-units/actions";
import {
  type EnpsMonthlyPoint,
  type EnpsOrgFilter,
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
import { useCallback, useMemo, useState, useTransition } from "react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

const NONE_COMPANY = "__none_company";
const NONE_UNIT = "__none_unit";

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

  const matrixRows = useMemo(
    () => [
      {
        key: "nps",
        label: "eNPS",
        format: (s: EnpsMonthlyPoint) => formatNps(s.nps),
      },
      {
        key: "respondent_count",
        label: "回答者数（期限内・重複除く）",
        format: (s: EnpsMonthlyPoint) => String(s.respondent_count),
      },
      {
        key: "promoters",
        label: "推奨（9–10）",
        format: (s: EnpsMonthlyPoint) => String(s.promoters),
      },
      {
        key: "passives",
        label: "中立（7–8）",
        format: (s: EnpsMonthlyPoint) => String(s.passives),
      },
      {
        key: "detractors",
        label: "批判（0–6）",
        format: (s: EnpsMonthlyPoint) => String(s.detractors),
      },
    ],
    [],
  );

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
              className="min-h-[280px] w-full"
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

          <div className="space-y-2">
            <h3 className="text-sm font-medium">月次マトリクス</h3>
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
                  {matrixRows.map((row, ri) => (
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
