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
  isSuspended?: boolean;
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
      .select("id, name, suspended_at")
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
            isSuspended: profile.suspended_at !== null,
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
          .select("name, suspended_at")
          .eq("id", emailUser.id)
          .single();

        results.push({
          id: emailUser.id,
          name: profile?.name || emailUser.email || "不明",
          email: emailUser.email,
          isSuspended: profile?.suspended_at != null,
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
  badgeImagePath,
  iconImagePath,
}: {
  userId: string;
  badgeType:
    | "MVV_PASSIONATE_EXECUTION"
    | "MVV_SUPREME_RELATIONSHIPS"
    | "MVV_HAPPINESS_CIRCULATION"
    | "MVV_START_DASH";
  quarterPeriod?: string;
  badgeImagePath?: string | null;
  iconImagePath?: string | null;
}): Promise<{ success: true } | { success: false; error: string }> {
  try {
    await requireOwner();

    const result = await awardMvvBadge({
      user_id: userId,
      badge_type: badgeType,
      quarter_period: quarterPeriod,
      badge_image_path: badgeImagePath,
      icon_image_path: iconImagePath,
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

/**
 * MVVバッジ画像をSupabase Storageにアップロード
 */
export async function uploadMvvBadgeImageAction(
  formData: FormData,
): Promise<
  | { success: true; data: { path: string; url: string } }
  | { success: false; error: string }
> {
  try {
    await requireOwner();

    const file = formData.get("file") as File | null;
    const quarterPeriod = formData.get("quarterPeriod") as string | null;
    const badgeType = formData.get("badgeType") as string | null;
    const imageType = formData.get("imageType") as "badge" | "icon" | null;

    if (!file || !quarterPeriod || !badgeType || !imageType) {
      return {
        success: false,
        error: "必要なパラメータが不足しています",
      };
    }

    // ファイルサイズチェック（最大10MB）
    if (file.size > 10 * 1024 * 1024) {
      return {
        success: false,
        error: "ファイルサイズが大きすぎます。最大10MBまでです。",
      };
    }

    // MIMEタイプチェック
    const allowedMimeTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
    ];
    if (!allowedMimeTypes.includes(file.type)) {
      return {
        success: false,
        error: `対応していないファイル形式です。許可されている形式: ${allowedMimeTypes.join(", ")}`,
      };
    }

    const supabase = await createServiceClient();

    // ファイル名を生成: {quarter_period}/{badge_type}/{imageType}_{timestamp}.{ext}
    const fileExt = file.name.split(".").pop() || "png";
    const timestamp = Date.now();
    const fileName = `${quarterPeriod}/${badgeType}/${imageType}_${timestamp}.${fileExt}`;

    // ファイルのバイナリデータを取得
    const fileBuffer = await file.arrayBuffer();

    // Supabase Storageにアップロード
    const { data, error } = await supabase.storage
      .from("mvv_badge_images")
      .upload(fileName, fileBuffer, {
        contentType: file.type,
        upsert: true,
      });

    if (error) {
      console.error("画像アップロードエラー:", error);
      return {
        success: false,
        error: `画像のアップロードに失敗しました: ${error.message}`,
      };
    }

    // 公開URLを取得
    const {
      data: { publicUrl },
    } = supabase.storage.from("mvv_badge_images").getPublicUrl(fileName);

    return {
      success: true,
      data: {
        path: data.path,
        url: publicUrl,
      },
    };
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
 * MVVバッジの画像パスを更新する
 */
export async function updateMvvBadgeImageAction({
  userId,
  badgeType,
  quarterPeriod,
  imageType,
  imagePath,
}: {
  userId: string;
  badgeType:
    | "MVV_PASSIONATE_EXECUTION"
    | "MVV_SUPREME_RELATIONSHIPS"
    | "MVV_HAPPINESS_CIRCULATION"
    | "MVV_START_DASH";
  quarterPeriod: string;
  imageType: "badge" | "icon";
  imagePath: string;
}): Promise<{ success: true } | { success: false; error: string }> {
  try {
    await requireOwner();

    const supabase = await createServiceClient();

    // 既存のバッジを検索
    const { data: existing, error: fetchError } = await supabase
      .from("user_badges")
      .select("*")
      .eq("user_id", userId)
      .eq("badge_type", badgeType)
      .eq("quarter_period", quarterPeriod)
      .maybeSingle();

    if (fetchError && fetchError.code !== "PGRST116") {
      // PGRST116 = no rows returned
      console.error("Error fetching existing MVV badge:", fetchError);
      return {
        success: false,
        error: `既存バッジの確認に失敗しました: ${fetchError.message}`,
      };
    }

    // バッジが存在しない場合は成功を返す（エラーにしない）
    if (!existing) {
      return { success: true };
    }

    // 画像パスを更新
    const updateData: {
      badge_image_path?: string;
      icon_image_path?: string;
      updated_at: string;
    } = {
      updated_at: new Date().toISOString(),
    };

    if (imageType === "badge") {
      updateData.badge_image_path = imagePath;
    } else {
      updateData.icon_image_path = imagePath;
    }

    const { error: updateError } = await supabase
      .from("user_badges")
      .update(updateData)
      .eq("id", existing.id);

    if (updateError) {
      console.error("Error updating MVV badge image:", updateError);
      return {
        success: false,
        error: `バッジの画像パス更新に失敗しました: ${updateError.message}`,
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
