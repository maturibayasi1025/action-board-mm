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
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils/utils";
import { Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

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

type MemberOption = { id: string; name: string };

interface AwardSurveyFormProps {
  surveyId: string;
  questions: AwardQuestion[];
  existingResponses?: Record<string, AwardResponse>;
  userName: string | null;
  currentUserId: string | null;
  onSubmit: (responses: AwardResponse[]) => Promise<void>;
  disabled?: boolean;
  /** 既に回答がある場合は true（ボタン文言が「更新」になる） */
  isUpdate?: boolean;
}

function AwardNomineeSelect({
  questionId,
  value,
  onChange,
  members,
  disabled,
  required,
}: {
  questionId: string;
  value: string;
  onChange: (userId: string) => void;
  members: MemberOption[];
  disabled: boolean;
  required: boolean;
}) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredMembers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return members;
    return members.filter((m) => m.name.toLowerCase().includes(query));
  }, [members, searchQuery]);

  const selectedMember = members.find((m) => m.id === value);

  return (
    <div className="space-y-2">
      {selectedMember && (
        <div className="flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2">
          <span className="text-sm font-medium">{selectedMember.name}</span>
          <button
            type="button"
            onClick={() => onChange("")}
            disabled={disabled}
            className="ml-auto rounded-full p-0.5 hover:bg-muted disabled:opacity-50"
            aria-label="選択を解除"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="text"
          placeholder="メンバーを検索..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          disabled={disabled}
          className="pl-9 pr-9"
          aria-required={required}
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery("")}
            disabled={disabled}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-0.5 hover:bg-muted"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        )}
      </div>

      {searchQuery && (
        <div className="px-1 text-sm text-muted-foreground">
          {filteredMembers.length}件表示（全{members.length}件）
        </div>
      )}

      <div className="max-h-48 overflow-y-auto rounded-md border p-2">
        {filteredMembers.length > 0 ? (
          filteredMembers.map((member) => (
            <button
              key={member.id}
              type="button"
              disabled={disabled}
              onClick={() => onChange(member.id)}
              className={cn(
                "w-full rounded px-3 py-2 text-left text-sm hover:bg-muted/50",
                value === member.id && "bg-primary/10 font-medium",
              )}
            >
              {member.name}
            </button>
          ))
        ) : (
          <div className="py-4 text-center text-sm text-muted-foreground">
            該当するメンバーが見つかりません
          </div>
        )}
      </div>

      <input
        type="hidden"
        name={`nominee-${questionId}`}
        value={value}
      />
    </div>
  );
}

export function AwardSurveyForm({
  surveyId: _surveyId,
  questions,
  existingResponses = {},
  userName,
  currentUserId,
  onSubmit,
  disabled = false,
  isUpdate = false,
}: AwardSurveyFormProps) {
  const [textResponses, setTextResponses] = useState<Record<string, string>>(
    () => {
      const initial: Record<string, string> = {};
      for (const q of questions) {
        if (q.question_type !== "user_select") {
          initial[q.id] = existingResponses[q.id]?.text_value ?? "";
        }
      }
      return initial;
    },
  );
  const [nomineeSelections, setNomineeSelections] = useState<
    Record<string, string>
  >(() => {
    const initial: Record<string, string> = {};
    for (const q of questions) {
      if (q.question_type === "user_select") {
        initial[q.id] = existingResponses[q.id]?.nominee_user_id ?? "";
      }
    }
    return initial;
  });
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    async function fetchMembers() {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("private_users")
        .select("id, name")
        .order("name");

      if (data && !error) {
        setMembers(
          currentUserId ? data.filter((u) => u.id !== currentUserId) : data,
        );
      }
    }
    void fetchMembers();
  }, [currentUserId]);

  const handleTextChange = (questionId: string, value: string) => {
    setTextResponses((prev) => ({ ...prev, [questionId]: value }));
  };

  const handleNomineeChange = (questionId: string, userId: string) => {
    setNomineeSelections((prev) => ({ ...prev, [questionId]: userId }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isSubmitting || disabled) {
      return;
    }

    const requiredQuestions = questions.filter((q) => q.is_required);
    for (const question of requiredQuestions) {
      if (question.question_type === "user_select") {
        if (!nomineeSelections[question.id]?.trim()) {
          alert(`「${question.question_text}」は必須項目です`);
          return;
        }
      } else if (!textResponses[question.id]?.trim()) {
        alert(`「${question.question_text}」は必須項目です`);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const responseArray: AwardResponse[] = questions.map((q) => {
        if (q.question_type === "user_select") {
          const nomineeId = nomineeSelections[q.id]?.trim();
          return {
            question_id: q.id,
            nominee_user_id: nomineeId || null,
            text_value: null,
          };
        }
        return {
          question_id: q.id,
          text_value: textResponses[q.id]?.trim() || null,
          nominee_user_id: null,
        };
      });
      await onSubmit(responseArray);
    } catch (error) {
      console.error("回答の送信に失敗しました:", error);
      alert("回答の送信に失敗しました。もう一度お試しください。");
    } finally {
      setIsSubmitting(false);
    }
  };

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
      {userName && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">回答者</div>
            <div className="mt-1 text-lg font-semibold">{userName}</div>
          </CardContent>
        </Card>
      )}

      {QUESTION_GROUP_ORDER.map((group) => {
        const groupQuestions = questionsByGroup[group];
        if (!groupQuestions || groupQuestions.length === 0) return null;

        return (
          <div key={group} className="space-y-4">
            <h2 className="border-b pb-2 text-xl font-bold">
              {QUESTION_GROUP_LABELS[group]}
            </h2>
            <div className="space-y-4">
              {groupQuestions.map((question) => (
                <Card key={question.id}>
                  <CardHeader>
                    <CardTitle className="text-base font-medium leading-relaxed">
                      {question.question_text}
                      {question.is_required && (
                        <span className="ml-1 text-destructive">*</span>
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
                        value={textResponses[question.id] || ""}
                        onChange={(e) =>
                          handleTextChange(question.id, e.target.value)
                        }
                        placeholder={question.placeholder ?? "回答を入力"}
                        disabled={disabled || isSubmitting}
                        required={question.is_required}
                        rows={4}
                      />
                    ) : question.question_type === "user_select" ? (
                      <AwardNomineeSelect
                        questionId={question.id}
                        value={nomineeSelections[question.id] || ""}
                        onChange={(userId) =>
                          handleNomineeChange(question.id, userId)
                        }
                        members={members}
                        disabled={disabled || isSubmitting}
                        required={question.is_required}
                      />
                    ) : (
                      <Input
                        type="text"
                        value={textResponses[question.id] || ""}
                        onChange={(e) =>
                          handleTextChange(question.id, e.target.value)
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

      <div className="flex justify-end">
        <Button type="submit" disabled={disabled || isSubmitting}>
          {isSubmitting ? "送信中..." : isUpdate ? "回答を更新" : "回答を送信"}
        </Button>
      </div>
    </form>
  );
}
