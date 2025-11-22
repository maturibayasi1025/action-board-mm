"use server";

import { createClient } from "@/lib/supabase/server";
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

    // グッジョブ作成（即時承認）
    const { data: mission, error: missionError } = await supabase
      .from("user_missions")
      .insert({
        created_by: user.id,
        title: input.title,
        content: input.content,
        image_paths:
          input.imagePaths && input.imagePaths.length > 0
            ? (input.imagePaths as unknown)
            : [],
        status: "approved", // 自動承認で即時表示
        approved_at: new Date().toISOString(),
        approved_by: user.id, // 自分自身を承認者として設定
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
    if (input.praisedUserIds.length > 0) {
      const praisedUsers = input.praisedUserIds.map((userId) => ({
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
      input.praisedUserIds,
      input.praisedExternalUserNames || [],
      supabase,
    );

    // Slack通知を送信（Webhook URLが設定されている場合）
    if (process.env.SLACK_WEBHOOK_URL) {
      try {
        await sendSlackNotificationForMissionCreation(
          mission.id,
          input.title,
          input.content,
          user.id,
          input.praisedUserIds,
          input.praisedExternalUserNames || [],
          input.imagePaths || [],
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
        console.error("Revalidate エラー（継続）:", revalidateError);
        // 再検証失敗してもグッジョブ作成処理は継続
      }
    }

    return { success: true, missionId: mission.id };
  } catch (error) {
    console.error("createUserMissionAction総合エラー:", error);
    throw error;
  }
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
      .select("created_by")
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
    await checkAndAwardMilestoneXP(missionId, supabase);

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
  await supabase.from("xp_transactions").insert({
    user_id: mission.created_by,
    xp_amount: 1,
    source_type: "USER_MISSION_LIKES",
    source_id: missionId,
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
    // 作成者情報を取得
    const { data: creator } = await supabase
      .from("private_users")
      .select("name")
      .eq("id", creatorId)
      .single();

    // 賞賛対象者情報を取得
    const { data: praisedUsers } = await supabase
      .from("private_users")
      .select("name")
      .in("id", praisedUserIds);

    const praisedNames = praisedUsers?.map((u) => u.name).join(", ") || "";
    const externalNames = praisedExternalUserNames?.join(", ") || "";
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
    const imageUrls: string[] = [];
    if (imagePaths && imagePaths.length > 0) {
      const { createServiceClient } = await import("@/lib/supabase/server");
      const serviceSupabase = await createServiceClient();
      for (const path of imagePaths) {
        const { data } = serviceSupabase.storage
          .from("user_mission_images")
          .getPublicUrl(path);
        if (data?.publicUrl) {
          imageUrls.push(data.publicUrl);
        }
      }
    }

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
          imageUrls: imageUrls.length > 0 ? imageUrls : undefined,
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
        return await createNewDraft(input, user.id, supabase);
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
              ? (input.imagePaths as unknown)
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

      if (input.praisedUserIds.length > 0) {
        const praisedUsers = input.praisedUserIds.map((userId) => ({
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
    return await createNewDraft(input, user.id, supabase);
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
          ? (input.imagePaths as unknown)
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

    const praisedUserIds =
      draft.user_mission_praised_users?.map(
        (p: { praised_user_id: string }) => p.praised_user_id,
      ) || [];

    const praisedExternalUserNames =
      draft.user_mission_praised_external_users?.map(
        (p: { praised_person_name: string }) => p.praised_person_name,
      ) || [];

    if (praisedUserIds.length === 0 && praisedExternalUserNames.length === 0) {
      throw new Error("賞賛に値するメンバーを少なくとも1人選択してください");
    }

    const mvvItems = draft.user_mission_mvv_items || [];
    if (mvvItems.length === 0) {
      throw new Error("MVV項目を少なくとも1つ選択してください");
    }

    // 下書きを公開（statusをapprovedに更新）
    const { data: mission, error: updateError } = await supabase
      .from("user_missions")
      .update({
        status: "approved",
        approved_at: new Date().toISOString(),
        approved_by: user.id,
        updated_at: new Date().toISOString(),
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
        const imagePaths = ((draft as unknown as { image_paths?: string[] })
          .image_paths || []) as string[];
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

    return { success: true, missionId: mission.id };
  } catch (error) {
    console.error("publishDraftUserMissionAction総合エラー:", error);
    throw error;
  }
}
