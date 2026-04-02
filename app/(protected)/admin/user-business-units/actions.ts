"use server";

import { createServiceClient } from "@/lib/supabase/server";
import { requireOwner } from "@/lib/utils/isOwner";
import { revalidatePath } from "next/cache";

export async function getUserBusinessUnit(
  userId: string,
): Promise<
  | { success: true; businessUnitId: string | null }
  | { success: false; error: string }
> {
  try {
    await requireOwner();
    const supabase = await createServiceClient();
    const { data, error } = await supabase
      .from("private_users")
      .select("business_unit_id")
      .eq("id", userId)
      .maybeSingle();
    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true, businessUnitId: data?.business_unit_id ?? null };
  } catch (error) {
    if (error instanceof Error && error.message === "経営者権限が必要です") {
      return { success: false, error: "経営者権限が必要です" };
    }
    console.error(error);
    return { success: false, error: "取得に失敗しました" };
  }
}

export async function updateUserBusinessUnit(
  userId: string,
  businessUnitId: string | null,
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    await requireOwner();
    if (!userId) {
      return { success: false, error: "ユーザーが指定されていません" };
    }
    const supabase = await createServiceClient();

    if (businessUnitId) {
      const { data: unit, error: unitErr } = await supabase
        .from("business_units")
        .select("id")
        .eq("id", businessUnitId)
        .maybeSingle();
      if (unitErr || !unit) {
        return { success: false, error: "指定の事業部が見つかりません" };
      }
    }

    const { error } = await supabase
      .from("private_users")
      .update({
        business_unit_id: businessUnitId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/admin/user-business-units");
    revalidatePath(`/users/${userId}`);
    revalidatePath("/settings/profile");
    return { success: true };
  } catch (error) {
    if (error instanceof Error && error.message === "経営者権限が必要です") {
      return { success: false, error: "経営者権限が必要です" };
    }
    console.error(error);
    return { success: false, error: "更新に失敗しました" };
  }
}
