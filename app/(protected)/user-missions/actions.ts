"use server";

import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/types/supabase";
import { isLikeExpired } from "@/lib/utils/user-mission-likes";
import { excludeCreatorFromPraisedUserIds } from "@/lib/utils/user-mission-praised";
import { revalidatePath } from "next/cache";

export interface CreateUserMissionInput {
  title: string;
  content: string;
  praisedUserIds: string[];
  praisedExternalUserNames?: string[];
  imagePaths?: string[];
  mvvItems: {
    passionateExecution: boolean;
    supremeRelationships: boolean;
    happinessCirculation: boolean;
  };
}

export interface SaveDraftUserMissionInput {
  draftId?: string; // 既存の下書きID（更新時）
  title: string;
  content: string;
  praisedUserIds: string[];
  praisedExternalUserNames?: string[];
  imagePaths?: string[];
  mvvItems: {
    passionateExecution: boolean;
    supremeRelationships: boolean;
    happinessCirculation: boolean;
  };
}

export interface UpdateApprovedUserMissionInput {
  title: string;
  content: string;
}

export type SaveDraftUserMissionResult =
  | { success: true; missionId: string }
  | { success: false; error: string };

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

    // ページを再検証（Cloudflare Pages環境では無効化）
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

  if (!process.env.CF_PAGES) {
    try {
      revalidatePath("/user-missions");
      revalidatePath("/user-missions/my");
      revalidatePath("/");
      revalidatePath(`/user-missions/${missionId}`);
    } catch (revalidateError) {
      console.error("Revalidate エラー（継続）:", revalidateError);
    }
  }

  return { success: true };
}

export async function toggleLikeAction(missionId: string) {
  console.log(
    `[toggleLikeAction] 開始: missionId=${missionId}, CF_PAGES=${process.env.CF_PAGES}, NODE_ENV=${process.env.NODE_ENV}`,
  );

  let supabase: Awaited<ReturnType<typeof createClient>>;
  try {
    supabase = await createClient();

    // Cloudflare環境での詳細デバッグ
    if (process.env.CF_PAGES) {
      console.log("[CF_PAGES] Supabaseクライアント作成成功");
      // 簡単な接続テスト
      const testQuery = await supabase
        .from("user_missions")
        .select("id")
        .limit(1);
      if (testQuery.error) {
        console.error("[CF_PAGES] 接続テストエラー:", testQuery.error);
        throw new Error(`Supabase接続失敗: ${testQuery.error.message}`);
      }
      console.log("[CF_PAGES] 接続テスト成功");
    }
  } catch (clientError) {
    console.error(
      "[toggleLikeAction] Supabaseクライアント作成エラー:",
      clientError,
    );
    throw new Error(
      `データベース接続に失敗しました: ${clientError instanceof Error ? clientError.message : String(clientError)}`,
    );
  }

  try {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      console.error("[toggleLikeAction] 認証エラー:", authError);
      throw new Error(`認証エラー: ${authError.message}`);
    }

    if (!user) {
      console.error("[toggleLikeAction] ユーザーが見つかりません");
      throw new Error("ログインが必要です");
    }

    console.log(`[toggleLikeAction] ユーザー認証成功: userId=${user.id}`);

    // グッジョブの作成者を確認
    const { data: mission, error: missionError } = await supabase
      .from("user_missions")
      .select("created_by, published_at")
      .eq("id", missionId)
      .single();

    if (missionError) {
      console.error("[toggleLikeAction] グッジョブ取得エラー:", missionError);
      throw new Error(
        `グッジョブ情報の取得に失敗しました: ${missionError.message}`,
      );
    }

    // 自分のグッジョブにはいいねできない
    if (mission.created_by === user.id) {
      throw new Error("自分のグッジョブにはいいねできません");
    }

    if (isLikeExpired(mission.published_at)) {
      throw new Error("いいね可能期間（7日間）を過ぎています");
    }

    // 既存のいいねをチェック
    const { data: existingLike, error: checkError } = await supabase
      .from("user_mission_likes")
      .select()
      .eq("user_mission_id", missionId)
      .eq("user_id", user.id)
      .single();

    // single()はno rowsの場合エラーを返すため、PGRST116エラーは無視
    if (checkError && checkError.code !== "PGRST116") {
      console.error("[いいねチェックエラー]:", checkError);
      throw new Error(`いいね状態の確認に失敗: ${checkError.message}`);
    }

    if (existingLike) {
      console.log(`[いいね削除] likeId=${existingLike.id}`);
      // いいねを削除
      const { error } = await supabase
        .from("user_mission_likes")
        .delete()
        .eq("id", existingLike.id);

      if (error) {
        console.error("[いいね削除エラー]:", error);
        throw new Error(`いいね削除に失敗: ${error.message}`);
      }

      // いいね取り消し時のXP減算（オプション）
      await removeLikeGiverXP(missionId, user.id, supabase);

      // ページを再検証（Cloudflare Pages環境では無効化）
      if (!process.env.CF_PAGES) {
        try {
          revalidatePath("/user-missions");
          revalidatePath("/user-missions/my");
          revalidatePath("/");
        } catch (revalidateError) {
          console.error("Revalidate エラー（継続）:", revalidateError);
          // 再検証失敗してもいいね取り消し処理は継続
        }
      }

      console.log("[toggleLikeAction] 成功: liked=false");
      return { liked: false };
    }

    // いいねを追加
    console.log(`[いいね追加] missionId=${missionId}, userId=${user.id}`);
    const { error } = await supabase.from("user_mission_likes").insert({
      user_mission_id: missionId,
      user_id: user.id,
    });

    if (error) {
      console.error("[いいね追加エラー]:", error);
      throw new Error(`いいね追加に失敗: ${error.message}`);
    }

    // いいねしたユーザーにXPを付与
    await awardLikeGiverXP(missionId, user.id, supabase);

    // グッジョブ作成者にマイルストーンXPを付与
    await checkAndAwardMilestoneXP(missionId, user.id, supabase);

    // Slack通知を送信（Webhook URLが設定されている場合）
    if (process.env.SLACK_WEBHOOK_URL) {
      try {
        await sendSlackNotificationForLike(missionId, user.id, supabase);
      } catch (slackError) {
        console.error("Slack通知エラー（継続）:", slackError);
        // Slack通知失敗してもいいね処理は継続
      }
    }

    // ページを再検証（Cloudflare Pages環境では無効化）
    if (!process.env.CF_PAGES) {
      try {
        revalidatePath("/user-missions");
        revalidatePath("/user-missions/my");
        revalidatePath("/");
      } catch (revalidateError) {
        console.error("Revalidate エラー（継続）:", revalidateError);
        // 再検証失敗してもいいね処理は継続
      }
    }

    console.log("[toggleLikeAction] 成功: liked=true");
    return { liked: true };
  } catch (error) {
    console.error("[toggleLikeAction] 総合エラー:", error);

    // Cloudflare環境での詳細なエラーログ
    if (process.env.CF_PAGES) {
      console.error("[CF_PAGES] エラー詳細:", {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : "スタックトレースなし",
        name: error instanceof Error ? error.name : "不明なエラー",
        cause: error instanceof Error ? error.cause : undefined,
      });
    }

    // エラーメッセージを適切に伝搬（本番環境でも詳細情報を提供）
    if (error instanceof Error) {
      // 本番環境でもデバッグしやすいエラーメッセージを提供
      const errorMessage = process.env.CF_PAGES
        ? `[Cloudflare] ${error.message}`
        : error.message;
      throw new Error(errorMessage);
    }
    throw new Error("いいね処理中に予期しないエラーが発生しました");
  }
}

// いいねをしたユーザーにXPを付与
// 新しいポイント設計: いいねしたユーザーに1ポイント
async function awardLikeGiverXP(
  missionId: string,
  userId: string,
  supabase: Awaited<ReturnType<typeof createClient>>,
) {
  try {
    // 1いいねあたり1XPを付与
    await supabase.from("xp_transactions").insert({
      user_id: userId,
      xp_amount: 1,
      source_type: "USER_MISSION_LIKE_GIVEN",
      source_id: missionId,
      description: "ユーザーグッジョブにいいねしました",
    });

    console.log(`いいねユーザー ${userId} に1XPを付与しました`);
  } catch (error) {
    console.error("いいねユーザーXP付与エラー:", error);
    // エラーが発生してもいいね処理は続行
  }
}

// いいね取り消し時のXP減算
async function removeLikeGiverXP(
  missionId: string,
  userId: string,
  supabase: Awaited<ReturnType<typeof createClient>>,
) {
  try {
    // いいね取り消しで-1XPを付与（減算）
    await supabase.from("xp_transactions").insert({
      user_id: userId,
      xp_amount: -1,
      source_type: "USER_MISSION_LIKE_GIVEN",
      source_id: missionId,
      description: "ユーザーグッジョブのいいねを取り消しました",
    });

    console.log(`いいね取り消しユーザー ${userId} から1XPを減算しました`);
  } catch (error) {
    console.error("いいね取り消しXP減算エラー:", error);
    // エラーが発生してもいいね取り消し処理は続行
  }
}

// グッジョブ作成者にマイルストーンXPを付与
// 新しいポイント設計: いいね数 × 1ポイントを作成者に付与
async function checkAndAwardMilestoneXP(
  missionId: string,
  likerId: string,
  supabase: Awaited<ReturnType<typeof createClient>>,
) {
  // グッジョブの詳細といいね数を取得
  const { data: mission, error } = await supabase
    .from("user_missions")
    .select("*")
    .eq("id", missionId)
    .single();

  if (error || !mission) return;

  // いいねがつくたびに作成者に1ポイント付与
  // source_idにいいねしたユーザーIDを含めることで、同じユーザーからの重複いいねを防止
  await supabase.from("xp_transactions").insert({
    user_id: mission.created_by,
    xp_amount: 1,
    source_type: "USER_MISSION_LIKES",
    source_id: `${missionId}:${likerId}`,
    description: `ユーザーグッジョブ「${mission.title}」がいいねを獲得`,
  });
}

// グッジョブ作成時のポイント付与
async function awardPointsForMissionCreation(
  missionId: string,
  creatorId: string,
  praisedUserIds: string[],
  praisedExternalUserNames: string[],
  supabase: Awaited<ReturnType<typeof createClient>>,
) {
  try {
    // 作成者に5ポイント
    await supabase.from("xp_transactions").insert({
      user_id: creatorId,
      xp_amount: 5,
      source_type: "USER_MISSION_CREATION",
      source_id: missionId,
      description: "ユーザーグッジョブを作成しました",
    });

    // 賞賛対象者に各々5ポイント
    for (const userId of praisedUserIds) {
      if (userId === creatorId) continue;
      // 作成者には賞賛できない
      await supabase.from("xp_transactions").insert({
        user_id: userId,
        xp_amount: 5,
        source_type: "USER_MISSION_PRAISED",
        source_id: missionId,
        description: "ユーザーグッジョブで賞賛されました",
      });
    }

    // 外部ユーザーのポイントは保留テーブルに既に保存済み（createUserMissionAction内で処理）
    // ここでは何もしない
  } catch (error) {
    console.error("ポイント付与エラー:", error);
  }
}

// Slack通知（グッジョブ作成時）
async function sendSlackNotificationForMissionCreation(
  missionId: string,
  title: string,
  content: string,
  creatorId: string,
  praisedUserIds: string[],
  praisedExternalUserNames: string[],
  imagePaths: string[],
  supabase: Awaited<ReturnType<typeof createClient>>,
) {
  try {
    // 入力値をバリデーション・正規化
    const validatedPraisedUserIds = Array.isArray(praisedUserIds)
      ? praisedUserIds.filter(
          (id): id is string => typeof id === "string" && id.length > 0,
        )
      : [];
    const validatedPraisedExternalUserNames = Array.isArray(
      praisedExternalUserNames,
    )
      ? praisedExternalUserNames.filter(
          (name): name is string =>
            typeof name === "string" && name.trim().length > 0,
        )
      : [];
    const validatedImagePaths = Array.isArray(imagePaths)
      ? imagePaths.filter(
          (path): path is string => typeof path === "string" && path.length > 0,
        )
      : [];

    // 作成者情報を取得
    const { data: creator } = await supabase
      .from("private_users")
      .select("name")
      .eq("id", creatorId)
      .single();

    // 賞賛対象者情報を取得（Slack メンション用に slack_user_id を含む）
    const { data: praisedUsers } =
      validatedPraisedUserIds.length > 0
        ? await supabase
            .from("private_users")
            .select("id, name, slack_user_id")
            .in("id", validatedPraisedUserIds)
        : { data: null };

    type PraisedPrivateRow = {
      id: string;
      name: string;
      slack_user_id: string | null;
    };
    const praisedById = new Map<string, PraisedPrivateRow>(
      (praisedUsers ?? []).map((u) => [u.id, u]),
    );
    const orderedPraisedInternal: PraisedPrivateRow[] = [];
    for (const id of validatedPraisedUserIds) {
      const row = praisedById.get(id);
      if (row) {
        orderedPraisedInternal.push(row);
      }
    }

    const praisedNames =
      orderedPraisedInternal.map((u) => u.name).join(", ") || "";
    const externalNames = validatedPraisedExternalUserNames.join(", ") || "";
    const allPraisedNames = [praisedNames, externalNames]
      .filter((name) => name.length > 0)
      .join(", ");

    // Slack通知APIを呼び出し（サーバーサイド）
    const apiUrl =
      process.env.NEXT_PUBLIC_APP_ORIGIN || "http://localhost:3000";

    if (!apiUrl) {
      console.warn(
        "[Slack通知] NEXT_PUBLIC_APP_ORIGINが設定されていません。Slack通知をスキップします。",
      );
      return;
    }

    const notificationUrl = `${apiUrl}/api/slack-notification`;
    console.log("[Slack通知] 通知APIを呼び出します:", notificationUrl);

    // 画像URLを取得
    console.log("[Slack通知] imagePaths受信:", {
      imagePaths,
      imagePathsType: typeof imagePaths,
      imagePathsIsArray: Array.isArray(imagePaths),
      imagePathsLength: imagePaths?.length,
    });

    const imageUrls: string[] = [];
    if (validatedImagePaths.length > 0) {
      const { createServiceClient } = await import("@/lib/supabase/server");
      const serviceSupabase = await createServiceClient();
      for (const path of validatedImagePaths) {
        const { data } = serviceSupabase.storage
          .from("user_mission_images")
          .getPublicUrl(path);
        console.log("[Slack通知] getPublicUrl結果:", {
          path,
          publicUrl: data?.publicUrl,
        });
        if (data?.publicUrl) {
          imageUrls.push(data.publicUrl);
        }
      }
    }

    console.log("[Slack通知] 生成されたimageUrls:", {
      imageUrls,
      imageUrlsLength: imageUrls.length,
    });

    const response = await fetch(notificationUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "user_mission_created",
        data: {
          missionId,
          title,
          content,
          creatorName: creator?.name || "不明",
          praisedNames: allPraisedNames,
          praisedInternalUsers: orderedPraisedInternal.map((u) => ({
            name: u.name,
            slack_user_id: u.slack_user_id,
          })),
          externalPraisedNames: validatedPraisedExternalUserNames,
          imageUrls: imageUrls, // undefinedではなく空配列でも送信
        },
      }),
    });

    const responseText = await response
      .text()
      .catch(() => "レスポンスの取得に失敗");

    if (!response.ok) {
      let errorDetails:
        | { raw?: string; error?: string }
        | Record<string, unknown>;
      try {
        errorDetails = JSON.parse(responseText) as Record<string, unknown>;
      } catch {
        errorDetails = { raw: responseText };
      }

      const errorMessage =
        (typeof errorDetails === "object" &&
          errorDetails !== null &&
          ("error" in errorDetails
            ? String(errorDetails.error)
            : "raw" in errorDetails
              ? String(errorDetails.raw)
              : "不明なエラー")) ||
        "不明なエラー";

      console.error("[Slack通知] API呼び出し失敗:", {
        status: response.status,
        statusText: response.statusText,
        error: errorDetails,
        url: notificationUrl,
        missionId,
      });
      throw new Error(
        `Slack通知API呼び出し失敗: ${response.status} ${response.statusText}. ${errorMessage}`,
      );
    }

    type SlackNotificationResponse =
      | { success: true }
      | { success: false; error?: string; details?: string };

    let result: SlackNotificationResponse | Record<string, unknown>;
    try {
      result = JSON.parse(responseText) as SlackNotificationResponse;
    } catch {
      console.warn("[Slack通知] レスポンスのJSON解析に失敗:", responseText);
      result = { success: false, error: "レスポンスの解析に失敗" };
    }

    if (
      typeof result === "object" &&
      result !== null &&
      "success" in result &&
      !result.success
    ) {
      const errorMessage =
        ("error" in result && typeof result.error === "string"
          ? result.error
          : "details" in result && typeof result.details === "string"
            ? result.details
            : "不明なエラー") || "不明なエラー";

      console.error("[Slack通知] API呼び出し失敗:", {
        result,
        missionId,
        url: notificationUrl,
      });
      throw new Error(`Slack通知API呼び出し失敗: ${errorMessage}`);
    }

    console.log("[Slack通知] グッジョブ作成通知を送信しました:", {
      missionId,
      title,
      creatorName: creator?.name || "不明",
    });
  } catch (error) {
    console.error("[Slack通知] エラー詳細:", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      missionId,
      title,
    });
    // エラーを再スローしない（グッジョブ作成処理は継続）
  }
}

// Slack通知（いいね時）
async function sendSlackNotificationForLike(
  missionId: string,
  userId: string,
  supabase: Awaited<ReturnType<typeof createClient>>,
) {
  try {
    // グッジョブ情報を取得
    const { data: mission } = await supabase
      .from("user_missions")
      .select("title, created_by")
      .eq("id", missionId)
      .single();

    // いいねしたユーザー情報を取得
    const { data: liker } = await supabase
      .from("private_users")
      .select("name")
      .eq("id", userId)
      .single();

    // 作成者情報を取得
    const { data: creator } = mission?.created_by
      ? await supabase
          .from("private_users")
          .select("name")
          .eq("id", mission.created_by)
          .single()
      : { data: null };

    // Slack通知APIを呼び出し（サーバーサイド）
    const apiUrl =
      process.env.NEXT_PUBLIC_APP_ORIGIN || "http://localhost:3000";

    if (!apiUrl) {
      console.warn(
        "[Slack通知] NEXT_PUBLIC_APP_ORIGINが設定されていません。Slack通知をスキップします。",
      );
      return;
    }

    const response = await fetch(`${apiUrl}/api/slack-notification`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "user_mission_liked",
        data: {
          missionId,
          title: mission?.title || "",
          likerName: liker?.name || "不明",
          creatorName: creator?.name || "不明",
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response
        .text()
        .catch(() => "エラーレスポンスの取得に失敗");
      console.error(
        `[Slack通知] API呼び出し失敗: status=${response.status}, statusText=${response.statusText}, error=${errorText}`,
      );
      throw new Error(
        `Slack通知API呼び出し失敗: ${response.status} ${response.statusText}`,
      );
    }

    const result = await response.json().catch(() => null);
    if (result && !result.success) {
      console.error("[Slack通知] API呼び出し失敗:", result);
      throw new Error(
        `Slack通知API呼び出し失敗: ${result.error || "不明なエラー"}`,
      );
    }

    console.log("[Slack通知] いいね通知を送信しました:", missionId);
  } catch (error) {
    console.error("[Slack通知] エラー詳細:", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      missionId,
      userId,
    });
    // エラーを再スローしない（いいね処理は継続）
  }
}

// 下書き保存（自動保存用）
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

    // ページを再検証（Cloudflare Pages環境では無効化）
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
async function checkIsFirstGoodJobToday(
  userId: string,
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<boolean> {
  try {
    console.log("[checkIsFirstGoodJobToday] 開始:", { userId });
    // JST（UTC+9）で今日の開始時刻と終了時刻を計算
    const now = new Date();

    // JSTの今日の開始時刻（00:00:00）をUTCに変換
    // UTC 15:00（前日）= JST 00:00（当日）
    const jstTodayStartUTC = new Date(now);
    jstTodayStartUTC.setUTCHours(15, 0, 0, 0);
    if (jstTodayStartUTC > now) {
      // まだ日本時間の0時になっていない場合は前日にする
      jstTodayStartUTC.setUTCDate(jstTodayStartUTC.getUTCDate() - 1);
    }

    // JSTの今日の終了時刻（23:59:59.999）をUTCに変換
    const jstTodayEndUTC = new Date(jstTodayStartUTC);
    jstTodayEndUTC.setUTCDate(jstTodayEndUTC.getUTCDate() + 1);
    jstTodayEndUTC.setUTCHours(14, 59, 59, 999);

    console.log("[checkIsFirstGoodJobToday] 時間範囲:", {
      jstTodayStartUTC: jstTodayStartUTC.toISOString(),
      jstTodayEndUTC: jstTodayEndUTC.toISOString(),
      now: now.toISOString(),
    });

    // 今日公開されたグッジョブをカウント（承認済みのみ、published_at基準）
    const { count, error } = await supabase
      .from("user_missions")
      .select("id", { count: "exact", head: true })
      .eq("created_by", userId)
      .eq("status", "approved")
      .not("published_at", "is", null)
      .gte("published_at", jstTodayStartUTC.toISOString())
      .lte("published_at", jstTodayEndUTC.toISOString());

    if (error) {
      console.error("[checkIsFirstGoodJobToday] クエリエラー:", {
        error,
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
      // エラーが発生した場合は安全のためfalseを返す（共有グッジョブは表示しない）
      return false;
    }

    const todayCount = count ?? 0;
    const isFirst = todayCount === 0;
    console.log("[checkIsFirstGoodJobToday] 結果:", {
      todayCount,
      isFirst,
    });

    // 投稿作成前にチェックするため、カウントが0の場合にtrueを返す
    return isFirst;
  } catch (error) {
    console.error("[checkIsFirstGoodJobToday] 予期しないエラー:", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    // エラーが発生した場合は安全のためfalseを返す（共有グッジョブは表示しない）
    return false;
  }
}

/**
 * 今日まだ達成していない共有グッジョブを取得
 */
async function getAvailableSharedMissions(
  userId: string,
  supabase: Awaited<ReturnType<typeof createClient>>,
) {
  try {
    console.log("[getAvailableSharedMissions] 開始:", { userId });
    // JST（UTC+9）で今日の開始時刻と終了時刻を計算
    const now = new Date();

    // JSTの今日の開始時刻（00:00:00）をUTCに変換
    const jstTodayStartUTC = new Date(now);
    jstTodayStartUTC.setUTCHours(15, 0, 0, 0);
    if (jstTodayStartUTC > now) {
      jstTodayStartUTC.setUTCDate(jstTodayStartUTC.getUTCDate() - 1);
    }

    // JSTの今日の終了時刻（23:59:59.999）をUTCに変換
    const jstTodayEndUTC = new Date(jstTodayStartUTC);
    jstTodayEndUTC.setUTCDate(jstTodayEndUTC.getUTCDate() + 1);
    jstTodayEndUTC.setUTCHours(14, 59, 59, 999);

    console.log("[getAvailableSharedMissions] 時間範囲:", {
      jstTodayStartUTC: jstTodayStartUTC.toISOString(),
      jstTodayEndUTC: jstTodayEndUTC.toISOString(),
    });

    // 特定の共有グッジョブのみを取得
    const TARGET_MISSION_ID = "e1f1d556-df31-4f79-b96d-6a1badeb5a0b";
    console.log("[getAvailableSharedMissions] 共有グッジョブを取得:", {
      targetMissionId: TARGET_MISSION_ID,
    });

    const { data: importantMissions, error: missionsError } = await supabase
      .from("missions")
      .select(
        "id, title, icon_url, difficulty, content, important_display_start_date, important_display_end_date",
      )
      .eq("id", TARGET_MISSION_ID)
      .eq("is_important", true)
      .eq("is_hidden", false)
      .order("difficulty", { ascending: true })
      .order("created_at", { ascending: false });

    if (missionsError) {
      console.error("[getAvailableSharedMissions] 共有グッジョブ取得エラー:", {
        error: missionsError,
        code: missionsError.code,
        message: missionsError.message,
        details: missionsError.details,
        hint: missionsError.hint,
      });
      return [];
    }

    if (!importantMissions || importantMissions.length === 0) {
      console.log(
        "[getAvailableSharedMissions] 共有グッジョブが見つかりませんでした",
      );
      return [];
    }

    console.log("[getAvailableSharedMissions] 共有グッジョブ取得完了:", {
      count: importantMissions.length,
      missions: importantMissions.map((m) => ({
        id: m.id,
        title: m.title,
      })),
    });

    // 期間設定を考慮してフィルタリング
    const nowDate = new Date(now);
    const validMissions = importantMissions.filter((mission) => {
      const startDate = mission.important_display_start_date
        ? new Date(mission.important_display_start_date)
        : null;
      const endDate = mission.important_display_end_date
        ? new Date(mission.important_display_end_date)
        : null;

      // 開始日が設定されている場合、現在日時が開始日以降である必要がある
      if (startDate && nowDate < startDate) {
        return false;
      }

      // 終了日が設定されている場合、現在日時が終了日以前である必要がある
      if (endDate && nowDate > endDate) {
        return false;
      }

      return true;
    });

    if (validMissions.length === 0) {
      console.log(
        "[getAvailableSharedMissions] 期間内の共有グッジョブがありません",
      );
      return [];
    }

    console.log("[getAvailableSharedMissions] 期間内の共有グッジョブ:", {
      count: validMissions.length,
    });

    // 今日達成した共有グッジョブのIDを取得
    const { data: todayAchievements, error: achievementsError } = await supabase
      .from("achievements")
      .select("mission_id")
      .eq("user_id", userId)
      .in(
        "mission_id",
        validMissions.map((m) => m.id),
      )
      .gte("created_at", jstTodayStartUTC.toISOString())
      .lte("created_at", jstTodayEndUTC.toISOString());

    if (achievementsError) {
      console.error("[getAvailableSharedMissions] 今日の達成記録取得エラー:", {
        error: achievementsError,
        code: achievementsError.code,
        message: achievementsError.message,
      });
      // エラー時は安全のため空配列を返す（すべて返すと誤って表示される可能性がある）
      return [];
    }

    const achievedMissionIds = new Set(
      todayAchievements?.map((a) => a.mission_id).filter(Boolean) || [],
    );

    console.log("[getAvailableSharedMissions] 今日達成した共有グッジョブ:", {
      count: achievedMissionIds.size,
      missionIds: Array.from(achievedMissionIds),
    });

    // 今日まだ達成していない共有グッジョブのみを返す
    const availableMissions = validMissions.filter(
      (mission) => !achievedMissionIds.has(mission.id),
    );

    console.log("[getAvailableSharedMissions] 利用可能な共有グッジョブ:", {
      count: availableMissions.length,
      missions: availableMissions.map((m) => ({
        id: m.id,
        title: m.title,
      })),
    });

    // 必要なフィールドのみを抽出して返す（型不一致とシリアライズエラーを防ぐため）
    // undefinedをnullに変換し、すべての値をプリミティブ型に変換
    return availableMissions.map((mission) => ({
      id: String(mission.id),
      title: String(mission.title),
      icon_url: mission.icon_url ?? null,
      difficulty: Number(mission.difficulty),
      content: mission.content ?? null,
    }));
  } catch (error) {
    console.error("[getAvailableSharedMissions] 予期しないエラー:", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    // エラーが発生した場合は安全のため空配列を返す
    return [];
  }
}

/**
 * 成果物なしで共有グッジョブを完了する
 */
export async function completeSharedMissionAction(missionId: string) {
  const supabase = await createClient();

  try {
    // 認証チェック
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return {
        success: false,
        error: "認証に失敗しました。再ログインしてください。",
      };
    }

    // グッジョブ情報を取得して、is_importantを確認
    const { data: missionData, error: missionFetchError } = await supabase
      .from("missions")
      .select("is_important, max_achievement_count")
      .eq("id", missionId)
      .single();

    if (missionFetchError || !missionData) {
      return {
        success: false,
        error: "グッジョブ情報の取得に失敗しました。",
      };
    }

    if (!missionData.is_important) {
      return {
        success: false,
        error: "このグッジョブは共有グッジョブではありません。",
      };
    }

    // 1日1回制限チェック（JSTで判定）
    const now = new Date();
    const jstTodayStartUTC = new Date(now);
    jstTodayStartUTC.setUTCHours(15, 0, 0, 0);
    if (jstTodayStartUTC > now) {
      jstTodayStartUTC.setUTCDate(jstTodayStartUTC.getUTCDate() - 1);
    }

    const jstTodayEndUTC = new Date(jstTodayStartUTC);
    jstTodayEndUTC.setUTCDate(jstTodayEndUTC.getUTCDate() + 1);
    jstTodayEndUTC.setUTCHours(14, 59, 59, 999);

    // 今日既に達成しているかチェック
    const { data: todayAchievements, error: todayAchievementError } =
      await supabase
        .from("achievements")
        .select("id")
        .eq("user_id", user.id)
        .eq("mission_id", missionId)
        .gte("created_at", jstTodayStartUTC.toISOString())
        .lte("created_at", jstTodayEndUTC.toISOString());

    if (todayAchievementError) {
      return {
        success: false,
        error: "今日の達成記録の確認に失敗しました。",
      };
    }

    if (todayAchievements && todayAchievements.length > 0) {
      return {
        success: false,
        error: "共有グッジョブは1日1回までしか達成できません。",
      };
    }

    // 成果物なしでグッジョブ達成を記録
    const { data: achievement, error: achievementError } = await supabase
      .from("achievements")
      .insert({
        user_id: user.id,
        mission_id: missionId,
      })
      .select()
      .single();

    if (achievementError || !achievement) {
      console.error("グッジョブ達成記録エラー:", achievementError);
      return {
        success: false,
        error: `グッジョブ達成の記録に失敗しました: ${achievementError?.message}`,
      };
    }

    // XPを付与
    const { grantMissionCompletionXp } = await import(
      "@/lib/services/userLevel"
    );
    const xpResult = await grantMissionCompletionXp(
      user.id,
      missionId,
      achievement.id,
    );

    if (!xpResult.success) {
      console.error("XP付与に失敗しました:", {
        error: xpResult.error,
        userId: user.id,
        missionId,
        achievementId: achievement.id,
      });
      // XP付与の失敗はグッジョブ達成の成功を妨げない
      // バックフィル処理で後から補完可能
    }

    return {
      success: true,
      message: "共有グッジョブを完了しました！",
      xpGranted: xpResult.xpGranted ?? 0,
      userLevel: xpResult.userLevel,
    };
  } catch (error) {
    console.error("completeSharedMissionActionエラー:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "予期しないエラーが発生しました",
    };
  }
}

// 下書き削除
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

    // ページを再検証（Cloudflare Pages環境では無効化）
    if (!process.env.CF_PAGES) {
      try {
        revalidatePath("/user-missions");
        revalidatePath("/user-missions/my");
        revalidatePath("/");
      } catch (revalidateError) {
        console.error("Revalidate エラー（継続）:", revalidateError);
        // 再検証失敗しても削除処理は継続
      }
    }

    return { success: true };
  } catch (error) {
    console.error("deleteDraftUserMissionAction総合エラー:", error);
    throw error;
  }
}
