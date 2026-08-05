"use client";

import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import type { CompanyTrendPoint } from "@/lib/admin/enps-report/comparison";
import { useMemo } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  XAxis,
  YAxis,
} from "recharts";

const chartConfig = {
  respondentBase: {
    color: "hsl(var(--chart-1))",
    label: "eNPS（回答者ベース）",
  },
  imputedBase: {
    color: "hsl(var(--chart-2))",
    label: "eNPS（未回答0点補完）",
  },
  responseRate: {
    color: "hsl(var(--muted-foreground))",
    label: "回答率(%)",
  },
} satisfies ChartConfig;

/**
 * 回答者ベースと未回答0点補完を重ねて描く。
 * 両者の開きは回答率の低さに由来するので、回答率を背面の棒で並置して切り分けられるようにする。
 */
export function CompanyTrendChart({ trend }: { trend: CompanyTrendPoint[] }) {
  const data = useMemo(
    () =>
      trend.map((point) => ({
        monthLabel: point.year_month,
        respondentBase: point.nps_respondent_base,
        imputedBase: point.nps_imputed_base,
        responseRate: point.response_rate,
      })),
    [trend],
  );

  if (data.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        表示できる月次データがありません。
      </p>
    );
  }

  return (
    <ChartContainer
      config={chartConfig}
      className="block aspect-auto h-[260px] w-full max-w-full [&_.recharts-responsive-container]:h-full"
    >
      <ComposedChart data={data} margin={{ left: 8, right: 8 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis
          dataKey="monthLabel"
          tickLine={false}
          axisLine={false}
          minTickGap={16}
          tick={{ fontSize: 11 }}
        />
        <YAxis
          yAxisId="nps"
          tickLine={false}
          axisLine={false}
          width={44}
          tick={{ fontSize: 12 }}
        />
        <YAxis
          yAxisId="rate"
          orientation="right"
          domain={[0, 100]}
          tickLine={false}
          axisLine={false}
          width={40}
          tick={{ fontSize: 11 }}
        />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Bar
          yAxisId="rate"
          dataKey="responseRate"
          fill="var(--color-responseRate)"
          fillOpacity={0.15}
          name="回答率(%)"
          barSize={18}
        />
        <Line
          yAxisId="nps"
          dataKey="respondentBase"
          type="monotone"
          stroke="var(--color-respondentBase)"
          strokeWidth={2}
          connectNulls
          dot={{ fill: "var(--color-respondentBase)", r: 3 }}
          name="eNPS（回答者ベース）"
        />
        <Line
          yAxisId="nps"
          dataKey="imputedBase"
          type="monotone"
          stroke="var(--color-imputedBase)"
          strokeWidth={2}
          strokeDasharray="4 3"
          connectNulls
          dot={{ fill: "var(--color-imputedBase)", r: 3 }}
          name="eNPS（未回答0点補完）"
        />
      </ComposedChart>
    </ChartContainer>
  );
}

const segmentChartConfig = {
  promoters: { color: "hsl(142 76% 36%)", label: "推奨（9-10）" },
  passives: { color: "hsl(32 95% 44%)", label: "中立（7-8）" },
  detractors: { color: "hsl(0 72% 51%)", label: "批判（0-6）" },
} satisfies ChartConfig;

export function SegmentCompositionChart({
  trend,
}: {
  trend: CompanyTrendPoint[];
}) {
  const data = useMemo(
    () =>
      trend.map((point) => ({
        monthLabel: point.year_month,
        promoters: point.promoters,
        passives: point.passives,
        detractors: point.detractors,
      })),
    [trend],
  );

  if (data.length === 0) {
    return null;
  }

  return (
    <ChartContainer
      config={segmentChartConfig}
      className="block aspect-auto h-[220px] w-full max-w-full [&_.recharts-responsive-container]:h-full"
    >
      <ComposedChart data={data} margin={{ left: 8, right: 8 }}>
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
        <ChartTooltip content={<ChartTooltipContent />} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Bar
          dataKey="promoters"
          stackId="segment"
          fill="var(--color-promoters)"
          name="推奨（9-10）"
        />
        <Bar
          dataKey="passives"
          stackId="segment"
          fill="var(--color-passives)"
          name="中立（7-8）"
        />
        <Bar
          dataKey="detractors"
          stackId="segment"
          fill="var(--color-detractors)"
          name="批判（0-6）"
        />
      </ComposedChart>
    </ChartContainer>
  );
}
