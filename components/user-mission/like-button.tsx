"use client";

import { toggleLikeAction } from "@/app/(protected)/user-missions/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/utils";
import { Heart } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface LikeButtonProps {
  missionId: string;
  initialLiked: boolean;
  initialCount: number;
  onLikeChange?: (liked: boolean, count: number) => void;
}

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
      const result = await toggleLikeAction(missionId);
      const newLiked = result.liked;

      // 楽観的更新ではなく、サーバーの結果に基づいて状態を更新
      setIsLiked(newLiked);

      // いいね数はサーバーの再検証により自動更新されるため、
      // ここではローカル状態の計算ではなく、一時的に楽観的更新を行う
      const newCount = newLiked ? likesCount + 1 : likesCount - 1;
      setLikesCount(newCount);

      if (onLikeChange) {
        onLikeChange(newLiked, newCount);
      }

      if (newLiked) {
        toast.success("いいね！しました", {
          description: "+1XP獲得！",
        });
      } else {
        toast.success("いいね！を取り消しました", {
          description: "-1XP",
        });
      }

      // ページ再読み込み後は、サーバーからの正確なデータが表示される
    } catch (error) {
      console.error("いいね処理エラー:", error);
      toast.error("いいねの処理に失敗しました");
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
