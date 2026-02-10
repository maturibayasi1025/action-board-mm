"use client";

import { SurveyForm } from "@/components/enps/SurveyForm";
import { useRouter } from "next/navigation";
import { useState } from "react";
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
}

export function SurveyFormClient({
  surveyId,
  questions,
  existingResponses,
}: SurveyFormClientProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (
    responses: Array<{
      question_id: string;
      score_value?: number | null;
      text_value?: string | null;
    }>,
  ) => {
    setIsSubmitting(true);
    try {
      await submitSurveyResponse(surveyId, responses);
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
    <SurveyForm
      surveyId={surveyId}
      questions={questions}
      existingResponses={existingResponses}
      onSubmit={handleSubmit}
      disabled={isSubmitting}
    />
  );
}
