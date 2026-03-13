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

const chartConfig = {
  missions: {
    color: "hsl(var(--chart-1))",
    label: "投稿数",
  },
} satisfies ChartConfig;

function labelFor(date: string, period: "weekly" | "monthly"): string {
  const parsed = parseISO(date);
  return period === "weekly"
    ? format(parsed, "M/d(EEE)", { locale: ja })
    : format(parsed, "M/d", { locale: ja });
}

export function MissionsChart({ data, period }: MissionsChartProps) {
  const chartData = data.map((item) => ({
    dateLabel: labelFor(item.date, period),
    missions: item.count,
  }));

  return (
    <ChartContainer config={chartConfig} className="min-h-[280px] w-full">
      <BarChart data={chartData}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="dateLabel"
          tickLine={false}
          axisLine={false}
          minTickGap={20}
        />
        <YAxis
          allowDecimals={false}
          tickLine={false}
          axisLine={false}
          width={36}
        />
        <ChartTooltip content={<ChartTooltipContent hideLabel />} />
        <Bar
          dataKey="missions"
          radius={[6, 6, 0, 0]}
          fill="hsl(var(--chart-1))"
          name="投稿数"
        />
      </BarChart>
    </ChartContainer>
  );
}
