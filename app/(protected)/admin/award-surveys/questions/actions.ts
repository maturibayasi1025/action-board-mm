"use server";

import { createServiceClient } from "@/lib/supabase/server";
import { requireOwner } from "@/lib/utils/isOwner";
import { revalidatePath } from "next/cache";

export type AwardQuestionType = "text" | "textarea" | "user_select";
export type AwardQuestionGroup =
  | "passionate_execution"
  | "supreme_relations"
  | "happiness_cycle"
  | "team_value";

export interface AwardQuestionRecord {
  id: string;
  question_text: string;
  question_type: AwardQuestionType;
  question_group: AwardQuestionGroup;
  display_order: number;
  is_required: boolean;
  is_active: boolean;
  placeholder: string | null;
  help_text: string | null;
}

export async function getAwardQuestions(): Promise<AwardQuestionRecord[]> {
  await requireOwner();
  const supabase = await createServiceClient();

  const { data: questions, error } = await supabase
    .from("award_questions")
    .select("*")
    .order("display_order", { ascending: true });

  if (error) {
    console.error("質問一覧の取得エラー:", error);
    return [];
  }

  return (questions || []) as AwardQuestionRecord[];
}

export async function createAwardQuestion(data: {
  question_text: string;
  question_type: AwardQuestionType;
  question_group: AwardQuestionGroup;
  display_order: number;
  is_required: boolean;
  placeholder?: string | null;
  help_text?: string | null;
}) {
  await requireOwner();
  const supabase = await createServiceClient();

  const { data: question, error } = await supabase
    .from("award_questions")
    .insert({ ...data, is_active: true })
    .select()
    .single();

  if (error) {
    console.error("質問作成エラー:", error);
    throw new Error("質問の作成に失敗しました");
  }

  revalidatePath("/admin/award-surveys/questions");
  return question;
}

export async function updateAwardQuestion(
  id: string,
  data: {
    question_text?: string;
    question_type?: AwardQuestionType;
    question_group?: AwardQuestionGroup;
    display_order?: number;
    is_required?: boolean;
    is_active?: boolean;
    placeholder?: string | null;
    help_text?: string | null;
  },
) {
  await requireOwner();
  const supabase = await createServiceClient();

  const { error } = await supabase
    .from("award_questions")
    .update(data)
    .eq("id", id);

  if (error) {
    console.error("質問更新エラー:", error);
    throw new Error("質問の更新に失敗しました");
  }

  revalidatePath("/admin/award-surveys/questions");
}

export async function deleteAwardQuestion(id: string) {
  await requireOwner();
  const supabase = await createServiceClient();

  const { error } = await supabase
    .from("award_questions")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("質問削除エラー:", error);
    throw new Error("質問の削除に失敗しました");
  }

  revalidatePath("/admin/award-surveys/questions");
}
