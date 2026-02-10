"use client";

import { cn } from "@/lib/utils/utils";
import * as React from "react";

interface ScoreSelectorProps {
  value?: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  required?: boolean;
}

export function ScoreSelector({
  value,
  onChange,
  disabled = false,
  required = false,
}: ScoreSelectorProps) {
  const scores = Array.from({ length: 11 }, (_, i) => i); // 0-10

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        {scores.map((score) => (
          <label
            key={score}
            className={cn(
              "flex flex-col items-center gap-1 cursor-pointer",
              disabled && "cursor-not-allowed opacity-50",
            )}
          >
            <input
              type="radio"
              name="score"
              value={score}
              checked={value === score}
              onChange={() => !disabled && onChange(score)}
              disabled={disabled}
              required={required}
              className="sr-only"
            />
            <div
              className={cn(
                "w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all",
                value === score
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-gray-300 bg-white hover:border-primary/50",
                disabled && "hover:border-gray-300",
              )}
            >
              <span className="text-sm font-medium">{score}</span>
            </div>
            {score === 0 && (
              <span className="text-xs text-muted-foreground">最低</span>
            )}
            {score === 10 && (
              <span className="text-xs text-muted-foreground">最高</span>
            )}
          </label>
        ))}
      </div>
    </div>
  );
}
