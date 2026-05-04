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
 * 経営者がユーザーを Auth および public/private プロフィールから削除する。
 * auth.users 参照で RESTRICT / NO ACTION になる行は事前に解消する。
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
    const { error: mErr } = await supabase
      .from("user_missions")
      .update({ approved_by: null })
      .eq("approved_by", targetUserId);
    if (mErr) {
      console.error("adminDeleteUser user_missions:", mErr);
      return { success: false, error: "関連グッジョブの更新に失敗しました" };
    }
    const { error: xpErr } = await supabase
      .from("external_user_pending_xp")
      .update({ claimed_by_user_id: null })
      .eq("claimed_by_user_id", targetUserId);
    if (xpErr) {
      console.error("adminDeleteUser external_user_pending_xp:", xpErr);
      return { success: false, error: "保留ポイントの更新に失敗しました" };
    }
    const { error: enpsGrantErr } = await supabase
      .from("enps_late_submission_grants")
      .update({ created_by_user_id: operator.id })
      .eq("created_by_user_id", targetUserId);
    if (enpsGrantErr) {
      console.error(
        "adminDeleteUser enps_late_submission_grants:",
        enpsGrantErr,
      );
      return { success: false, error: "eNPS付与の更新に失敗しました" };
    }
    const { error: awardGrantErr } = await supabase
      .from("award_late_submission_grants")
      .update({ created_by_user_id: operator.id })
      .eq("created_by_user_id", targetUserId);
    if (awardGrantErr) {
      console.error(
        "adminDeleteUser award_late_submission_grants:",
        awardGrantErr,
      );
      return { success: false, error: "表彰付与の更新に失敗しました" };
    }
    const { error: authErr } =
      await supabase.auth.admin.deleteUser(targetUserId);
    if (authErr) {
      console.error("adminDeleteUser auth:", authErr);
      return { success: false, error: authErr.message };
    }
    await supabase.from("public_user_profiles").delete().eq("id", targetUserId);
    await supabase.from("private_users").delete().eq("id", targetUserId);
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
