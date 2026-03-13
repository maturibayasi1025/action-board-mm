"use server";

import { createServiceClient } from "@/lib/supabase/server";
import { requireOwner } from "@/lib/utils/isOwner";
import { revalidatePath } from "next/cache";

export async function getAwardSurveys() {
  await requireOwner();
  const supabase = await createServiceClient();

  const { data: surveys, error } = await supabase
    .from("award_surveys")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("アンケート一覧の取得エラー:", error);
    return [];
  }

  // ユニーク回答者数を取得
  const surveysWithCount = await Promise.all(
    (surveys || []).map(async (survey) => {
      const { data: responders, error: respondersError } = await supabase
        .from("award_responses")
        .select("user_id")
        .eq("survey_id", survey.id);

      if (respondersError) {
        console.error("ユニーク回答者数の取得エラー:", respondersError);
      }

      const uniqueUsers = new Set(
        (responders || [])
          .map((responder) => responder.user_id)
          .filter((userId): userId is string => typeof userId === "string"),
      ).size;

      return {
        ...survey,
        unique_response_count: uniqueUsers,
      };
    }),
  );

  return surveysWithCount;
}

export async function createAwardSurvey(data: {
  title: string;
  description?: string;
  year_month: string;
  period_number: number;
  start_date: string;
  end_date: string;
}) {
  await requireOwner();
  const supabase = await createServiceClient();

  const { data: survey, error } = await supabase
    .from("award_surveys")
    .insert({ ...data, is_active: true })
    .select()
    .single();

  if (error) {
    console.error("アンケート作成エラー:", error);
    throw new Error("アンケートの作成に失敗しました");
  }

  revalidatePath("/admin/award-surveys");
  return survey;
}

export async function updateAwardSurvey(
  id: string,
  data: {
    title?: string;
    description?: string;
    start_date?: string;
    end_date?: string;
    is_active?: boolean;
  },
) {
  await requireOwner();
  const supabase = await createServiceClient();

  const { error } = await supabase
    .from("award_surveys")
    .update(data)
    .eq("id", id);

  if (error) {
    console.error("アンケート更新エラー:", error);
    throw new Error("アンケートの更新に失敗しました");
  }

  revalidatePath("/admin/award-surveys");
  revalidatePath(`/admin/award-surveys/${id}`);
}

export async function deleteAwardSurvey(id: string) {
  await requireOwner();
  const supabase = await createServiceClient();

  const { error } = await supabase.from("award_surveys").delete().eq("id", id);

  if (error) {
    console.error("アンケート削除エラー:", error);
    throw new Error("アンケートの削除に失敗しました");
  }

  revalidatePath("/admin/award-surveys");
}

export async function getTotalUsers() {
  await requireOwner();
  const supabase = await createServiceClient();

  const { count } = await supabase
    .from("private_users")
    .select("*", { count: "exact", head: true });

  return count || 0;
}
