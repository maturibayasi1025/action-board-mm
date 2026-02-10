"use server";

import { createServiceClient } from "@/lib/supabase/server";
import { requireOwner } from "@/lib/utils/isOwner";
import { revalidatePath } from "next/cache";

export async function getQuestions() {
  await requireOwner();
  const supabase = await createServiceClient();

  const { data: questions, error } = await supabase
    .from("enps_questions")
    .select("*")
    .order("display_order", { ascending: true });

  if (error) {
    console.error("質問一覧の取得エラー:", error);
    return [];
  }

  return questions || [];
}

export async function createQuestion(data: {
  question_text: string;
  question_type: "score_0_10" | "text";
  display_order: number;
  is_required: boolean;
  parent_question_id?: string | null;
}) {
  await requireOwner();
  const supabase = await createServiceClient();

  const { data: question, error } = await supabase
    .from("enps_questions")
    .insert({
      ...data,
      is_active: true,
    })
    .select()
    .single();

  if (error) {
    console.error("質問作成エラー:", error);
    throw new Error("質問の作成に失敗しました");
  }

  revalidatePath("/admin/enps-surveys/questions");
  return question;
}

export async function updateQuestion(
  id: string,
  data: {
    question_text?: string;
    question_type?: "score_0_10" | "text";
    display_order?: number;
    is_required?: boolean;
    is_active?: boolean;
    parent_question_id?: string | null;
  },
) {
  await requireOwner();
  const supabase = await createServiceClient();

  const { error } = await supabase
    .from("enps_questions")
    .update(data)
    .eq("id", id);

  if (error) {
    console.error("質問更新エラー:", error);
    throw new Error("質問の更新に失敗しました");
  }

  revalidatePath("/admin/enps-surveys/questions");
}

export async function deleteQuestion(id: string) {
  await requireOwner();
  const supabase = await createServiceClient();

  const { error } = await supabase.from("enps_questions").delete().eq("id", id);

  if (error) {
    console.error("質問削除エラー:", error);
    throw new Error("質問の削除に失敗しました");
  }

  revalidatePath("/admin/enps-surveys/questions");
}

export async function reorderQuestions(questionIds: string[]) {
  await requireOwner();
  const supabase = await createServiceClient();

  // トランザクション的に更新
  const updates = questionIds.map((id, index) => ({
    id,
    display_order: index + 1,
  }));

  for (const update of updates) {
    const { error } = await supabase
      .from("enps_questions")
      .update({ display_order: update.display_order })
      .eq("id", update.id);

    if (error) {
      console.error("質問順序更新エラー:", error);
      throw new Error("質問の順序更新に失敗しました");
    }
  }

  revalidatePath("/admin/enps-surveys/questions");
}
