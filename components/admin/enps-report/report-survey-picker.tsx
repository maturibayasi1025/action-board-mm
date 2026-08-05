"use client";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

export type PickerOption = { value: string; label: string };

/**
 * 対象月やスコア質問の切り替え。選択値は URL クエリに載せるので、
 * 画面をそのまま共有・ブックマークできる。
 */
export function ReportQueryPicker({
  id,
  label,
  paramName,
  value,
  options,
  className,
}: {
  id: string;
  label: string;
  paramName: string;
  value: string;
  options: PickerOption[];
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const onChange = (next: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set(paramName, next);
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  };

  return (
    <div className={className ?? "space-y-2 min-w-[12rem] flex-1 sm:max-w-md"}>
      <Label htmlFor={id}>{label}</Label>
      <Select value={value} onValueChange={onChange} disabled={isPending}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem
              key={option.value}
              value={option.value}
              title={option.label}
            >
              <span className="line-clamp-2 text-left">{option.label}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
