"use client";

import { MissionCompleteDialog } from "@/app/missions/[id]/_components/MissionCompleteDialog";
import { useMissionSubmission } from "@/app/missions/[id]/_hooks/useMissionSubmission";
import { achieveMissionAction } from "@/app/missions/[id]/actions";
import { ArtifactForm } from "@/components/mission/ArtifactForm";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { XpProgressToastContent } from "@/components/xp-progress-toast-content";
import { ARTIFACT_TYPES } from "@/lib/artifactTypes";
import type { Tables } from "@/lib/types/supabase";
import type { User } from "@supabase/supabase-js";
import { AlertCircle } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { toast } from "sonner";

const UNSUPPORTED_ARTIFACT_IN_SURVEY_DIALOG = new Set<string>([
  ARTIFACT_TYPES.QUIZ.key,
  ARTIFACT_TYPES.LINK_ACCESS.key,
  ARTIFACT_TYPES.REFERRAL.key,
]);

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mission: Tables<"missions">;
  authUser: User;
  userAchievementCount: number;
};

export function SurveyPostMissionDialog({
  open,
  onOpenChange,
  mission,
  authUser,
  userAchievementCount,
}: Props) {
  const { buttonLabel, hasReachedUserMaxAchievements } = useMissionSubmission(
    mission,
    userAchievementCount,
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [isCompleteDialogOpen, setIsCompleteDialogOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const [xpAnimationData, setXpAnimationData] = useState<{
    initialXp: number;
    xpGained: number;
  } | null>(null);

  const unsupported = UNSUPPORTED_ARTIFACT_IN_SURVEY_DIALOG.has(
    mission.required_artifact_type,
  );

  const handleXpAnimation = (result: {
    xpGranted?: number;
    userLevel?: { xp: number };
  }) => {
    if (result.xpGranted && result.userLevel) {
      const initialXp = result.userLevel.xp - result.xpGranted;
      setXpAnimationData({
        initialXp,
        xpGained: result.xpGranted,
      });
    }
  };

  const handleSubmit = async (formData: FormData) => {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const result = await achieveMissionAction(formData);

      if (result.success) {
        formRef.current?.reset();
        setFormKey((k) => k + 1);
        handleXpAnimation(result);
        onOpenChange(false);
        setIsCompleteDialogOpen(true);
      } else {
        setErrorMessage(result.error || "エラーが発生しました");
      }
    } catch (error) {
      console.error("Survey post mission submission error:", error);
      setErrorMessage("予期しないエラーが発生しました。");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCompleteDialogClose = () => {
    setIsCompleteDialogOpen(false);
    setErrorMessage(null);

    if (xpAnimationData) {
      toast.custom(
        (t) => (
          <XpProgressToastContent
            initialXp={xpAnimationData.initialXp}
            xpGained={xpAnimationData.xpGained}
            onAnimationComplete={() => {
              toast.dismiss(t);
              setXpAnimationData(null);
            }}
          />
        ),
        {
          duration: Number.POSITIVE_INFINITY,
          position: "bottom-center",
          className: "rounded-md bg-transparent border-0 shadow-none",
        },
      );
    }
  };

  const showForm = !unsupported && !hasReachedUserMaxAchievements;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto w-[calc(100vw-36px)] max-w-lg">
          <DialogHeader>
            <DialogTitle>グッジョブに記録しますか？</DialogTitle>
            <DialogDescription>
              アンケートへのご協力ありがとうございます。よろしければ、関連するグッジョブの達成を記録できます。
            </DialogDescription>
          </DialogHeader>

          {unsupported && (
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>
                このグッジョブはこの画面からは投稿できません。グッジョブ詳細ページから達成を記録してください。
              </p>
              <Button asChild className="w-full">
                <Link href={`/missions/${mission.id}`}>
                  グッジョブ詳細を開く
                </Link>
              </Button>
            </div>
          )}

          {!unsupported && hasReachedUserMaxAchievements && (
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>このグッジョブは既に達成済みです。</p>
              <Button asChild variant="outline" className="w-full">
                <Link href={`/missions/${mission.id}`}>
                  グッジョブ詳細を開く
                </Link>
              </Button>
            </div>
          )}

          {showForm && (
            <form
              ref={formRef}
              action={handleSubmit}
              className="flex flex-col gap-4"
            >
              <input type="hidden" name="missionId" value={mission.id} />
              <input
                type="hidden"
                name="requiredArtifactType"
                value={
                  mission.required_artifact_type ?? ARTIFACT_TYPES.NONE.key
                }
              />

              <ArtifactForm
                key={formKey}
                mission={mission}
                authUser={authUser}
                disabled={isSubmitting}
                submittedArtifactImagePath={null}
              />
              <SubmitButton
                pendingText="登録中..."
                size="lg"
                disabled={isSubmitting}
              >
                {buttonLabel}
              </SubmitButton>
              <p className="text-sm text-muted-foreground">
                ※
                成果物の内容が認められない場合、グッジョブの達成が取り消される場合があります。正確な内容をご記入ください。
              </p>
              {errorMessage && (
                <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg flex items-center">
                  <AlertCircle className="h-4 w-4 mr-2 shrink-0" />
                  {errorMessage}
                </div>
              )}
            </form>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => onOpenChange(false)}
            >
              スキップ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <MissionCompleteDialog
        isOpen={isCompleteDialogOpen}
        onClose={handleCompleteDialogClose}
        mission={mission}
      />
    </>
  );
}
