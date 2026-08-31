"use server";

import { createClient, createServiceClient } from "@/lib/supabase/server";
import { isUserIdOwner, requireOwner } from "@/lib/utils/isOwner";
import { revalidatePath } from "next/cache";

export type UserWithCompanyRow = {
  id: string;
  name: string;
  businessUnitId: string | null;
  businessUnitName: string | null;
  companyName: string | null;
};

export async function listUsersWithCompanies(): Promise<
  | { success: true; users: UserWithCompanyRow[] }
  | { success: false; error: string }
> {
  try {
    await requireOwner();
    const supabase = await createServiceClient();

    const { data, error } = await supabase
      .from("public_user_profiles")
      .select(
        `
        id,
        name,
        business_unit_id,
        business_units (
          id,
          name,
          companies (
            name
          )
        )
      `,
      )
      .is("deleted_at", null)
      .order("name", { ascending: true });

    if (error) {
      console.error("listUsersWithCompanies:", error);
      return { success: false, error: error.message };
    }

    const users: UserWithCompanyRow[] = (data ?? []).map((row) => {
      const bu = row.business_units;
      const unit =
        bu === null ? null : Array.isArray(bu) ? (bu[0] ?? null) : bu;
      const comp = unit?.companies;
      const companyName =
        comp === null || comp === undefined
          ? null
          : Array.isArray(comp)
            ? (comp[0]?.name ?? null)
            : comp.name;
      return {
        id: row.id,
        name: row.name,
        businessUnitId: row.business_unit_id,
        businessUnitName: unit?.name ?? null,
        companyName,
      };
    });

    return { success: true, users };
  } catch (error) {
    if (error instanceof Error && error.message === "経営者権限が必要です") {
      return { success: false, error: "経営者権限が必要です" };
    }
    console.error(error);
    return { success: false, error: "一覧の取得に失敗しました" };
  }
}

/**
 * 経営者がユーザーをソフト削除する。
 * Auth の物理削除は FK / トリガーで失敗しやすく、投稿グッジョブも消えるため使わない。
 * プロフィールに deleted_at を立て、ログイン不可にして一覧から外す。
 */
export async function adminDeleteUser(
  targetUserId: string,
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    await requireOwner();
    const supabaseAnon = await createClient();
    const {
      data: { user: operator },
    } = await supabaseAnon.auth.getUser();
    if (!operator?.id) {
      return { success: false, error: "ログインが必要です" };
    }
    if (targetUserId === operator.id) {
      return { success: false, error: "自分自身は削除できません" };
    }
    if (await isUserIdOwner(targetUserId)) {
      return { success: false, error: "経営者アカウントは削除できません" };
    }
    const supabase = await createServiceClient();
    const deletedAt = new Date().toISOString();
    const { data: updated, error: updateError } = await supabase
      .from("private_users")
      .update({ deleted_at: deletedAt })
      .eq("id", targetUserId)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();
    if (updateError) {
      console.error("adminDeleteUser private_users:", updateError);
      return { success: false, error: "削除状態の更新に失敗しました" };
    }
    if (!updated) {
      const { data: existing } = await supabase
        .from("private_users")
        .select("id, deleted_at")
        .eq("id", targetUserId)
        .maybeSingle();
      if (!existing) {
        return { success: false, error: "ユーザーが見つかりません" };
      }
    }
    const { error: banError } = await supabase.auth.admin.updateUserById(
      targetUserId,
      { ban_duration: "876600h" },
    );
    if (banError) {
      console.error("adminDeleteUser auth ban:", banError);
      return { success: false, error: "ログイン停止に失敗しました" };
    }
    revalidatePath("/admin/users-and-companies");
    return { success: true };
  } catch (error) {
    if (error instanceof Error && error.message === "経営者権限が必要です") {
      return { success: false, error: "経営者権限が必要です" };
    }
    console.error(error);
    return { success: false, error: "ユーザーの削除に失敗しました" };
  }
}
