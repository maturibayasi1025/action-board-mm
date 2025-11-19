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
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Supabase environment variables are required");
}

const supabase = createBrowserClient<Database>(supabaseUrl, supabaseAnonKey);

export function LikeButton({
  missionId,
  initialLiked,
  initialCount,
  onLikeChange,
}: LikeButtonProps) {
  const [isLiked, setIsLiked] = useState(initialLiked);
  const [likesCount, setLikesCount] = useState(initialCount);
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = async () => {
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

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleClick}
      disabled={isLoading}
      className={cn(
        "flex items-center gap-2 transition-colors",
        isLiked && "text-red-500 hover:text-red-600",
      )}
    >
      <Heart className={cn("h-4 w-4", isLiked && "fill-current")} />
      <span>{likesCount}</span>
    </Button>
  );
}
