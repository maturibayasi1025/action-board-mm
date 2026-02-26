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
import {
  type AwardQuestionGroup,
  type AwardQuestionType,
  createAwardQuestion,
} from "../actions";

export function AwardQuestionForm() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    question_text: "",
    question_type: "textarea" as AwardQuestionType,
    question_group: "passionate_execution" as AwardQuestionGroup,
    display_order: 1,
    is_required: true,
    placeholder: "",
    help_text: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await createAwardQuestion({
        question_text: formData.question_text,
        question_type: formData.question_type,
        question_group: formData.question_group,
        display_order: formData.display_order,
        is_required: formData.is_required,
        placeholder: formData.placeholder || null,
        help_text: formData.help_text || null,
      });
      router.refresh();
      setFormData({
        question_text: "",
        question_type: "textarea",
        question_group: "passionate_execution",
        display_order: 1,
        is_required: true,
        placeholder: "",
        help_text: "",
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
            onValueChange={(value: AwardQuestionType) =>
              setFormData({ ...formData, question_type: value })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="textarea">長文入力 (textarea)</SelectItem>
              <SelectItem value="text">短文入力 (text)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="question_group">バリューグループ *</Label>
          <Select
            value={formData.question_group}
            onValueChange={(value: AwardQuestionGroup) =>
              setFormData({ ...formData, question_group: value })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="passionate_execution">
                夢中になってやり切る
              </SelectItem>
              <SelectItem value="supreme_relations">
                至高な人間関係を
              </SelectItem>
              <SelectItem value="happiness_cycle">幸せの循環</SelectItem>
              <SelectItem value="team_value">
                チーム/組織のバリュー体現
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
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

      <div className="space-y-2">
        <Label htmlFor="placeholder">プレースホルダー（例文）</Label>
        <Textarea
          id="placeholder"
          value={formData.placeholder}
          onChange={(e) =>
            setFormData({ ...formData, placeholder: e.target.value })
          }
          placeholder="（例）○○のお客さまを..."
          rows={2}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="help_text">ヒント・補足情報</Label>
        <Input
          id="help_text"
          value={formData.help_text}
          onChange={(e) =>
            setFormData({ ...formData, help_text: e.target.value })
          }
          placeholder='キーワード＝"幸せの追求" "幸福度向上"'
        />
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

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "作成中..." : "質問を追加"}
      </Button>
    </form>
  );
}
