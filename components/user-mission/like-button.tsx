"use client";

import { Button } from "@/components/ui/button";
import type { Database } from "@/lib/types/supabase";
import { cn } from "@/lib/utils/utils";
import { createBrowserClient } from "@supabase/ssr";
import { Heart } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

// 型定義を追加
interface LikeButtonProps {
  missionId: string;
  initialLiked: boolean;
  initialCount: number;
  onLikeChange?: (liked: boolean, count: number) => void;
  isOwnMission?: boolean;
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Supabase environment variables are required");
}

// Supabaseクライアントを作成
// ブラウザクライアントを作成するためにcreateBrowserClientを使用
const supabase = createBrowserClient<Database>(supabaseUrl, supabaseAnonKey);

// LikeButtonコンポーネントを定義
// いいねボタンの表示とクリック処理を行うß
export function LikeButton({
  missionId,
  initialLiked,
  initialCount,
  onLikeChange,
  isOwnMission = false,
}: LikeButtonProps) {
  const [isLiked, setIsLiked] = useState(initialLiked);
  const [likesCount, setLikesCount] = useState(initialCount);
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = async () => {
    // 自分のグッジョブの場合は処理をスキップ
    if (isOwnMission) {
      return;
    }

    setIsLoading(true);
    try {
      // 現在のセッションを取得
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        toast.error("ログインが必要です");
        return;
      }

      // APIルートを呼び出し
      const response = await fetch("/api/user-missions/toggle-like", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ missionId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "エラーが発生しました");
      }

      const result = await response.json();
      const newLiked = result.liked;

      setIsLiked(newLiked);
      const newCount = newLiked ? likesCount + 1 : likesCount - 1;
      setLikesCount(newCount);

      if (onLikeChange) {
        onLikeChange(newLiked, newCount);
      }

      toast.success(
        newLiked ? "いいね！しました" : "いいね！を取り消しました",
        {
          description: newLiked ? "+1XP獲得！" : "-1XP",
          className: "bg-card text-gray-900 border border-border",
        },
      );
    } catch (error) {
      console.error("いいね処理エラー:", error);
      const message =
        error instanceof Error ? error.message : "いいねの処理に失敗しました";
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const isRainbow = likesCount > 10;
  const uniqueId = `rainbow-gradient-${missionId}`;

  return (
    <>
      {/* SVGグラデーション定義（虹色効果用） */}
      {isRainbow && (
        <svg width="0" height="0" className="absolute" aria-hidden="true">
          <defs>
            <linearGradient id={uniqueId} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#FFD700" />
              <stop offset="14.28%" stopColor="#FFA500" />
              <stop offset="28.57%" stopColor="#FFD4A3" />
              <stop offset="42.85%" stopColor="#FFB347" />
              <stop offset="57.14%" stopColor="#FFE4B5" />
              <stop offset="71.42%" stopColor="#F0E68C" />
              <stop offset="85.71%" stopColor="#FF8C00" />
              <stop offset="100%" stopColor="#FFD700" />
            </linearGradient>
          </defs>
        </svg>
      )}
      <Button
        variant="outline"
        size="sm"
        onClick={handleClick}
        disabled={isLoading || isOwnMission}
        className={cn(
          "flex items-center gap-2 transition-colors w-full md:w-auto",
          isLiked && !isRainbow && "text-red-500 hover:text-red-600",
          isOwnMission && "opacity-50 cursor-not-allowed",
        )}
      >
        <Heart
          className={cn(
            "h-4 w-4 transition-all",
            isLiked && "fill-current",
            isRainbow && "animate-rainbow-glow",
          )}
          style={
            isRainbow && isLiked
              ? {
                  fill: `url(#${uniqueId})`,
                  filter:
                    "drop-shadow(0 0 4px rgba(255, 215, 0, 0.4)) drop-shadow(0 0 8px rgba(255, 165, 0, 0.3)) drop-shadow(0 0 12px rgba(255, 212, 163, 0.2))",
                }
              : undefined
          }
        />
        <span>{likesCount}</span>
      </Button>
    </>
  );
}
