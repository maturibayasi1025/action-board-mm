"use server";

import { getSiteUrl } from "@/lib/env";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import {
  EXISTING_AUTH_INVITE_MESSAGES,
  canDeleteUnusedInviteAuthUser,
  decideExistingAuthInvite,
} from "@/lib/utils/invite-auth-user";
import { isUserIdOwner, requireOwner } from "@/lib/utils/isOwner";
import { inviteUserFormSchema } from "@/lib/validation/auth";
import { revalidatePath } from "next/cache";

export type UserWithCompanyRow = {
  id: string;
  name: string;
  businessUnitId: string | null;
  businessUnitName: string | null;
  companyName: string | null;
  suspendedAt: string | null;
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
        suspended_at,
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
        suspendedAt: row.suspended_at,
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

export type InvitationRow = {
  id: string;
  email: string;
  status: string;
  createdAt: string;
  businessUnitId: string | null;
  businessUnitName: string | null;
  companyName: string | null;
};

function ownerAuthError(
  error: unknown,
): { success: false; error: string } | null {
  if (error instanceof Error && error.message === "経営者権限が必要です") {
    return { success: false, error: "経営者権限が必要です" };
  }
  return null;
}

export async function listPendingInvitations(): Promise<
  | { success: true; invitations: InvitationRow[] }
  | { success: false; error: string }
> {
  try {
    await requireOwner();
    const supabase = await createServiceClient();
    const { data, error } = await supabase
      .from("user_invitations")
      .select(
        `
        id,
        email,
        status,
        created_at,
        business_unit_id,
        business_units (
          name,
          companies (
            name
          )
        )
      `,
      )
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("listPendingInvitations:", error);
      return { success: false, error: error.message };
    }

    const invitations: InvitationRow[] = (data ?? []).map((row) => {
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
        email: row.email,
        status: row.status,
        createdAt: row.created_at,
        businessUnitId: row.business_unit_id,
        businessUnitName: unit?.name ?? null,
        companyName,
      };
    });

    return { success: true, invitations };
  } catch (error) {
    const ownerError = ownerAuthError(error);
    if (ownerError) return ownerError;
    console.error(error);
    return { success: false, error: "招待一覧の取得に失敗しました" };
  }
}

export async function inviteUser(input: {
  email: string;
  businessUnitId?: string | null;
}): Promise<{ success: true } | { success: false; error: string }> {
  try {
    await requireOwner();
    const parsed = inviteUserFormSchema.safeParse({
      email: input.email,
      business_unit_id: input.businessUnitId ?? "",
    });
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.errors.map((e) => e.message).join("\n"),
      };
    }

    const email = parsed.data.email;
    const businessUnitId = parsed.data.business_unit_id || null;
    const supabaseAnon = await createClient();
    const {
      data: { user: operator },
    } = await supabaseAnon.auth.getUser();
    if (!operator?.id) {
      return { success: false, error: "ログインが必要です" };
    }

    const supabase = await createServiceClient();

    if (businessUnitId) {
      const { data: unit, error: unitError } = await supabase
        .from("business_units")
        .select("id")
        .eq("id", businessUnitId)
        .maybeSingle();
      if (unitError || !unit) {
        return { success: false, error: "指定した事業部が見つかりません" };
      }
    }

    const { data: existingUsers, error: userFetchError } = await supabase.rpc(
      "get_user_by_email",
      { user_email: email },
    );
    if (userFetchError) {
      console.error("inviteUser get_user_by_email:", userFetchError);
      return { success: false, error: "ユーザーの確認に失敗しました" };
    }

    const existingAuthUser = existingUsers?.[0] ?? null;
    if (existingAuthUser) {
      const { data: profile } = await supabase
        .from("private_users")
        .select("id")
        .eq("id", existingAuthUser.id)
        .maybeSingle();
      const { data: pendingForExisting } = await supabase
        .from("user_invitations")
        .select("id")
        .eq("status", "pending")
        .eq("email", email)
        .maybeSingle();
      const decision = decideExistingAuthInvite({
        hasProfile: Boolean(profile),
        hasPendingInvite: Boolean(pendingForExisting),
      });
      return {
        success: false,
        error: EXISTING_AUTH_INVITE_MESSAGES[decision],
      };
    }

    const { data: pending } = await supabase
      .from("user_invitations")
      .select("id")
      .eq("status", "pending")
      .eq("email", email)
      .maybeSingle();
    if (pending) {
      return {
        success: false,
        error:
          "このメールアドレスには未完了の招待があります。再送してください。",
      };
    }

    const siteUrl = getSiteUrl();
    const { data: invited, error: inviteError } =
      await supabase.auth.admin.inviteUserByEmail(email, {
        data: {
          invited_by: operator.id,
          ...(businessUnitId ? { business_unit_id: businessUnitId } : {}),
        },
        redirectTo: `${siteUrl}/auth/callback?redirect_to=/invite/set-password`,
      });

    if (inviteError || !invited.user) {
      console.error("inviteUser inviteUserByEmail:", inviteError);
      if (inviteError?.message?.toLowerCase().includes("already")) {
        return {
          success: false,
          error: "このメールアドレスは既に登録されています",
        };
      }
      return {
        success: false,
        error: inviteError?.message ?? "招待メールの送信に失敗しました",
      };
    }

    const { error: insertError } = await supabase
      .from("user_invitations")
      .insert({
        email,
        invited_by: operator.id,
        auth_user_id: invited.user.id,
        business_unit_id: businessUnitId,
        status: "pending",
      });
    if (insertError) {
      console.error("inviteUser insert:", insertError);
      return { success: false, error: "招待の保存に失敗しました" };
    }

    revalidatePath("/admin/users-and-companies");
    return { success: true };
  } catch (error) {
    const ownerError = ownerAuthError(error);
    if (ownerError) return ownerError;
    console.error(error);
    return { success: false, error: "招待の送信に失敗しました" };
  }
}

export async function resendInvitation(
  invitationId: string,
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    await requireOwner();
    const supabase = await createServiceClient();
    const { data: invitation, error } = await supabase
      .from("user_invitations")
      .select("id, email, auth_user_id, business_unit_id, status")
      .eq("id", invitationId)
      .maybeSingle();

    if (error || !invitation) {
      return { success: false, error: "招待が見つかりません" };
    }
    if (invitation.status !== "pending") {
      return { success: false, error: "再送できる未完了の招待ではありません" };
    }

    if (invitation.auth_user_id) {
      const { data: profile } = await supabase
        .from("private_users")
        .select("id")
        .eq("id", invitation.auth_user_id)
        .maybeSingle();
      if (profile) {
        return { success: false, error: "この招待はすでに登録済みです" };
      }

      const { error: deleteError } = await supabase.auth.admin.deleteUser(
        invitation.auth_user_id,
      );
      if (deleteError) {
        console.error("resendInvitation deleteUser:", deleteError);
        return { success: false, error: "招待メールの再送に失敗しました" };
      }
    }

    const siteUrl = getSiteUrl();
    const { data: invited, error: inviteError } =
      await supabase.auth.admin.inviteUserByEmail(invitation.email, {
        data: {
          ...(invitation.business_unit_id
            ? { business_unit_id: invitation.business_unit_id }
            : {}),
        },
        redirectTo: `${siteUrl}/auth/callback?redirect_to=/invite/set-password`,
      });

    if (inviteError || !invited.user) {
      console.error("resendInvitation inviteUserByEmail:", inviteError);
      return {
        success: false,
        error: inviteError?.message ?? "招待メールの再送に失敗しました",
      };
    }

    const { error: updateError } = await supabase
      .from("user_invitations")
      .update({
        auth_user_id: invited.user.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", invitation.id);

    if (updateError) {
      console.error("resendInvitation update:", updateError);
      return { success: false, error: "招待の更新に失敗しました" };
    }

    revalidatePath("/admin/users-and-companies");
    return { success: true };
  } catch (error) {
    const ownerError = ownerAuthError(error);
    if (ownerError) return ownerError;
    console.error(error);
    return { success: false, error: "招待の再送に失敗しました" };
  }
}

export async function cancelInvitation(
  invitationId: string,
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    await requireOwner();
    const supabase = await createServiceClient();
    const { data: invitation, error } = await supabase
      .from("user_invitations")
      .select("id, auth_user_id, status")
      .eq("id", invitationId)
      .maybeSingle();

    if (error || !invitation) {
      return { success: false, error: "招待が見つかりません" };
    }
    if (invitation.status !== "pending") {
      return { success: false, error: "取り消せる未完了の招待ではありません" };
    }

    if (invitation.auth_user_id) {
      const { data: profile } = await supabase
        .from("private_users")
        .select("id")
        .eq("id", invitation.auth_user_id)
        .maybeSingle();
      if (
        canDeleteUnusedInviteAuthUser({
          hasProfile: Boolean(profile),
        })
      ) {
        const { error: deleteError } = await supabase.auth.admin.deleteUser(
          invitation.auth_user_id,
        );
        if (deleteError) {
          console.error("cancelInvitation deleteUser:", deleteError);
        }
      }
    }

    const now = new Date().toISOString();
    const { error: updateError } = await supabase
      .from("user_invitations")
      .update({
        status: "cancelled",
        cancelled_at: now,
        updated_at: now,
        auth_user_id: null,
      })
      .eq("id", invitation.id);

    if (updateError) {
      console.error("cancelInvitation update:", updateError);
      return { success: false, error: "招待の取消に失敗しました" };
    }

    revalidatePath("/admin/users-and-companies");
    return { success: true };
  } catch (error) {
    const ownerError = ownerAuthError(error);
    if (ownerError) return ownerError;
    console.error(error);
    return { success: false, error: "招待の取消に失敗しました" };
  }
}

async function assertSuspendTarget(
  targetUserId: string,
): Promise<{ operatorId: string } | { error: string }> {
  await requireOwner();
  const supabaseAnon = await createClient();
  const {
    data: { user: operator },
  } = await supabaseAnon.auth.getUser();
  if (!operator?.id) {
    return { error: "ログインが必要です" };
  }
  if (targetUserId === operator.id) {
    return { error: "自分自身は停止できません" };
  }
  if (await isUserIdOwner(targetUserId)) {
    return { error: "経営者アカウントは停止できません" };
  }
  return { operatorId: operator.id };
}

/**
 * 経営者がユーザーを停止する。XP・達成データは残し、公開面と集計から除外する。
 */
export async function adminSuspendUser(
  targetUserId: string,
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const gate = await assertSuspendTarget(targetUserId);
    if ("error" in gate) {
      return { success: false, error: gate.error };
    }
    const supabase = await createServiceClient();
    const { error: updateError } = await supabase
      .from("private_users")
      .update({ suspended_at: new Date().toISOString() })
      .eq("id", targetUserId);
    if (updateError) {
      console.error("adminSuspendUser private_users:", updateError);
      return { success: false, error: "停止状態の更新に失敗しました" };
    }
    const { error: referralError } = await supabase
      .from("user_referral")
      .update({ del_flg: true })
      .eq("user_id", targetUserId);
    if (referralError) {
      console.error("adminSuspendUser user_referral:", referralError);
    }
    const { error: banError } = await supabase.auth.admin.updateUserById(
      targetUserId,
      { ban_duration: "876600h" },
    );
    if (banError) {
      console.error("adminSuspendUser auth ban:", banError);
    }
    revalidatePath("/admin/users-and-companies");
    return { success: true };
  } catch (error) {
    if (error instanceof Error && error.message === "経営者権限が必要です") {
      return { success: false, error: "経営者権限が必要です" };
    }
    console.error(error);
    return { success: false, error: "ユーザーの停止に失敗しました" };
  }
}

/**
 * 経営者が停止ユーザーを再開する。
 */
export async function adminUnsuspendUser(
  targetUserId: string,
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const gate = await assertSuspendTarget(targetUserId);
    if ("error" in gate) {
      return { success: false, error: gate.error };
    }
    const supabase = await createServiceClient();
    const { error: updateError } = await supabase
      .from("private_users")
      .update({ suspended_at: null })
      .eq("id", targetUserId);
    if (updateError) {
      console.error("adminUnsuspendUser private_users:", updateError);
      return { success: false, error: "再開状態の更新に失敗しました" };
    }
    const { error: referralError } = await supabase
      .from("user_referral")
      .update({ del_flg: false })
      .eq("user_id", targetUserId);
    if (referralError) {
      console.error("adminUnsuspendUser user_referral:", referralError);
    }
    const { error: banError } = await supabase.auth.admin.updateUserById(
      targetUserId,
      { ban_duration: "none" },
    );
    if (banError) {
      console.error("adminUnsuspendUser auth unban:", banError);
    }
    revalidatePath("/admin/users-and-companies");
    return { success: true };
  } catch (error) {
    if (error instanceof Error && error.message === "経営者権限が必要です") {
      return { success: false, error: "経営者権限が必要です" };
    }
    console.error(error);
    return { success: false, error: "ユーザーの再開に失敗しました" };
  }
}
