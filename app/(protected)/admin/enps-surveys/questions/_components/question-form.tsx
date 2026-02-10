"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createQuestion } from "../actions";

export function QuestionForm() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    question_text: "",
    question_type: "score_0_10" as "score_0_10" | "text",
    display_order: 1,
    is_required: true,
    parent_question_id: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await createQuestion({
        question_text: formData.question_text,
        question_type: formData.question_type,
        display_order: formData.display_order,
        is_required: formData.is_required,
        parent_question_id: formData.parent_question_id || null,
      });
      router.refresh();
      setFormData({
        question_text: "",
        question_type: "score_0_10",
        display_order: 1,
        is_required: true,
        parent_question_id: "",
      });
    } catch (error) {
      console.error("質問の作成に失敗しました:", error);
      alert("質問の作成に失敗しました");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="question_text">質問文 *</Label>
        <Textarea
          id="question_text"
          value={formData.question_text}
          onChange={(e) =>
            setFormData({ ...formData, question_text: e.target.value })
          }
          placeholder="質問文を入力してください"
          required
          rows={3}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="question_type">質問タイプ *</Label>
          <Select
            value={formData.question_type}
            onValueChange={(value: "score_0_10" | "text") =>
              setFormData({ ...formData, question_type: value })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="score_0_10">スコア (0-10点)</SelectItem>
              <SelectItem value="text">テキスト入力</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="display_order">表示順序 *</Label>
          <Input
            id="display_order"
            type="number"
            min="1"
            value={formData.display_order}
            onChange={(e) =>
              setFormData({
                ...formData,
                display_order: Number.parseInt(e.target.value) || 1,
              })
            }
            required
          />
        </div>
      </div>

      <div className="flex items-center space-x-2">
        <Checkbox
          id="is_required"
          checked={formData.is_required}
          onCheckedChange={(checked) =>
            setFormData({ ...formData, is_required: checked === true })
          }
        />
        <Label htmlFor="is_required" className="cursor-pointer">
          必須項目
        </Label>
      </div>

      <div className="space-y-2">
        <Label htmlFor="parent_question_id">
          親質問ID（理由質問の場合のみ）
        </Label>
        <Input
          id="parent_question_id"
          value={formData.parent_question_id}
          onChange={(e) =>
            setFormData({ ...formData, parent_question_id: e.target.value })
          }
          placeholder="親質問のIDを入力（空欄可）"
        />
      </div>

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "作成中..." : "質問を追加"}
      </Button>
    </form>
  );
}
