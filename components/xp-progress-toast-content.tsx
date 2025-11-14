"use client";

import { markLevelUpSeenAction } from "@/app/actions/level-up";
import { calculateLevel, getXpToNextLevel, totalXp } from "@/lib/utils/utils";
import React, { useEffect, useState } from "react";
import { LevelUpDialog } from "./level-up-dialog";
import { ProgressBarAnimated } from "./ui/progress-bar-animated";

interface XpProgressToastContentProps {
  initialXp: number;
  xpGained: number;
  onLevelUp?: (newLevel: number) => void;
  onAnimationComplete: () => void;
}

export function XpProgressToastContent({
  initialXp,
  xpGained,
  onLevelUp,
  onAnimationComplete,
}: XpProgressToastContentProps) {
  const [showFinalState, setShowFinalState] = useState(false);
  const [levelState, setLevelState] = useState({
    currentLevel: calculateLevel(initialXp),
    currentXp: initialXp,
    currentXpGained: xpGained,
  });

  // XPアニメーション関連の状態
  const [levelUpData, setLevelUpData] = useState<{
    newLevel: number;
    pointsToNextLevel: number;
  } | null>(null);

  // アニメーション完了後、3秒でToast閉じ
  useEffect(() => {
    if (showFinalState) {
      const timer = setTimeout(() => {
        onAnimationComplete();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [showFinalState, onAnimationComplete]);

  // 現在のレベルでの進捗を計算
  const { currentLevel, currentXp, currentXpGained } = levelState;
  const currentLevelStartXp = totalXp(currentLevel);
  const nextLevelTotalXp = totalXp(currentLevel + 1);
  const startXp = currentXp;
  const endXp =
    startXp + currentXpGained > nextLevelTotalXp
      ? nextLevelTotalXp
      : startXp + currentXpGained;
  const pointsToNextLevel = getXpToNextLevel(endXp);

  // レベルアップ処理
  const handleLevelUp = (newLevel: number) => {
    // 次の次のレベルまで上がるならそのままアニメーション継続
    const newNextLevelXp = totalXp(newLevel + 1);
    if (startXp + currentXpGained > newNextLevelXp) {
      const xpUsed = endXp - startXp;
      setLevelState({
        currentLevel: newLevel,
        currentXp: endXp,
        currentXpGained: currentXpGained - xpUsed,
      });
      return;
    }

    if (onLevelUp) {
      onLevelUp(newLevel);
    }
    setLevelUpData({
      newLevel,
      pointsToNextLevel,
    });
  };

  // レベルアップダイアログを閉じる
  const handleLevelUpDialogClose = async () => {
    setLevelUpData(null);

    // レベルアップ通知を確認済みとしてマーク
    try {
      const result = await markLevelUpSeenAction();
      if (!result.success) {
        console.error(
          "Failed to mark level up notification as seen:",
          result.error,
        );
      }
    } catch (error) {
      console.error("Error marking level up notification as seen:", error);
    }

    const xpUsed = endXp - startXp;
    setLevelState({
      currentLevel: levelState.currentLevel + 1,
      currentXp: endXp,
      currentXpGained: currentXpGained - xpUsed,
    });
  };

  return (
    <>
      <div className="p-6">
        <div className="text-center mb-4">
          <h3 className="text-lg font-bold text-foreground mb-2">
            {xpGained}ポイント獲得しました！
          </h3>
        </div>

        <ProgressBarAnimated
          zeroValue={currentLevelStartXp}
          maxValue={nextLevelTotalXp}
          startValue={startXp}
          endValue={endXp}
          className="mb-4"
          showText={false}
          animationDuration={1000}
          onAnimationComplete={() => {
            if (endXp >= nextLevelTotalXp) {
              const newLevel = currentLevel + 1;
              handleLevelUp(newLevel);
            } else {
              setShowFinalState(true);
            }
          }}
        />

        <div className="text-center">
          <div className="text-xs text-foreground/80">
            レベル {currentLevel}
            {showFinalState && (
              <span> • 次のレベルまで{pointsToNextLevel}ポイント🔥</span>
            )}
          </div>
        </div>
      </div>

      {levelUpData && (
        <LevelUpDialog
          isOpen={levelUpData !== null}
          onClose={handleLevelUpDialogClose}
          newLevel={levelUpData.newLevel}
        />
      )}
    </>
  );
}
