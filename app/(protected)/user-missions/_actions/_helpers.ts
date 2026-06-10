"use server";

import type { createClient } from "@/lib/supabase/server";

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
