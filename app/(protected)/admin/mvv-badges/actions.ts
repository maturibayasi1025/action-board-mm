"use server";

import {
  awardMvvBadge,
  getMvvBadgesByQuarter,
  getUserMvvBadges,
  removeMvvBadge,
} from "@/lib/services/badges";
import { createServiceClient } from "@/lib/supabase/server";
import { getCurrentQuarter, getQuarterPeriod } from "@/lib/types/badge";
import { requireOwner } from "@/lib/utils/isOwner";
import { revalidatePath } from "next/cache";

export interface SearchUserResult {
  id: string;
  name: string;
  email?: string;
}

/**
 * ユーザーを検索する（名前またはメールアドレスで部分一致）
 */
export async function searchUsers(
  query: string,
): Promise<
  | { success: true; data: SearchUserResult[] }
  | { success: false; error: string }
> {
  try {
    await requireOwner();

    if (!query || query.trim().length === 0) {
      return { success: true, data: [] };
    }

    const supabase = await createServiceClient();
    const searchTerm = `%${query.trim()}%`;

    // public_user_profilesから名前で検索
    const { data: profiles, error: profilesError } = await supabase
      .from("public_user_profiles")
      .select("id, name")
      .ilike("name", searchTerm)
      .limit(20);

    if (profilesError) {
      console.error("ユーザー検索エラー（profiles）:", profilesError);
      return {
        success: false,
        error: `ユーザー検索に失敗しました: ${profilesError.message}`,
      };
    }

    // メールアドレスで検索（get_user_by_email関数を使用）
    const { data: emailUsers, error: emailError } = await supabase.rpc(
      "get_user_by_email",
      { user_email: query.trim() },
    );

    if (emailError && emailError.code !== "PGRST116") {
      console.error("ユーザー検索エラー（email）:", emailError);
      // メール検索エラーは無視して続行
    }

    // 結果をマージ（重複を除去）
    const userIds = new Set<string>();
    const results: SearchUserResult[] = [];

    // プロフィールから取得したユーザーを追加
    if (profiles) {
      for (const profile of profiles) {
        if (!userIds.has(profile.id)) {
          userIds.add(profile.id);
          results.push({
            id: profile.id,
            name: profile.name,
          });
        }
      }
    }

    // メール検索結果を追加
    if (emailUsers && emailUsers.length > 0) {
      const emailUser = emailUsers[0];
      if (!userIds.has(emailUser.id)) {
        userIds.add(emailUser.id);
        // プロフィール情報を取得
        const { data: profile } = await supabase
          .from("public_user_profiles")
          .select("name")
          .eq("id", emailUser.id)
          .single();

        results.push({
          id: emailUser.id,
          name: profile?.name || emailUser.email || "不明",
          email: emailUser.email,
        });
      }
    }

    return { success: true, data: results };
  } catch (error) {
    if (error instanceof Error && error.message === "経営者権限が必要です") {
      return {
        success: false,
        error: "経営者権限が必要です",
      };
    }
    console.error("予期しないエラー:", error);
    return {
      success: false,
      error: "予期しないエラーが発生しました",
    };
  }
}

/**
 * MVVバッジを付与する
 */
export async function awardMvvBadgeAction({
  userId,
  badgeType,
  quarterPeriod,
}: {
  userId: string;
  badgeType:
    | "MVV_PASSIONATE_EXECUTION"
    | "MVV_SUPREME_RELATIONSHIPS"
    | "MVV_HAPPINESS_CIRCULATION";
  quarterPeriod?: string;
}): Promise<{ success: true } | { success: false; error: string }> {
  try {
    await requireOwner();

    const result = await awardMvvBadge({
      user_id: userId,
      badge_type: badgeType,
      quarter_period: quarterPeriod,
    });

    if (!result.success) {
      return {
        success: false,
        error: result.error || "バッジの付与に失敗しました",
      };
    }

    revalidatePath("/admin/mvv-badges");
    revalidatePath(`/users/${userId}`);

    return { success: true };
  } catch (error) {
    if (error instanceof Error && error.message === "経営者権限が必要です") {
      return {
        success: false,
        error: "経営者権限が必要です",
      };
    }
    console.error("予期しないエラー:", error);
    return {
      success: false,
      error: "予期しないエラーが発生しました",
    };
  }
}

/**
 * ユーザーのMVVバッジ一覧を取得
 */
export async function getUserMvvBadgesAction(
  userId: string,
): Promise<
  | { success: true; data: Awaited<ReturnType<typeof getUserMvvBadges>> }
  | { success: false; error: string }
> {
  try {
    await requireOwner();

    const badges = await getUserMvvBadges(userId);

    return { success: true, data: badges };
  } catch (error) {
    if (error instanceof Error && error.message === "経営者権限が必要です") {
      return {
        success: false,
        error: "経営者権限が必要です",
      };
    }
    console.error("予期しないエラー:", error);
    return {
      success: false,
      error: "予期しないエラーが発生しました",
    };
  }
}

/**
 * 指定四半期のMVVバッジ一覧を取得
 */
export async function getMvvBadgesByQuarterAction(
  quarterPeriod: string,
): Promise<
  | { success: true; data: Awaited<ReturnType<typeof getMvvBadgesByQuarter>> }
  | { success: false; error: string }
> {
  try {
    await requireOwner();

    const badges = await getMvvBadgesByQuarter(quarterPeriod);

    return { success: true, data: badges };
  } catch (error) {
    if (error instanceof Error && error.message === "経営者権限が必要です") {
      return {
        success: false,
        error: "経営者権限が必要です",
      };
    }
    console.error("予期しないエラー:", error);
    return {
      success: false,
      error: "予期しないエラーが発生しました",
    };
  }
}

/**
 * MVVバッジを削除する
 */
export async function removeMvvBadgeAction(
  badgeId: string,
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    await requireOwner();

    const result = await removeMvvBadge(badgeId);

    if (!result.success) {
      return {
        success: false,
        error: result.error || "バッジの削除に失敗しました",
      };
    }

    revalidatePath("/admin/mvv-badges");

    return { success: true };
  } catch (error) {
    if (error instanceof Error && error.message === "経営者権限が必要です") {
      return {
        success: false,
        error: "経営者権限が必要です",
      };
    }
    console.error("予期しないエラー:", error);
    return {
      success: false,
      error: "予期しないエラーが発生しました",
    };
  }
}

/**
 * 現在の四半期を取得
 */
export async function getCurrentQuarterAction(): Promise<{
  success: true;
  data: string;
}> {
  return { success: true, data: getCurrentQuarter() };
}
