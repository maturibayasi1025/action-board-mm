"use server";

import { createServiceClient } from "@/lib/supabase/server";
import { isOwner, requireOwner } from "@/lib/utils/isOwner";
import { revalidatePath } from "next/cache";

export interface SetImportantMissionInput {
  missionId: string;
  isImportant: boolean;
  displayStartDate?: string | null; // ISO 8601形式の日時文字列
  displayEndDate?: string | null; // ISO 8601形式の日時文字列
}

/**
 * 重要グッジョブを設定・更新する
 * 既存のミッションを重要グッジョブとして設定する
 */
export async function setImportantMission(
  input: SetImportantMissionInput,
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    // 経営者権限チェック
    await requireOwner();

    // 期間設定のバリデーション
    if (
      input.displayStartDate &&
      input.displayEndDate &&
      new Date(input.displayStartDate) > new Date(input.displayEndDate)
    ) {
      return {
        success: false,
        error: "表示開始日時は表示終了日時より前である必要があります",
      };
    }

    // サービスロールクライアントを使用（RLSをバイパス）
    const supabase = await createServiceClient();

    // ミッションが存在するか確認
    const { data: existingMission, error: fetchError } = await supabase
      .from("missions")
      .select("id")
      .eq("id", input.missionId)
      .single();

    if (fetchError || !existingMission) {
      return {
        success: false,
        error: "指定されたグッジョブが見つかりません",
      };
    }

    // 重要グッジョブ設定を更新
    const updateData: {
      is_important: boolean;
      important_display_start_date?: string | null;
      important_display_end_date?: string | null;
    } = {
      is_important: input.isImportant,
    };

    if (input.isImportant) {
      // 重要グッジョブとして設定する場合のみ日時を設定
      updateData.important_display_start_date = input.displayStartDate || null;
      updateData.important_display_end_date = input.displayEndDate || null;
    } else {
      // 重要グッジョブを解除する場合は日時もクリア
      updateData.important_display_start_date = null;
      updateData.important_display_end_date = null;
    }

    const { error: updateError } = await supabase
      .from("missions")
      .update(updateData)
      .eq("id", input.missionId);

    if (updateError) {
      console.error("重要グッジョブ設定エラー:", updateError);
      return {
        success: false,
        error: `重要グッジョブの設定に失敗しました: ${updateError.message}`,
      };
    }

    // キャッシュを再検証
    revalidatePath("/");
    revalidatePath("/admin/important-missions");

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
 * 重要グッジョブの一覧を取得する
 */
export async function getImportantMissions() {
  try {
    // 経営者権限チェック（表示のみなので、チェックは緩くする）
    const owner = await isOwner();
    if (!owner) {
      return { success: false, error: "経営者権限が必要です" };
    }

    const supabase = await createServiceClient();

    const { data, error } = await supabase
      .from("missions")
      .select(
        "id, title, is_important, important_display_start_date, important_display_end_date, created_at",
      )
      .eq("is_important", true)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("重要グッジョブ取得エラー:", error);
      return {
        success: false,
        error: `重要グッジョブの取得に失敗しました: ${error.message}`,
      };
    }

    return {
      success: true,
      data: data || [],
    };
  } catch (error) {
    console.error("予期しないエラー:", error);
    return {
      success: false,
      error: "予期しないエラーが発生しました",
    };
  }
}

/**
 * すべてのミッションを取得する（ドロップダウン用）
 */
export async function getAllMissions() {
  try {
    const owner = await isOwner();
    if (!owner) {
      return { success: false, error: "経営者権限が必要です" };
    }

    const supabase = await createServiceClient();

    const { data, error } = await supabase
      .from("missions")
      .select("id, title, is_hidden")
      .order("title", { ascending: true });

    if (error) {
      console.error("ミッション取得エラー:", error);
      return {
        success: false,
        error: `ミッションの取得に失敗しました: ${error.message}`,
      };
    }

    return {
      success: true,
      data: data || [],
    };
  } catch (error) {
    console.error("予期しないエラー:", error);
    return {
      success: false,
      error: "予期しないエラーが発生しました",
    };
  }
}
