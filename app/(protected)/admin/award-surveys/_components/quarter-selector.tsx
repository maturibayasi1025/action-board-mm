"use client";

import {
  type AwardQuarterOption,
  quarterKey,
} from "@/app/(protected)/admin/award-surveys/quarterly-ranking-model";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useRouter, useSearchParams } from "next/navigation";

type QuarterSelectorProps = {
  options: AwardQuarterOption[];
  selectedYear: number;
  selectedQuarter: number;
};

export function QuarterSelector({
  options,
  selectedYear,
  selectedQuarter,
}: QuarterSelectorProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentValue = quarterKey(
    selectedYear,
    selectedQuarter as 1 | 2 | 3 | 4,
  );

  const handleChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    const [yearPart, qPart] = value.split("-Q");
    if (yearPart && qPart) {
      params.set("year", yearPart);
      params.set("q", qPart);
    } else {
      params.delete("year");
      params.delete("q");
    }
    const query = params.toString();
    router.push(
      query ? `/admin/award-surveys?${query}` : "/admin/award-surveys",
    );
  };

  if (options.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        集計可能な四半期がありません。
      </p>
    );
  }

  return (
    <Select value={currentValue} onValueChange={handleChange}>
      <SelectTrigger className="w-full max-w-xs" aria-label="四半期を選択">
        <SelectValue placeholder="四半期を選択" />
      </SelectTrigger>
      <SelectContent>
        {options.map((opt) => (
          <SelectItem
            key={quarterKey(opt.year, opt.quarter)}
            value={quarterKey(opt.year, opt.quarter)}
          >
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
