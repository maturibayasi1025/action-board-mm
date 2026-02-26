"use client";

import type {
  AwardQuestion,
  AwardResponse,
} from "@/app/(protected)/surveys/award/[id]/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";

const QUESTION_GROUP_LABELS: Record<string, string> = {
  passionate_execution: "夢中になってやり切る",
  supreme_relations: "至高な人間関係を",
  happiness_cycle: "幸せの循環",
  team_value: "チーム/組織のバリュー体現",
};

const QUESTION_GROUP_ORDER = [
  "passionate_execution",
  "supreme_relations",
  "happiness_cycle",
  "team_value",
] as const;

interface AwardSurveyFormProps {
  surveyId: string;
  questions: AwardQuestion[];
  existingResponses?: Record<string, AwardResponse>;
  userName: string | null;
  onSubmit: (responses: AwardResponse[]) => Promise<void>;
  disabled?: boolean;
}

export function AwardSurveyForm({
  surveyId,
  questions,
  existingResponses = {},
  userName,
  onSubmit,
  disabled = false,
}: AwardSurveyFormProps) {
  const [responses, setResponses] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const q of questions) {
      const existing = existingResponses[q.id];
      initial[q.id] = existing?.text_value ?? "";
    }
    return initial;
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (questionId: string, value: string) => {
    setResponses((prev) => ({ ...prev, [questionId]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 必須項目のバリデーション
    const requiredQuestions = questions.filter((q) => q.is_required);
    for (const question of requiredQuestions) {
      if (!responses[question.id]?.trim()) {
        alert(`「${question.question_text}」は必須項目です`);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const responseArray: AwardResponse[] = questions.map((q) => ({
        question_id: q.id,
        text_value: responses[q.id]?.trim() || null,
      }));
      await onSubmit(responseArray);
    } catch (error) {
      console.error("回答の送信に失敗しました:", error);
      alert("回答の送信に失敗しました。もう一度お試しください。");
    } finally {
      setIsSubmitting(false);
    }
  };

  // グループ別に質問を整理
  const questionsByGroup = QUESTION_GROUP_ORDER.reduce(
    (acc, group) => {
      acc[group] = questions
        .filter((q) => q.question_group === group)
        .sort((a, b) => a.display_order - b.display_order);
      return acc;
    },
    {} as Record<string, AwardQuestion[]>,
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* 回答者名の表示 */}
      {userName && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">回答者</div>
            <div className="text-lg font-semibold mt-1">{userName}</div>
          </CardContent>
        </Card>
      )}

      {/* セクション別フォーム */}
      {QUESTION_GROUP_ORDER.map((group) => {
        const groupQuestions = questionsByGroup[group];
        if (!groupQuestions || groupQuestions.length === 0) return null;

        return (
          <div key={group} className="space-y-4">
            <h2 className="text-xl font-bold border-b pb-2">
              {QUESTION_GROUP_LABELS[group]}
            </h2>
            <div className="space-y-4">
              {groupQuestions.map((question) => (
                <Card key={question.id}>
                  <CardHeader>
                    <CardTitle className="text-base font-medium leading-relaxed">
                      {question.question_text}
                      {question.is_required && (
                        <span className="text-destructive ml-1">*</span>
                      )}
                    </CardTitle>
                    {question.help_text && (
                      <div className="space-y-1">
                        {question.help_text.split("\n").map((line, i) => (
                          <Badge
                            key={`${question.id}-help-${i}`}
                            variant="secondary"
                            className="text-xs font-normal"
                          >
                            {line}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </CardHeader>
                  <CardContent>
                    {question.question_type === "textarea" ? (
                      <Textarea
                        value={responses[question.id] || ""}
                        onChange={(e) =>
                          handleChange(question.id, e.target.value)
                        }
                        placeholder={question.placeholder ?? "回答を入力"}
                        disabled={disabled || isSubmitting}
                        required={question.is_required}
                        rows={4}
                      />
                    ) : (
                      <Input
                        type="text"
                        value={responses[question.id] || ""}
                        onChange={(e) =>
                          handleChange(question.id, e.target.value)
                        }
                        placeholder={question.placeholder ?? "回答を入力"}
                        disabled={disabled || isSubmitting}
                        required={question.is_required}
                      />
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        );
      })}

      {!disabled && (
        <div className="flex justify-end">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "送信中..." : "回答を送信"}
          </Button>
        </div>
      )}
    </form>
  );
}
