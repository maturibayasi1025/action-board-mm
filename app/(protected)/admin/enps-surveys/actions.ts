"use server";

import { createServiceClient } from "@/lib/supabase/server";
import { requireOwner } from "@/lib/utils/isOwner";
import { revalidatePath } from "next/cache";

export async function getSurveys() {
  await requireOwner();
  const supabase = await createServiceClient();

  const { data: surveys, error } = await supabase
    .from("enps_surveys")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("アンケート一覧の取得エラー:", error);
    return [];
  }

  // 回答数を取得
  const surveysWithResponseCount = await Promise.all(
    (surveys || []).map(async (survey) => {
      const { count } = await supabase
        .from("enps_responses")
        .select("*", { count: "exact", head: true })
        .eq("survey_id", survey.id);

      // 行数ではなく、回答したユニークユーザー数を算出する
      const { data: responders, error: respondersError } = await supabase
        .from("enps_responses")
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
        response_count: count || 0,
        unique_response_count: uniqueUsers,
      };
    }),
  );

  return surveysWithResponseCount;
}

export async function createSurvey(data: {
  title: string;
  description?: string;
  year_month: string;
  start_date: string;
  end_date: string;
}) {
  await requireOwner();
  const supabase = await createServiceClient();

  const { data: survey, error } = await supabase
    .from("enps_surveys")
    .insert({
      ...data,
      is_active: true,
    })
    .select()
    .single();

  if (error) {
    console.error("アンケート作成エラー:", error);
    throw new Error("アンケートの作成に失敗しました");
  }

  revalidatePath("/admin/enps-surveys");
  return survey;
}

export async function updateSurvey(
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
    .from("enps_surveys")
    .update(data)
    .eq("id", id);

  if (error) {
    console.error("アンケート更新エラー:", error);
    throw new Error("アンケートの更新に失敗しました");
  }

  revalidatePath("/admin/enps-surveys");
  revalidatePath(`/admin/enps-surveys/${id}`);
}

export async function deleteSurvey(id: string) {
  await requireOwner();
  const supabase = await createServiceClient();

  const { error } = await supabase.from("enps_surveys").delete().eq("id", id);

  if (error) {
    console.error("アンケート削除エラー:", error);
    throw new Error("アンケートの削除に失敗しました");
  }

  revalidatePath("/admin/enps-surveys");
}

export async function getTotalUsers() {
  await requireOwner();
  const supabase = await createServiceClient();

  const { count } = await supabase
    .from("private_users")
    .select("*", { count: "exact", head: true })
    .is("suspended_at", null);

  return count || 0;
}
