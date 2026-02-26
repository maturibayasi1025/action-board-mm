"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
  type AwardQuestionRecord,
  type AwardQuestionType,
  deleteAwardQuestion,
  updateAwardQuestion,
} from "../actions";

const QUESTION_GROUP_LABELS: Record<string, string> = {
  passionate_execution: "夢中になってやり切る",
  supreme_relations: "至高な人間関係を",
  happiness_cycle: "幸せの循環",
  team_value: "チーム/組織のバリュー体現",
};

interface AwardQuestionListProps {
  initialQuestions: AwardQuestionRecord[];
}

export function AwardQuestionList({
  initialQuestions,
}: AwardQuestionListProps) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<AwardQuestionRecord>>({});

  const handleEdit = (question: AwardQuestionRecord) => {
    setEditingId(question.id);
    setEditData({
      question_text: question.question_text,
      question_type: question.question_type,
      question_group: question.question_group,
      display_order: question.display_order,
      is_required: question.is_required,
      is_active: question.is_active,
      placeholder: question.placeholder,
      help_text: question.help_text,
    });
  };

  const handleSave = async (id: string) => {
    try {
      await updateAwardQuestion(id, editData);
      router.refresh();
      setEditingId(null);
      setEditData({});
    } catch (error) {
      console.error("質問の更新に失敗しました:", error);
      alert("質問の更新に失敗しました");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("この質問を削除しますか？")) return;
    try {
      await deleteAwardQuestion(id);
      router.refresh();
    } catch (error) {
      console.error("質問の削除に失敗しました:", error);
      alert("質問の削除に失敗しました");
    }
  };

  const handleToggleActive = async (id: string, currentActive: boolean) => {
    try {
      await updateAwardQuestion(id, { is_active: !currentActive });
      router.refresh();
    } catch (error) {
      console.error("質問の更新に失敗しました:", error);
      alert("質問の更新に失敗しました");
    }
  };

  return (
    <div className="space-y-4">
      {[...initialQuestions]
        .sort((a, b) => a.display_order - b.display_order)
        .map((question) => {
          const isEditing = editingId === question.id;

          return (
            <Card key={question.id}>
              <CardContent className="pt-6">
                {isEditing ? (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>質問文</Label>
                      <Textarea
                        value={editData.question_text || ""}
                        onChange={(e) =>
                          setEditData({
                            ...editData,
                            question_text: e.target.value,
                          })
                        }
                        rows={3}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>質問タイプ</Label>
                        <Select
                          value={editData.question_type || "textarea"}
                          onValueChange={(value: AwardQuestionType) =>
                            setEditData({ ...editData, question_type: value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="textarea">
                              長文 (textarea)
                            </SelectItem>
                            <SelectItem value="text">短文 (text)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>バリューグループ</Label>
                        <Select
                          value={
                            editData.question_group || "passionate_execution"
                          }
                          onValueChange={(value: AwardQuestionGroup) =>
                            setEditData({ ...editData, question_group: value })
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
                            <SelectItem value="happiness_cycle">
                              幸せの循環
                            </SelectItem>
                            <SelectItem value="team_value">
                              チーム/組織のバリュー体現
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>表示順序</Label>
                      <input
                        type="number"
                        value={editData.display_order || 1}
                        onChange={(e) =>
                          setEditData({
                            ...editData,
                            display_order: Number.parseInt(e.target.value) || 1,
                          })
                        }
                        className="w-full px-3 py-2 border rounded-md"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>プレースホルダー</Label>
                      <Textarea
                        value={editData.placeholder || ""}
                        onChange={(e) =>
                          setEditData({
                            ...editData,
                            placeholder: e.target.value || null,
                          })
                        }
                        rows={2}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>ヒント・補足情報</Label>
                      <Input
                        value={editData.help_text || ""}
                        onChange={(e) =>
                          setEditData({
                            ...editData,
                            help_text: e.target.value || null,
                          })
                        }
                      />
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          checked={editData.is_required || false}
                          onCheckedChange={(checked) =>
                            setEditData({
                              ...editData,
                              is_required: checked === true,
                            })
                          }
                        />
                        <Label>必須項目</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          checked={editData.is_active ?? true}
                          onCheckedChange={(checked) =>
                            setEditData({
                              ...editData,
                              is_active: checked === true,
                            })
                          }
                        />
                        <Label>有効</Label>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={() => handleSave(question.id)} size="sm">
                        保存
                      </Button>
                      <Button
                        onClick={() => {
                          setEditingId(null);
                          setEditData({});
                        }}
                        variant="outline"
                        size="sm"
                      >
                        キャンセル
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold">
                            {question.question_text}
                          </span>
                          {question.is_required && (
                            <Badge variant="destructive">必須</Badge>
                          )}
                          {question.is_active ? (
                            <Badge variant="default">有効</Badge>
                          ) : (
                            <Badge variant="secondary">無効</Badge>
                          )}
                          <Badge variant="outline">
                            {question.question_type === "textarea"
                              ? "長文"
                              : "短文"}
                          </Badge>
                          <Badge variant="outline">
                            {QUESTION_GROUP_LABELS[question.question_group]}
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          表示順序: {question.display_order}
                          {question.help_text && (
                            <> | ヒント: {question.help_text}</>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2 ml-4">
                        <Button
                          onClick={() => handleEdit(question)}
                          variant="outline"
                          size="sm"
                        >
                          編集
                        </Button>
                        <Button
                          onClick={() =>
                            handleToggleActive(question.id, question.is_active)
                          }
                          variant="outline"
                          size="sm"
                        >
                          {question.is_active ? "無効化" : "有効化"}
                        </Button>
                        <Button
                          onClick={() => handleDelete(question.id)}
                          variant="destructive"
                          size="sm"
                        >
                          削除
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
    </div>
  );
}
