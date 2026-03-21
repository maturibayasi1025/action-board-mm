"use client";

import type { LinkedPostMissionContext } from "@/app/(protected)/surveys/_lib/linked-post-mission.types";
import { SurveyForm } from "@/components/enps/SurveyForm";
import { SurveyPostMissionDialog } from "@/components/survey/SurveyPostMissionDialog";
import type { User } from "@supabase/supabase-js";
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
  authUser: User | null;
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
      router.refresh();
      if (shouldOfferMission) {
        setPostMissionOpen(true);
      } else {
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
      {linkedPostMission && authUser && (
        <SurveyPostMissionDialog
          open={postMissionOpen}
          onOpenChange={setPostMissionOpen}
          mission={linkedPostMission.mission}
          authUser={authUser}
          userAchievementCount={linkedPostMission.userAchievementCount}
        />
      )}
    </>
  );
}
