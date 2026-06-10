"use client";

import { cn, getLevelProgress, getXpToNextLevel } from "@/lib/utils/utils";
import React from "react";

interface ProgressBarSimpleProps {
  currentXp: number;
  className?: string;
  showText?: boolean;
}

export function ProgressBarSimple({
  currentXp,
  className,
  showText = true,
}: ProgressBarSimpleProps) {
  const xpToNextLevel = getXpToNextLevel(currentXp);
  const progressPercentage = getLevelProgress(currentXp) * 100;

  return (
    <div className={cn("w-full", className)}>
      {showText && (
        <div className="mb-2 flex min-w-0 flex-wrap items-baseline gap-x-1 text-sm">
          <span className="shrink-0">次のレベルまで</span>
          <span className="min-w-0 break-words font-bold">
            {Math.round(xpToNextLevel).toLocaleString()}
            ポイント🔥
          </span>
        </div>
      )}
      <div className="w-full bg-gray-200 rounded-full h-3 shadow-inner">
        <div
          className="bg-gradient-to-r from-[#F0DC00] to-[#FFE800] h-3 rounded-full shadow-sm"
          style={{ width: `${progressPercentage}%` }}
        />
      </div>
    </div>
  );
}
