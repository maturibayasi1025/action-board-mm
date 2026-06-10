"use server";

import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/types/supabase";
import { excludeCreatorFromPraisedUserIds } from "@/lib/utils/user-mission-praised";
import { revalidatePath } from "next/cache";
import {
  awardPointsForMissionCreation,
  sendSlackNotificationForMissionCreation,
} from "./_helpers";
import {
  checkIsFirstGoodJobToday,
  getAvailableSharedMissions,
} from "./shared-mission";

export async function publishDraftUserMissionAction(draftId: string) {
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
      .select(`
        *,
        user_mission_mvv_items (
          mvv_type
        ),
        user_mission_praised_users (
          praised_user_id
        ),
        user_mission_praised_external_users (
          praised_person_name
        )
      `)
      .eq("id", draftId)
      .single();

    if (fetchError || !draft) {
      throw new Error("下書きが見つかりません");
    }

    // 作成者チェック
    if (draft.created_by !== user.id) {
      throw new Error("権限がありません");
    }

    // 下書き（pending）のみ公開可能
    if (draft.status !== "pending") {
      throw new Error("下書きのみ公開可能です");
    }

    // バリデーション
    if (!draft.title || draft.title.trim().length === 0) {
      throw new Error("タイトルを入力してください");
    }
    if (!draft.content || draft.content.trim().length === 0) {
      throw new Error("内容を入力してください");
    }

    const rawPraisedUserIds =
      draft.user_mission_praised_users?.map(
        (p: { praised_user_id: string }) => p.praised_user_id,
      ) || [];

    const praisedUserIds = excludeCreatorFromPraisedUserIds(
      rawPraisedUserIds,
      user.id,
    );

    const praisedExternalUserNames =
      draft.user_mission_praised_external_users?.map(
        (p: { praised_person_name: string }) => p.praised_person_name,
      ) || [];

    if (praisedUserIds.length === 0 && praisedExternalUserNames.length === 0) {
      if (rawPraisedUserIds.some((id) => id === user.id)) {
        throw new Error(
          "自分自身を賞賛対象にすることはできません。他のメンバーを少なくとも1人選んでください。",
        );
      }
      throw new Error("賞賛に値するメンバーを少なくとも1人選択してください");
    }

    await supabase
      .from("user_mission_praised_users")
      .delete()
      .eq("user_mission_id", draftId)
      .eq("praised_user_id", user.id);

    const mvvItems = draft.user_mission_mvv_items || [];
    if (mvvItems.length === 0) {
      throw new Error("MVV項目を少なくとも1つ選択してください");
    }

    // その日初めてのグッジョブ投稿かチェック（公開前にチェック）
    const isFirstToday = await checkIsFirstGoodJobToday(user.id, supabase);

    const nowIso = new Date().toISOString();
    // 下書きを公開（statusをapprovedに更新）
    const { data: mission, error: updateError } = await supabase
      .from("user_missions")
      .update({
        status: "approved",
        approved_at: nowIso,
        approved_by: user.id,
        published_at: nowIso, // 公開日時（1日1グッジョブ判定用）
        updated_at: nowIso,
      })
      .eq("id", draftId)
      .select()
      .single();

    if (updateError) {
      console.error("下書き公開エラー:", updateError);
      throw new Error(`下書きの公開に失敗しました: ${updateError.message}`);
    }

    // ポイント付与処理
    await awardPointsForMissionCreation(
      mission.id,
      user.id,
      praisedUserIds,
      praisedExternalUserNames,
      supabase,
    );

    // Slack通知を送信（Webhook URLが設定されている場合）
    if (process.env.SLACK_WEBHOOK_URL) {
      try {
        // 画像パスを取得（draftから取得）
        const rawImagePaths = (
          draft as unknown as {
            image_paths?: string[] | unknown;
          }
        ).image_paths;
        console.log("[Slack通知] draft.image_paths取得:", {
          rawImagePaths,
          rawImagePathsType: typeof rawImagePaths,
          rawImagePathsIsArray: Array.isArray(rawImagePaths),
        });

        // JSONB型のデータを正しく配列として処理
        let imagePaths: string[] = [];
        if (Array.isArray(rawImagePaths)) {
          imagePaths = rawImagePaths.filter(
            (path): path is string => typeof path === "string",
          );
        } else if (rawImagePaths) {
          console.warn(
            "[Slack通知] image_pathsが配列ではありません:",
            rawImagePaths,
          );
        }

        console.log("[Slack通知] 処理後のimagePaths:", {
          imagePaths,
          imagePathsLength: imagePaths.length,
        });

        await sendSlackNotificationForMissionCreation(
          mission.id,
          mission.title,
          mission.content,
          user.id,
          praisedUserIds,
          praisedExternalUserNames,
          imagePaths,
          supabase,
        );
      } catch (slackError) {
        console.error("Slack通知エラー（継続）:", slackError);
        // Slack通知失敗しても公開処理は継続
      }
    }

    if (!process.env.CF_PAGES) {
      try {
        revalidatePath("/user-missions");
        revalidatePath("/user-missions/my");
        revalidatePath("/");
      } catch (revalidateError) {
        console.error("Revalidate エラー（継続）:", revalidateError);
        // 再検証失敗しても公開処理は継続
      }
    }

    // 初回投稿の場合は共有グッジョブ候補を取得して返す（即時投稿と同様）
    let availableSharedMissions: Array<{
      id: string;
      title: string;
      icon_url: string | null;
      difficulty: number;
      content: string | null;
    }> = [];
    if (isFirstToday) {
      availableSharedMissions = await getAvailableSharedMissions(
        user.id,
        supabase,
      );
    }

    return {
      success: true,
      missionId: mission.id,
      availableSharedMissions,
    };
  } catch (error) {
    console.error("publishDraftUserMissionAction総合エラー:", error);
    throw error;
  }
}

/**
 * その日（JST）初めてのグッジョブ投稿かどうかをチェック
 * 投稿作成前に呼び出すため、カウントが0の場合にtrueを返す
 */
