"use client";

import type {
  AwardQuestion,
  AwardResponse,
} from "@/app/(protected)/surveys/award/[id]/actions";
import { submitAwardResponse } from "@/app/(protected)/surveys/award/[id]/actions";
import { AwardSurveyForm } from "@/components/award/AwardSurveyForm";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface AwardSurveyFormClientProps {
  surveyId: string;
  questions: AwardQuestion[];
  existingResponses: Record<string, AwardResponse>;
  userName: string | null;
}

export function AwardSurveyFormClient({
  surveyId,
  questions,
  existingResponses,
  userName,
}: AwardSurveyFormClientProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (responses: AwardResponse[]) => {
    setIsSubmitting(true);
    try {
      await submitAwardResponse(surveyId, responses);
      router.refresh();
      alert("回答を送信しました。ありがとうございます！");
    } catch (error) {
      console.error("回答の送信に失敗しました:", error);
      alert(
        error instanceof Error ? error.message : "回答の送信に失敗しました",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AwardSurveyForm
      surveyId={surveyId}
      questions={questions}
      existingResponses={existingResponses}
      userName={userName}
      onSubmit={handleSubmit}
      disabled={isSubmitting}
    />
  );
}
