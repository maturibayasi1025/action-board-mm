"use client";

import { Button } from "@/components/ui/button";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

export type DashboardPeriod = "weekly" | "monthly";

interface DashboardPeriodToggleProps {
  defaultPeriod: DashboardPeriod;
}

const periodOptions = [
  { label: "週次", value: "weekly" as const },
  { label: "月次", value: "monthly" as const },
] as const;

export function DashboardPeriodToggle({
  defaultPeriod,
}: DashboardPeriodToggleProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentPeriod =
    (searchParams.get("period") as DashboardPeriod) ?? defaultPeriod;

  const onPeriodChange = useCallback(
    (period: DashboardPeriod) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("period", period);
      const query = params.toString();
      router.push(`${pathname}${query ? `?${query}` : ""}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  return (
    <div className="mx-auto flex max-w-fit gap-1 rounded-lg bg-gray-100 p-1">
      {periodOptions.map((option) => (
        <Button
          key={option.value}
          variant={currentPeriod === option.value ? "default" : "ghost"}
          size="sm"
          onClick={() => onPeriodChange(option.value)}
          className={
            currentPeriod === option.value
              ? "bg-teal-600 text-white hover:bg-teal-700"
              : "text-gray-700 hover:bg-gray-200 hover:text-gray-900"
          }
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}
