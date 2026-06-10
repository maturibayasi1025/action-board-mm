"use server";

import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/types/supabase";
import { excludeCreatorFromPraisedUserIds } from "@/lib/utils/user-mission-praised";
import { revalidatePath } from "next/cache";
import type {
  SaveDraftUserMissionInput,
  SaveDraftUserMissionResult,
} from "./types";
export type {
  SaveDraftUserMissionInput,
  SaveDraftUserMissionResult,
} from "./types";

export async function saveDraftUserMissionAction(
  input: SaveDraftUserMissionInput,
): Promise<SaveDraftUserMissionResult> {
  const supabase = await createClient();

  try {
    // 認証チェック
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      // 認証エラーは静かに失敗（自動保存なので）
      return { success: false, error: "認証が必要です" };
    }

    const praisedUserIdsExcludingCreator = excludeCreatorFromPraisedUserIds(
      Array.isArray(input.praisedUserIds)
        ? input.praisedUserIds.filter(
            (id): id is string => typeof id === "string" && id.length > 0,
          )
        : [],
      user.id,
    );

    // 既存の下書きがある場合は更新、ない場合は新規作成
    if (input.draftId) {
      // 既存の下書きを更新
      const { data: existingMission, error: fetchError } = await supabase
        .from("user_missions")
        .select("id, created_by, status")
        .eq("id", input.draftId)
        .single();

      if (fetchError || !existingMission) {
        // 下書きが見つからない場合は新規作成
        return await createNewDraft(
          { ...input, praisedUserIds: praisedUserIdsExcludingCreator },
          user.id,
          supabase,
        );
      }

      // 作成者チェック
      if (existingMission.created_by !== user.id) {
        return { success: false, error: "権限がありません" };
      }

      // 下書き（pending）のみ更新可能
      if (existingMission.status !== "pending") {
        return { success: false, error: "下書きのみ更新可能です" };
      }

      // 下書きを更新
      const { data: mission, error: updateError } = await supabase
        .from("user_missions")
        .update({
          title: input.title || "（タイトル未入力）",
          content: input.content || "",
          image_paths:
            input.imagePaths && input.imagePaths.length > 0
              ? (input.imagePaths as Json)
              : [],
          updated_at: new Date().toISOString(),
        })
        .eq("id", input.draftId)
        .select()
        .single();

      if (updateError) {
        console.error("下書き更新エラー:", updateError);
        return { success: false, error: updateError.message };
      }

      // MVV項目を更新（既存を削除して再挿入）
      await supabase
        .from("user_mission_mvv_items")
        .delete()
        .eq("user_mission_id", mission.id);

      const mvvItems = [];
      if (input.mvvItems.passionateExecution) {
        mvvItems.push({
          user_mission_id: mission.id,
          mvv_type: "passionate_execution",
        });
      }
      if (input.mvvItems.supremeRelationships) {
        mvvItems.push({
          user_mission_id: mission.id,
          mvv_type: "supreme_relationships",
        });
      }
      if (input.mvvItems.happinessCirculation) {
        mvvItems.push({
          user_mission_id: mission.id,
          mvv_type: "happiness_circulation",
        });
      }

      if (mvvItems.length > 0) {
        await supabase.from("user_mission_mvv_items").insert(mvvItems);
      }

      // 賞賛対象ユーザーを更新（既存を削除して再挿入）
      await supabase
        .from("user_mission_praised_users")
        .delete()
        .eq("user_mission_id", mission.id);

      if (praisedUserIdsExcludingCreator.length > 0) {
        const praisedUsers = praisedUserIdsExcludingCreator.map((userId) => ({
          user_mission_id: mission.id,
          praised_user_id: userId,
        }));

        await supabase.from("user_mission_praised_users").insert(praisedUsers);
      }

      // 外部ユーザーを更新（既存を削除して再挿入）
      await supabase
        .from("user_mission_praised_external_users")
        .delete()
        .eq("user_mission_id", mission.id);

      if (
        input.praisedExternalUserNames &&
        input.praisedExternalUserNames.length > 0
      ) {
        const externalUsers = input.praisedExternalUserNames
          .map((name) => name.trim())
          .filter((name) => name.length > 0)
          .map((name) => ({
            user_mission_id: mission.id,
            praised_person_name: name,
          }));

        if (externalUsers.length > 0) {
          await supabase
            .from("user_mission_praised_external_users")
            .insert(externalUsers);
        }
      }

      return { success: true, missionId: mission.id };
    }
    // 新規下書きを作成
    return await createNewDraft(
      { ...input, praisedUserIds: praisedUserIdsExcludingCreator },
      user.id,
      supabase,
    );
  } catch (error) {
    console.error("saveDraftUserMissionActionエラー:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "下書き保存に失敗しました",
    };
  }
}

// 新規下書き作成のヘルパー関数
async function createNewDraft(
  input: SaveDraftUserMissionInput,
  userId: string,
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<SaveDraftUserMissionResult> {
  const { data: mission, error: missionError } = await supabase
    .from("user_missions")
    .insert({
      created_by: userId,
      title: input.title || "（タイトル未入力）",
      content: input.content || "",
      image_paths:
        input.imagePaths && input.imagePaths.length > 0
          ? (input.imagePaths as Json)
          : [],
      status: "pending", // 下書きとして保存
    })
    .select()
    .single();

  if (missionError) {
    console.error("下書き作成エラー:", missionError);
    return { success: false, error: missionError.message };
  }

  // MVV項目を挿入
  const mvvItems = [];
  if (input.mvvItems.passionateExecution) {
    mvvItems.push({
      user_mission_id: mission.id,
      mvv_type: "passionate_execution",
    });
  }
  if (input.mvvItems.supremeRelationships) {
    mvvItems.push({
      user_mission_id: mission.id,
      mvv_type: "supreme_relationships",
    });
  }
  if (input.mvvItems.happinessCirculation) {
    mvvItems.push({
      user_mission_id: mission.id,
      mvv_type: "happiness_circulation",
    });
  }

  if (mvvItems.length > 0) {
    await supabase.from("user_mission_mvv_items").insert(mvvItems);
  }

  // 賞賛対象ユーザーを挿入
  if (input.praisedUserIds.length > 0) {
    const praisedUsers = input.praisedUserIds.map((userId) => ({
      user_mission_id: mission.id,
      praised_user_id: userId,
    }));

    await supabase.from("user_mission_praised_users").insert(praisedUsers);
  }

  // 外部ユーザーを挿入
  if (
    input.praisedExternalUserNames &&
    input.praisedExternalUserNames.length > 0
  ) {
    const externalUsers = input.praisedExternalUserNames
      .map((name) => name.trim())
      .filter((name) => name.length > 0)
      .map((name) => ({
        user_mission_id: mission.id,
        praised_person_name: name,
      }));

    if (externalUsers.length > 0) {
      await supabase
        .from("user_mission_praised_external_users")
        .insert(externalUsers);
    }
  }

  return { success: true, missionId: mission.id };
}

// 下書きから公開
