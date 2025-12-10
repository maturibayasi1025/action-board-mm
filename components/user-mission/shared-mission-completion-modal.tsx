"use client";

import { completeSharedMissionAction } from "@/app/(protected)/user-missions/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DifficultyBadge } from "@/components/ui/difficulty-badge";
import { MissionIcon } from "@/components/ui/mission-icon";
import { useState } from "react";
import { toast } from "sonner";

interface SharedMission {
  id: string;
  title: string;
  icon_url: string | null;
  difficulty: number;
  content: string | null;
}

interface SharedMissionCompletionModalProps {
  isOpen: boolean;
  onClose: () => void;
  missions: SharedMission[];
}

export function SharedMissionCompletionModal({
  isOpen,
  onClose,
  missions,
}: SharedMissionCompletionModalProps) {
  const [completingMissionIds, setCompletingMissionIds] = useState<Set<string>>(
    new Set(),
  );

  const handleComplete = async (missionId: string) => {
    if (completingMissionIds.has(missionId)) {
      return; // 既に処理中
    }

    setCompletingMissionIds((prev) => new Set(prev).add(missionId));

    try {
      const result = await completeSharedMissionAction(missionId);

      if (result.success) {
        toast.success(result.message || "共有グッジョブを完了しました！", {
          description:
            result.xpGranted && result.xpGranted > 0
              ? `+${result.xpGranted}XP獲得`
              : undefined,
        });
        // 完了したグッジョブをリストから削除（UI更新）
        // モーダルを閉じる必要はない（複数のグッジョブを完了できるため）
      } else {
        toast.error(result.error || "共有グッジョブの完了に失敗しました");
      }
    } catch (error) {
      console.error("共有グッジョブ完了エラー:", error);
      toast.error("予期しないエラーが発生しました");
    } finally {
      setCompletingMissionIds((prev) => {
        const next = new Set(prev);
        next.delete(missionId);
        return next;
      });
    }
  };

  if (missions.length === 0) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>共有グッジョブを完了できます</DialogTitle>
          <DialogDescription>
            今日初めてのグッジョブ投稿おめでとうございます！
            <br />
            以下の共有グッジョブを完了できます。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 mt-4">
          {missions.map((mission) => {
            const isCompleting = completingMissionIds.has(mission.id);
            const iconUrl = mission.icon_url ?? "/img/mission_fallback.svg";

            return (
              <div
                key={mission.id}
                className="flex items-start gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex-shrink-0">
                  <div className="w-16 h-16 rounded-full border-4 border-muted-foreground/25 flex items-center justify-center overflow-hidden">
                    <MissionIcon src={iconUrl} alt={mission.title} size="md" />
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-lg mb-1">
                        {mission.title}
                      </h3>
                      {mission.content && (
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {mission.content}
                        </p>
                      )}
                    </div>
                    <DifficultyBadge difficulty={mission.difficulty} />
                  </div>

                  <div className="mt-3 flex justify-end">
                    <Button
                      onClick={() => handleComplete(mission.id)}
                      disabled={isCompleting}
                      size={"sm" as const}
                    >
                      {isCompleting ? "完了中..." : "完了する"}
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex justify-end mt-6">
          <Button variant="outline" onClick={onClose}>
            閉じる
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
