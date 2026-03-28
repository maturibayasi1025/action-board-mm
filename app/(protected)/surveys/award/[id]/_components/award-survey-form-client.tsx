"use client";

import type { LinkedPostMissionContext } from "@/app/(protected)/surveys/_lib/linked-post-mission.types";
import type {
  AwardQuestion,
  AwardResponse,
} from "@/app/(protected)/surveys/award/[id]/actions";
import { submitAwardResponse } from "@/app/(protected)/surveys/award/[id]/actions";
import { AwardSurveyForm } from "@/components/award/AwardSurveyForm";
import { SurveyPostMissionDialog } from "@/components/survey/SurveyPostMissionDialog";
import type { SerializableAuthUser } from "@/lib/auth/serializable-user";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

interface AwardSurveyFormClientProps {
  surveyId: string;
  questions: AwardQuestion[];
  existingResponses: Record<string, AwardResponse>;
  userName: string | null;
  linkedPostMission: LinkedPostMissionContext | null;
  isFirstTimeResponse: boolean;
  authUser: SerializableAuthUser | null;
}

export function AwardSurveyFormClient({
  surveyId,
  questions,
  existingResponses,
  userName,
  linkedPostMission,
  isFirstTimeResponse,
  authUser,
}: AwardSurveyFormClientProps) {
  const router = useRouter();
  const isUpdate = Object.keys(existingResponses).length > 0;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [postMissionOpen, setPostMissionOpen] = useState(false);
  /** refresh 後はサーバーが linkedPostMission を渡さなくなるため、初回送信直後の文脈を保持する */
  const [postSubmitMissionContext, setPostSubmitMissionContext] =
    useState<LinkedPostMissionContext | null>(null);

  const missionDialogContext = postSubmitMissionContext ?? linkedPostMission;

  const handlePostMissionOpenChange = (open: boolean) => {
    setPostMissionOpen(open);
    if (!open) {
      setPostSubmitMissionContext(null);
    }
  };

  const handleSubmit = async (responses: AwardResponse[]) => {
    const shouldOfferMission =
      isFirstTimeResponse && linkedPostMission !== null && authUser !== null;

    setIsSubmitting(true);
    try {
      await submitAwardResponse(surveyId, responses);
      if (shouldOfferMission && linkedPostMission) {
        setPostSubmitMissionContext(linkedPostMission);
        setPostMissionOpen(true);
      }
      router.refresh();
      if (!shouldOfferMission) {
        toast.success(
          isUpdate
            ? "回答を更新しました。ありがとうございます！"
            : "回答を送信しました。ありがとうございます！",
        );
      }
    } catch (error) {
      console.error("回答の送信に失敗しました:", error);
      toast.error(
        error instanceof Error ? error.message : "回答の送信に失敗しました",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <AwardSurveyForm
        surveyId={surveyId}
        questions={questions}
        existingResponses={existingResponses}
        userName={userName}
        onSubmit={handleSubmit}
        disabled={isSubmitting}
        isUpdate={isUpdate}
      />
      {missionDialogContext && authUser && (
        <SurveyPostMissionDialog
          open={postMissionOpen}
          onOpenChange={handlePostMissionOpenChange}
          mission={missionDialogContext.mission}
          authUser={authUser}
          alreadyRecordedInActiveSurveyPeriod={
            missionDialogContext.alreadyRecordedInActiveSurveyPeriod
          }
        />
      )}
    </>
  );
}
