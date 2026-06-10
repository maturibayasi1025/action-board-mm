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
import type { CreateUserMissionInput } from "./types";
export type { CreateUserMissionInput } from "./types";

export async function createUserMissionAction(input: CreateUserMissionInput) {
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

    console.log("認証済みユーザー:", user.id);

    // その日初めてのグッジョブ投稿かチェック（投稿作成前にチェック）
    console.log("[初回投稿チェック] 投稿作成前にチェック開始");
    const isFirstToday = await checkIsFirstGoodJobToday(user.id, supabase);
    console.log("[初回投稿チェック] 結果:", { isFirstToday });

    // 入力値を正規化（undefined/nullを空配列に、空文字列をフィルタリング）
    const normalizedImagePaths = Array.isArray(input.imagePaths)
      ? input.imagePaths.filter(
          (path): path is string => typeof path === "string" && path.length > 0,
        )
      : [];
    const normalizedPraisedUserIds = Array.isArray(input.praisedUserIds)
      ? input.praisedUserIds.filter(
          (id): id is string => typeof id === "string" && id.length > 0,
        )
      : [];
    const normalizedPraisedExternalUserNames = Array.isArray(
      input.praisedExternalUserNames,
    )
      ? input.praisedExternalUserNames.filter(
          (name): name is string =>
            typeof name === "string" && name.trim().length > 0,
        )
      : [];

    const praisedUserIdsWithoutCreator = excludeCreatorFromPraisedUserIds(
      normalizedPraisedUserIds,
      user.id,
    );

    if (
      praisedUserIdsWithoutCreator.length === 0 &&
      normalizedPraisedExternalUserNames.length === 0
    ) {
      if (normalizedPraisedUserIds.length > 0) {
        throw new Error(
          "自分自身を賞賛対象にすることはできません。他のメンバーを少なくとも1人選んでください。",
        );
      }
      throw new Error("賞賛に値するメンバーを少なくとも1人選択してください");
    }

    // グッジョブ作成（即時承認）
    const nowIso = new Date().toISOString();
    const { data: mission, error: missionError } = await supabase
      .from("user_missions")
      .insert({
        created_by: user.id,
        title: input.title,
        content: input.content,
        image_paths:
          normalizedImagePaths.length > 0 ? (normalizedImagePaths as Json) : [],
        status: "approved", // 自動承認で即時表示
        approved_at: nowIso,
        approved_by: user.id, // 自分自身を承認者として設定
        published_at: nowIso, // 公開日時（1日1グッジョブ判定用）
      })
      .select()
      .single();

    if (missionError) {
      console.error("グッジョブ作成エラー:", {
        code: missionError.code,
        message: missionError.message,
        details: missionError.details,
        hint: missionError.hint,
      });

      if (missionError.code === "42501") {
        throw new Error("権限がありません。ログイン状態を確認してください。");
      }
      if (missionError.code === "23503") {
        throw new Error("データの整合性エラーが発生しました。");
      }
      throw new Error(`グッジョブ作成に失敗しました: ${missionError.message}`);
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
      const { error: mvvError } = await supabase
        .from("user_mission_mvv_items")
        .insert(mvvItems);

      if (mvvError) {
        console.error("MVV項目挿入エラー:", mvvError);
        // ロールバック
        await supabase.from("user_missions").delete().eq("id", mission.id);
        throw new Error(`MVV項目の保存に失敗しました: ${mvvError.message}`);
      }
    }

    // 賞賛対象ユーザーを挿入
    if (praisedUserIdsWithoutCreator.length > 0) {
      const praisedUsers = praisedUserIdsWithoutCreator.map((userId) => ({
        user_mission_id: mission.id,
        praised_user_id: userId,
      }));

      const { error: praisedError } = await supabase
        .from("user_mission_praised_users")
        .insert(praisedUsers);

      if (praisedError) {
        console.error("賞賛対象ユーザー挿入エラー:", praisedError);
        // ロールバック
        await supabase.from("user_missions").delete().eq("id", mission.id);
        throw new Error(
          `賞賛対象ユーザーの保存に失敗しました: ${praisedError.message}`,
        );
      }
    }

    // 外部ユーザーを挿入
    if (normalizedPraisedExternalUserNames.length > 0) {
      const externalUsers = normalizedPraisedExternalUserNames.map((name) => ({
        user_mission_id: mission.id,
        praised_person_name: name,
      }));

      if (externalUsers.length > 0) {
        const { error: externalError } = await supabase
          .from("user_mission_praised_external_users")
          .insert(externalUsers);

        if (externalError) {
          console.error("外部ユーザー挿入エラー:", externalError);
          // ロールバック
          await supabase.from("user_missions").delete().eq("id", mission.id);
          throw new Error(
            `外部ユーザーの保存に失敗しました: ${externalError.message}`,
          );
        }

        // 外部ユーザー用の保留ポイントを保存
        const pendingXpRecords = externalUsers.map((extUser) => ({
          external_user_name: extUser.praised_person_name,
          user_mission_id: mission.id,
          xp_amount: 5,
          source_type: "USER_MISSION_PRAISED_EXTERNAL",
          description: `ユーザーグッジョブ「${input.title}」で賞賛されました（保留中）`,
        }));

        // サービスロールで挿入（RLSポリシーで通常ユーザーは挿入不可）
        const { createServiceClient } = await import("@/lib/supabase/server");
        const serviceSupabase = await createServiceClient();

        const { error: pendingXpError } = await serviceSupabase
          .from("external_user_pending_xp")
          .insert(pendingXpRecords);

        if (pendingXpError) {
          console.error("保留ポイント挿入エラー:", pendingXpError);
          // エラーが発生してもグッジョブ作成は続行（ポイントは後で手動で付与可能）
        }
      }
    }

    // ポイント付与処理
    await awardPointsForMissionCreation(
      mission.id,
      user.id,
      praisedUserIdsWithoutCreator,
      normalizedPraisedExternalUserNames,
      supabase,
    );

    // Slack通知を送信（Webhook URLが設定されている場合）
    if (process.env.SLACK_WEBHOOK_URL) {
      try {
        // 画像パスを取得（データベースから取得したmissionから取得）
        const rawImagePaths = (
          mission as unknown as {
            image_paths?: string[] | unknown;
          }
        ).image_paths;
        console.log("[Slack通知] mission.image_paths取得:", {
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
          input.title,
          input.content,
          user.id,
          praisedUserIdsWithoutCreator,
          normalizedPraisedExternalUserNames,
          imagePaths,
          supabase,
        );
      } catch (slackError) {
        console.error("Slack通知エラー（継続）:", slackError);
        // Slack通知失敗してもグッジョブ作成処理は継続
      }
    }

    if (!process.env.CF_PAGES) {
      try {
        revalidatePath("/user-missions");
        revalidatePath("/user-missions/my");
        revalidatePath("/");
      } catch (revalidateError) {
        // エラーの詳細をログに記録（無限ループを防ぐため、詳細は開発環境のみ）
        const errorMessage =
          revalidateError instanceof Error
            ? revalidateError.message
            : String(revalidateError);
        const errorStack =
          revalidateError instanceof Error ? revalidateError.stack : undefined;

        if (process.env.NODE_ENV === "development") {
          console.error("[createUserMissionAction] Revalidate エラー詳細:", {
            message: errorMessage,
            stack: errorStack,
            errorType:
              revalidateError instanceof Error
                ? revalidateError.constructor.name
                : typeof revalidateError,
          });
        } else {
          console.error(
            "[createUserMissionAction] Revalidate エラー（継続）:",
            errorMessage,
          );
        }
        // 再検証失敗してもグッジョブ作成処理は継続
      }
    }

    // 初回投稿チェックの結果に基づいて共有グッジョブを取得
    let availableSharedMissions: Array<{
      id: string;
      title: string;
      icon_url: string | null;
      difficulty: number;
      content: string | null;
    }> = [];

    if (isFirstToday) {
      console.log("[初回投稿チェック] 共有グッジョブを取得開始");
      try {
        availableSharedMissions = await getAvailableSharedMissions(
          user.id,
          supabase,
        );
        console.log("[初回投稿チェック] 共有グッジョブ取得完了:", {
          count: availableSharedMissions.length,
        });
      } catch (error) {
        console.error("[初回投稿チェック] 共有グッジョブ取得エラー:", error);
        // エラーが発生してもグッジョブ作成処理は継続
        availableSharedMissions = [];
      }
    }

    return {
      success: true,
      missionId: mission.id,
      availableSharedMissions,
    };
  } catch (error) {
    console.error("createUserMissionAction総合エラー:", error);
    throw error;
  }
}
