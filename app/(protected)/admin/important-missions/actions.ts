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

export interface CreateMissionInput {
  title: string;
  slug: string;
  content?: string | null;
  difficulty: number;
  required_artifact_type: string;
  icon_url?: string | null;
  event_date?: string | null;
  max_achievement_count?: number | null;
  artifact_label?: string | null;
  ogp_image_url?: string | null;
  is_hidden?: boolean;
  is_featured?: boolean;
  is_important?: boolean;
  important_display_start_date?: string | null;
  important_display_end_date?: string | null;
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

/**
 * 新規グッジョブを作成する
 */
export async function createMission(
  input: CreateMissionInput,
): Promise<
  { success: true; data: { id: string } } | { success: false; error: string }
> {
  try {
    // 経営者権限チェック
    await requireOwner();

    // バリデーション
    if (!input.title || input.title.trim().length === 0) {
      return {
        success: false,
        error: "タイトルは必須です",
      };
    }

    if (!input.slug || input.slug.trim().length === 0) {
      return {
        success: false,
        error: "スラッグは必須です",
      };
    }

    // slugの形式チェック（英数字、ハイフン、アンダースコアのみ）
    if (!/^[a-z0-9_-]+$/.test(input.slug)) {
      return {
        success: false,
        error: "スラッグは英数字、ハイフン、アンダースコアのみ使用できます",
      };
    }

    if (!input.difficulty || input.difficulty < 1 || input.difficulty > 5) {
      return {
        success: false,
        error: "難易度は1から5の範囲で指定してください",
      };
    }

    if (!input.required_artifact_type) {
      return {
        success: false,
        error: "成果物の種類は必須です",
      };
    }

    // 期間設定のバリデーション
    if (
      input.important_display_start_date &&
      input.important_display_end_date &&
      new Date(input.important_display_start_date) >
        new Date(input.important_display_end_date)
    ) {
      return {
        success: false,
        error: "表示開始日時は表示終了日時より前である必要があります",
      };
    }

    // サービスロールクライアントを使用（RLSをバイパス）
    const supabase = await createServiceClient();

    // slugのユニーク性チェック
    const { data: existingMission, error: fetchError } = await supabase
      .from("missions")
      .select("id")
      .eq("slug", input.slug)
      .single();

    if (fetchError && fetchError.code !== "PGRST116") {
      // PGRST116は「行が見つからない」エラーなので、これは正常（slugがユニーク）
      console.error("slugチェックエラー:", fetchError);
      return {
        success: false,
        error: `スラッグの確認に失敗しました: ${fetchError.message}`,
      };
    }

    if (existingMission) {
      return {
        success: false,
        error: "このスラッグは既に使用されています",
      };
    }

    // UUIDを生成（crypto.randomUUID()を使用）
    const missionId = crypto.randomUUID();
    const missionData = {
      id: missionId,
      slug: input.slug,
      title: input.title.trim(),
      content: input.content?.trim() || null,
      difficulty: input.difficulty,
      required_artifact_type: input.required_artifact_type,
      icon_url: input.icon_url?.trim() || null,
      event_date: input.event_date || null,
      max_achievement_count: input.max_achievement_count || null,
      artifact_label: input.artifact_label?.trim() || null,
      ogp_image_url: input.ogp_image_url?.trim() || null,
      is_hidden: input.is_hidden || false,
      is_featured: input.is_featured || false,
      is_important: input.is_important || false,
      important_display_start_date: input.important_display_start_date || null,
      important_display_end_date: input.important_display_end_date || null,
    };

    const { data: createdMission, error: insertError } = await supabase
      .from("missions")
      .insert(missionData)
      .select("id")
      .single();

    if (insertError) {
      console.error("グッジョブ作成エラー:", insertError);
      return {
        success: false,
        error: `グッジョブの作成に失敗しました: ${insertError.message}`,
      };
    }

    // キャッシュを再検証
    revalidatePath("/");
    revalidatePath("/admin/important-missions");

    return {
      success: true,
      data: { id: createdMission.id },
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
