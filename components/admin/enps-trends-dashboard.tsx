"use client";

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
import { Input } from "@/components/ui/input";
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
}: {
  questions: ScoreQuestion[];
  initialQuestionId: string;
  initialSeries: EnpsMonthlyPoint[];
}) {
  const [questionId, setQuestionId] = useState(initialQuestionId);
  const [series, setSeries] = useState<EnpsMonthlyPoint[]>(initialSeries);
  const [companyInput, setCompanyInput] = useState("");
  const [buInput, setBuInput] = useState("");
  const [appliedOrg, setAppliedOrg] = useState<EnpsOrgFilter | null>(null);
  const [isPending, startTransition] = useTransition();

  const load = useCallback((qid: string, org: EnpsOrgFilter | null) => {
    startTransition(async () => {
      const data = await getEnpsMonthlyTrendsForQuestion(qid, org);
      setSeries(data);
    });
  }, []);

  const onQuestionChange = (value: string) => {
    setQuestionId(value);
    load(value, appliedOrg);
  };

  const onApplyOrgFilter = () => {
    const org: EnpsOrgFilter | null =
      companyInput.trim() && buInput.trim()
        ? {
            companyName: companyInput.trim(),
            businessUnitName: buInput.trim(),
          }
        : null;
    setAppliedOrg(org);
    load(questionId, org);
  };

  const onClearOrgFilter = () => {
    setCompanyInput("");
    setBuInput("");
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
          両方入力したときのみ適用します。空のまま「絞り込みを解除」で全体に戻します。
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="space-y-1.5 min-w-[10rem] flex-1 sm:max-w-xs">
            <Label htmlFor="enps-trends-co">会社名（完全一致・trim後）</Label>
            <Input
              id="enps-trends-co"
              value={companyInput}
              onChange={(e) => setCompanyInput(e.target.value)}
              placeholder="例: 株式会社Party"
            />
          </div>
          <div className="space-y-1.5 min-w-[10rem] flex-1 sm:max-w-xs">
            <Label htmlFor="enps-trends-bu">事業部名（完全一致・trim後）</Label>
            <Input
              id="enps-trends-bu"
              value={buInput}
              onChange={(e) => setBuInput(e.target.value)}
              placeholder="例: epSES"
            />
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={isPending}
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
            現在: {appliedOrg.companyName} / {appliedOrg.businessUnitName}
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
