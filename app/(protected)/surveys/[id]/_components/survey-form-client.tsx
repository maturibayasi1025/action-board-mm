"use client";

import type { LinkedPostMissionContext } from "@/app/(protected)/surveys/_lib/linked-post-mission.types";
import { SurveyForm } from "@/components/enps/SurveyForm";
import { SurveyPostMissionDialog } from "@/components/survey/SurveyPostMissionDialog";
import type { SerializableAuthUser } from "@/lib/auth/serializable-user";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { submitSurveyResponse } from "../actions";

interface Question {
  id: string;
  question_text: string;
  question_type: "score_0_10" | "text";
  display_order: number;
  is_required: boolean;
  parent_question_id: string | null;
}

interface SurveyFormClientProps {
  surveyId: string;
  questions: Question[];
  existingResponses: Record<
    string,
    {
      question_id: string;
      score_value?: number | null;
      text_value?: string | null;
    }
  >;
  linkedPostMission: LinkedPostMissionContext | null;
  isFirstTimeResponse: boolean;
  authUser: SerializableAuthUser | null;
}

export function SurveyFormClient({
  surveyId,
  questions,
  existingResponses,
  linkedPostMission,
  isFirstTimeResponse,
  authUser,
}: SurveyFormClientProps) {
  const router = useRouter();
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

  const handleSubmit = async (
    responses: Array<{
      question_id: string;
      score_value?: number | null;
      text_value?: string | null;
    }>,
  ) => {
    const shouldOfferMission =
      isFirstTimeResponse && linkedPostMission !== null && authUser !== null;

    setIsSubmitting(true);
    try {
      await submitSurveyResponse(surveyId, responses);
      if (shouldOfferMission && linkedPostMission) {
        setPostSubmitMissionContext(linkedPostMission);
        setPostMissionOpen(true);
      }
      router.refresh();
      if (!shouldOfferMission) {
        toast.success("回答を送信しました。ありがとうございます！");
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
      <SurveyForm
        surveyId={surveyId}
        questions={questions}
        existingResponses={existingResponses}
        onSubmit={handleSubmit}
        disabled={isSubmitting}
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
