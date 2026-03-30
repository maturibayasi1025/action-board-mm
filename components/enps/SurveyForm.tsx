"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import { ScoreSelector } from "./ScoreSelector";

interface Question {
  id: string;
  question_text: string;
  question_type: "score_0_10" | "text";
  display_order: number;
  is_required: boolean;
  parent_question_id: string | null;
}

interface Response {
  question_id: string;
  score_value?: number | null;
  text_value?: string | null;
}

interface SurveyFormProps {
  surveyId: string;
  questions: Question[];
  existingResponses?: Record<string, Response>;
  onSubmit: (responses: Response[]) => Promise<void>;
  disabled?: boolean;
  /** 既に回答がある場合は true（ボタン文言が「更新」になる） */
  isUpdate?: boolean;
}

export function SurveyForm({
  surveyId,
  questions,
  existingResponses = {},
  onSubmit,
  disabled = false,
  isUpdate = false,
}: SurveyFormProps) {
  // 親質問がない質問を先に表示
  const rootQuestions = questions.filter((q) => !q.parent_question_id);
  const childQuestions = questions.filter((q) => q.parent_question_id);

  // 回答状態を管理
  const [responses, setResponses] = useState<Record<string, Response>>(() => {
    const initial: Record<string, Response> = {};
    for (const q of questions) {
      const existing = existingResponses[q.id];
      if (existing) {
        initial[q.id] = existing;
      } else {
        initial[q.id] = {
          question_id: q.id,
          score_value: null,
          text_value: null,
        };
      }
    }
    return initial;
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleScoreChange = (questionId: string, score: number) => {
    setResponses((prev) => ({
      ...prev,
      [questionId]: {
        ...prev[questionId],
        question_id: questionId,
        score_value: score,
        text_value: prev[questionId]?.text_value || null,
      },
    }));
  };

  const handleTextChange = (questionId: string, text: string) => {
    setResponses((prev) => ({
      ...prev,
      [questionId]: {
        ...prev[questionId],
        question_id: questionId,
        score_value: prev[questionId]?.score_value || null,
        text_value: text,
      },
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isSubmitting || disabled) {
      return;
    }

    // 必須項目のバリデーション
    const requiredQuestions = questions.filter((q) => q.is_required);
    for (const question of requiredQuestions) {
      const response = responses[question.id];
      if (!response) {
        alert(`${question.question_text} は必須項目です`);
        return;
      }
      if (
        question.question_type === "score_0_10" &&
        response.score_value === null
      ) {
        alert(`${question.question_text} は必須項目です`);
        return;
      }
      if (question.question_type === "text" && !response.text_value?.trim()) {
        alert(`${question.question_text} は必須項目です`);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const responseArray = Object.values(responses);
      await onSubmit(responseArray);
    } catch (error) {
      console.error("回答の送信に失敗しました:", error);
      alert("回答の送信に失敗しました。もう一度お試しください。");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getChildQuestion = (parentId: string) => {
    return childQuestions.find((q) => q.parent_question_id === parentId);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {rootQuestions
        .sort((a, b) => a.display_order - b.display_order)
        .map((question) => {
          const childQuestion = getChildQuestion(question.id);
          const response = responses[question.id];
          const childResponse = childQuestion
            ? responses[childQuestion.id]
            : null;

          return (
            <div key={question.id} className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">
                    {question.question_text}
                    {question.is_required && (
                      <span className="text-destructive ml-1">*</span>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {question.question_type === "score_0_10" && (
                    <ScoreSelector
                      name={`enps-score-${question.id}`}
                      value={response?.score_value ?? undefined}
                      onChange={(score) =>
                        handleScoreChange(question.id, score)
                      }
                      disabled={disabled || isSubmitting}
                      required={question.is_required}
                    />
                  )}

                  {question.question_type === "text" && (
                    <div className="space-y-2">
                      <Textarea
                        value={response?.text_value || ""}
                        onChange={(e) =>
                          handleTextChange(question.id, e.target.value)
                        }
                        placeholder="回答を入力"
                        disabled={disabled || isSubmitting}
                        required={question.is_required}
                        rows={4}
                      />
                    </div>
                  )}

                  {/* 子質問（理由質問）の表示 */}
                  {childQuestion &&
                    (question.question_type === "score_0_10" ||
                      response?.score_value !== null) && (
                      <div className="mt-6 pt-6 border-t space-y-2">
                        <Label>
                          {childQuestion.question_text}
                          {childQuestion.is_required && (
                            <span className="text-destructive ml-1">*</span>
                          )}
                        </Label>
                        <Textarea
                          value={childResponse?.text_value || ""}
                          onChange={(e) =>
                            handleTextChange(childQuestion.id, e.target.value)
                          }
                          placeholder="回答を入力"
                          disabled={disabled || isSubmitting}
                          required={childQuestion.is_required}
                          rows={4}
                        />
                      </div>
                    )}
                </CardContent>
              </Card>
            </div>
          );
        })}

      <div className="flex justify-end">
        <Button type="submit" disabled={disabled || isSubmitting}>
          {isSubmitting ? "送信中..." : isUpdate ? "回答を更新" : "回答を送信"}
        </Button>
      </div>
    </form>
  );
}
