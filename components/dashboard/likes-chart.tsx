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

function labelFor(date: string, period: "weekly" | "monthly"): string {
  const parsed = parseISO(date);
  return period === "weekly"
    ? format(parsed, "M/d(EEE)", { locale: ja })
    : format(parsed, "M/d", { locale: ja });
}

const chartConfig = {
  likes: {
    color: "hsl(var(--chart-2))",
    label: "いいね数",
  },
} satisfies ChartConfig;

export function LikesChart({ data, period }: LikesChartProps) {
  const chartData = data.map((item) => ({
    dateLabel: labelFor(item.date, period),
    likes: item.count,
  }));

  return (
    <ChartContainer config={chartConfig} className="min-h-[280px] w-full">
      <LineChart data={chartData}>
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
                "いいね数",
              ]}
              hideLabel
            />
          }
        />
        <Line
          dataKey="likes"
          type="monotone"
          stroke="var(--color-likes)"
          strokeWidth={2}
          dot={{ fill: "var(--color-likes)", r: 3 }}
          activeDot={{ r: 5 }}
          name="いいね数"
        />
      </LineChart>
    </ChartContainer>
  );
}
