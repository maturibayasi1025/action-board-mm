"use client";

import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { format, parseISO } from "date-fns";
import { ja } from "date-fns/locale";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

interface LikesChartItem {
  count: number;
  date: string;
}

interface LikesChartProps {
  data: LikesChartItem[];
  period: "weekly" | "monthly";
}

const chartConfig = {
  likes: {
    color: "hsl(var(--chart-2))",
    label: "いいね数",
  },
} satisfies ChartConfig;

function labelFor(date: string, period: "weekly" | "monthly"): string {
  const parsed = parseISO(date);
  return period === "weekly"
    ? format(parsed, "M/d(EEE)", { locale: ja })
    : format(parsed, "M/d", { locale: ja });
}

export function LikesChart({ data, period }: LikesChartProps) {
  const chartData = data.map((item) => ({
    dateLabel: labelFor(item.date, period),
    likes: item.count,
  }));

  return (
    <ChartContainer config={chartConfig} className="min-h-[280px] w-full">
      <LineChart data={chartData}>
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
        <Line
          dataKey="likes"
          type="monotone"
          stroke="hsl(var(--chart-2))"
          strokeWidth={2}
          dot={{ fill: "hsl(var(--chart-2))", r: 3 }}
          activeDot={{ r: 5 }}
          name="いいね数"
        />
      </LineChart>
    </ChartContainer>
  );
}
