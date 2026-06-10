"use server";

import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/types/supabase";
import { excludeCreatorFromPraisedUserIds } from "@/lib/utils/user-mission-praised";
import { revalidatePath } from "next/cache";
import type { UpdateApprovedUserMissionInput } from "./types";
export type { UpdateApprovedUserMissionInput } from "./types";

export async function updateUserMissionAction(
  missionId: string,
  input: UpdateApprovedUserMissionInput,
) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("認証に失敗しました。再ログインしてください。");
  }

  const { data: mission, error: missionError } = await supabase
    .from("user_missions")
    .select("id, created_by, status")
    .eq("id", missionId)
    .single();

  if (missionError || !mission) {
    throw new Error("グッジョブが見つかりません。");
  }

  if (mission.created_by !== user.id) {
    throw new Error("権限がありません。");
  }

  if (mission.status !== "approved") {
    throw new Error("公開済みのグッジョブのみ編集できます。");
  }

  const normalizedTitle = input.title.trim();
  const normalizedContent = input.content.trim();

  if (normalizedTitle.length === 0) {
    throw new Error("タイトルを入力してください。");
  }
  if (normalizedContent.length === 0) {
    throw new Error("内容を入力してください。");
  }

  const { error: updateError } = await supabase
    .from("user_missions")
    .update({
      title: normalizedTitle,
      content: normalizedContent,
      updated_at: new Date().toISOString(),
    })
    .eq("id", missionId);

  if (updateError) {
    throw new Error(`グッジョブの更新に失敗しました: ${updateError.message}`);
  }
  try {
    revalidatePath("/user-missions");
    revalidatePath("/user-missions/my");
    revalidatePath("/");
    revalidatePath(`/user-missions/${missionId}`);
  } catch (revalidateError) {
    console.error("Revalidate エラー（継続）:", revalidateError);
  }

  return { success: true };
}

export async function deleteDraftUserMissionAction(draftId: string) {
  const supabase = await createClient();

  try {
    // 認証チェック
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      console.error("認証エラー:", authError);
      throw new Error("認証に失敗しました。再ログインしてください。");
    }

    if (!user) {
      throw new Error(
        "ログインが必要です。ログインしてから再度お試しください。",
      );
    }

    // 下書きを取得
    const { data: draft, error: fetchError } = await supabase
      .from("user_missions")
      .select("id, created_by, status, image_paths")
      .eq("id", draftId)
      .single();

    if (fetchError || !draft) {
      throw new Error("下書きが見つかりません");
    }

    // 作成者チェック
    if (draft.created_by !== user.id) {
      throw new Error("権限がありません");
    }

    // 下書き（pending）のみ削除可能
    if (draft.status !== "pending") {
      throw new Error("下書きのみ削除可能です");
    }

    // 画像ファイルをストレージから削除
    const rawImagePaths = draft.image_paths as unknown;
    if (rawImagePaths && Array.isArray(rawImagePaths)) {
      const imagePaths = rawImagePaths.filter(
        (path): path is string => typeof path === "string" && path.length > 0,
      );

      if (imagePaths.length > 0) {
        try {
          const { error: deleteImageError } = await supabase.storage
            .from("user_mission_images")
            .remove(imagePaths);

          if (deleteImageError) {
            console.error("画像削除エラー:", deleteImageError);
            // 画像削除に失敗しても下書き削除処理は継続
          }
        } catch (imageError) {
          console.error("画像削除エラー:", imageError);
          // 画像削除に失敗しても下書き削除処理は継続
        }
      }
    }

    // データベースから下書きを削除（CASCADEで関連データも自動削除）
    const { error: deleteError } = await supabase
      .from("user_missions")
      .delete()
      .eq("id", draftId);

    if (deleteError) {
      console.error("下書き削除エラー:", deleteError);
      throw new Error(`下書きの削除に失敗しました: ${deleteError.message}`);
    }

    try {
      revalidatePath("/user-missions");
      revalidatePath("/user-missions/my");
      revalidatePath("/");
    } catch (revalidateError) {
      console.error("Revalidate エラー（継続）:", revalidateError);
      // 再検証失敗しても削除処理は継続
    }

    return { success: true };
  } catch (error) {
    console.error("deleteDraftUserMissionAction総合エラー:", error);
    throw error;
  }
}
