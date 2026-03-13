"use client";

import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { format, parseISO } from "date-fns";
import { ja } from "date-fns/locale";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

interface MissionsChartItem {
  count: number;
  date: string;
}

interface MissionsChartProps {
  data: MissionsChartItem[];
  period: "weekly" | "monthly";
}

function labelFor(date: string, period: "weekly" | "monthly"): string {
  const parsed = parseISO(date);
  return period === "weekly"
    ? format(parsed, "M/d(EEE)", { locale: ja })
    : format(parsed, "M/d", { locale: ja });
}

const chartConfig = {
  missions: {
    color: "hsl(var(--chart-1))",
    label: "投稿数",
  },
} satisfies ChartConfig;

export function MissionsChart({ data, period }: MissionsChartProps) {
  const chartData = data.map((item) => ({
    dateLabel: labelFor(item.date, period),
    missions: item.count,
  }));

  return (
    <ChartContainer config={chartConfig} className="min-h-[280px] w-full">
      <BarChart data={chartData}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis
          dataKey="dateLabel"
          tickLine={false}
          axisLine={false}
          minTickGap={20}
          tick={{ fontSize: 12 }}
        />
        <YAxis
          allowDecimals={false}
          tickLine={false}
          axisLine={false}
          width={36}
          tick={{ fontSize: 12 }}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value) => [
                `${Number(value).toLocaleString()} 件`,
                "投稿数",
              ]}
              hideLabel
            />
          }
        />
        <Bar
          dataKey="missions"
          radius={[6, 6, 0, 0]}
          fill="var(--color-missions)"
          name="投稿数"
        />
      </BarChart>
    </ChartContainer>
  );
}
