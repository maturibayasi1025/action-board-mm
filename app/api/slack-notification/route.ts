import { buildOfficeClosingSlackMessage } from "@/lib/office-check/slack-message";
import {
  buildPraisedMentionsLine,
  formatPraisedNamesWithMentions,
  getSlackUsersList,
} from "@/lib/slack/slack-users";
import { resolveSlackWebhookUrlForType } from "@/lib/slack/survey-webhook-urls";
import { type NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, type, data } = body;

    const webhookUrl = resolveSlackWebhookUrlForType(type);
    if (!webhookUrl) {
      console.warn("[Slack通知] Slack Webhook URLが設定されていません");
      return NextResponse.json(
        {
          success: false,
          error: "SLACK_WEBHOOK_URL環境変数が設定されていません",
          message: "Slack通知はスキップされました",
        },
        { status: 200 },
      );
    }

    // Webhook URLの検証（基本的な形式チェック）
    if (!webhookUrl.startsWith("https://hooks.slack.com/")) {
      console.error(
        "[Slack通知] 無効なWebhook URL形式:",
        `${webhookUrl.substring(0, 50)}...`,
      );
      return NextResponse.json(
        {
          success: false,
          error: "無効なWebhook URL形式です",
        },
        { status: 400 },
      );
    }

    let slackMessage = message;

    // ユーザーグッジョブ用のメッセージ構築
    if (type === "user_mission_created") {
      const {
        title,
        content,
        creatorName,
        praisedNames,
        praisedInternalUsers,
        externalPraisedNames,
        imageUrls,
        missionId,
      } = data as {
        title?: string;
        content?: string;
        creatorName?: string;
        praisedNames?: string;
        praisedInternalUsers?: Array<{
          name: string;
          slack_user_id: string | null;
        }>;
        externalPraisedNames?: string[];
        imageUrls?: string[];
        missionId?: string;
      };

      console.log("[Slack通知] 受信したデータ:", {
        type,
        title,
        creatorName,
        praisedNames,
        praisedInternalUsers,
        externalPraisedNames,
        imageUrls,
        missionId,
        imageUrlsType: typeof imageUrls,
        imageUrlsIsArray: Array.isArray(imageUrls),
        imageUrlsLength: imageUrls?.length,
      });

      // Slackユーザーリストを取得してメンション形式に変換
      const slackUsers = await getSlackUsersList();

      const internalList = Array.isArray(praisedInternalUsers)
        ? praisedInternalUsers
        : [];
      const externalList = Array.isArray(externalPraisedNames)
        ? externalPraisedNames
        : [];

      const praisedNamesWithMentions =
        internalList.length > 0 || externalList.length > 0
          ? buildPraisedMentionsLine(internalList, externalList, slackUsers)
          : formatPraisedNamesWithMentions(praisedNames || "", slackUsers);

      // 詳細画面のURLを生成
      const apiUrl =
        process.env.NEXT_PUBLIC_APP_ORIGIN || "http://localhost:3000";
      const detailUrl = missionId
        ? `${apiUrl}/user-missions/${missionId}`
        : null;

      const blocks: unknown[] = [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: ":tada: *新しいグッジョブが作成されました！*",
          },
        },
        {
          type: "section",
          fields: [
            {
              type: "mrkdwn",
              text: `*タイトル:*\n${title}`,
            },
            {
              type: "mrkdwn",
              text: `*作成者:*\n${creatorName}`,
            },
            {
              type: "mrkdwn",
              text: `*賞賛対象:*\n${praisedNamesWithMentions || praisedNames || "なし"}`,
            },
          ],
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*内容:*\n${content}`,
          },
        },
      ];

      // 画像がある場合は画像ブロックを追加
      console.log("[Slack通知] 画像URLチェック:", {
        imageUrls,
        hasImageUrls: !!imageUrls,
        isArray: Array.isArray(imageUrls),
        length: imageUrls?.length,
        condition:
          imageUrls && Array.isArray(imageUrls) && imageUrls.length > 0,
      });

      if (imageUrls && Array.isArray(imageUrls) && imageUrls.length > 0) {
        console.log("[Slack通知] 画像ブロックを追加します:", {
          imageUrlsCount: imageUrls.length,
          imageUrlsToAdd: imageUrls.slice(0, 3),
        });
        // 最大3枚まで表示
        for (const imageUrl of imageUrls.slice(0, 3)) {
          blocks.push({
            type: "image",
            image_url: imageUrl,
            alt_text: title,
          });
        }
      } else {
        console.log("[Slack通知] 画像ブロックは追加されませんでした");
      }

      // 詳細画面へのボタンを追加
      if (detailUrl) {
        blocks.push({
          type: "actions",
          elements: [
            {
              type: "button",
              text: {
                type: "plain_text",
                text: "詳細を見る",
                emoji: true,
              },
              url: detailUrl,
              action_id: "view_detail",
            },
          ],
        });
      }

      slackMessage = {
        text: ":tada: 新しいグッジョブが作成されました！",
        blocks,
      };
    } else if (type === "user_mission_liked") {
      const { title, likerName, creatorName, missionId } = data;

      // 詳細画面のURLを生成
      const apiUrl =
        process.env.NEXT_PUBLIC_APP_ORIGIN || "http://localhost:3000";
      const detailUrl = missionId
        ? `${apiUrl}/user-missions/${missionId}`
        : null;

      const blocks: unknown[] = [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: ":heart: *グッジョブにいいねがつきました！*",
          },
        },
        {
          type: "section",
          fields: [
            {
              type: "mrkdwn",
              text: `*タイトル:*\n${title}`,
            },
            {
              type: "mrkdwn",
              text: `*いいねした人:*\n${likerName}`,
            },
            {
              type: "mrkdwn",
              text: `*作成者:*\n${creatorName}`,
            },
          ],
        },
      ];

      // 詳細画面へのボタンを追加
      if (detailUrl) {
        blocks.push({
          type: "actions",
          elements: [
            {
              type: "button",
              text: {
                type: "plain_text",
                text: "詳細を見る",
                emoji: true,
              },
              url: detailUrl,
              action_id: "view_detail",
            },
          ],
        });
      }

      slackMessage = {
        text: ":heart: グッジョブにいいねがつきました！",
        blocks,
      };
    } else if (type === "office_closing_check") {
      const {
        kind,
        reporterName,
        atLabel,
        leftAtLabel,
        remainingNames,
        floors,
        note,
      } = data as {
        kind?: "checkin" | "midday" | "final";
        reporterName?: string;
        atLabel?: string;
        leftAtLabel?: string;
        remainingNames?: string[];
        floors?: Array<{ name: string; checked: boolean }>;
        note?: string | null;
      };

      const resolvedKind =
        kind === "checkin" || kind === "midday" || kind === "final"
          ? kind
          : "final";
      slackMessage = buildOfficeClosingSlackMessage({
        kind: resolvedKind,
        reporterName: reporterName || "不明",
        atLabel: atLabel || leftAtLabel || "未入力",
        remainingNames: Array.isArray(remainingNames) ? remainingNames : [],
        floors: Array.isArray(floors) ? floors : [],
        note,
      });
    }

    console.log(
      "[Slack通知] Webhook URLに送信します:",
      `${webhookUrl.substring(0, 50)}...`,
    );
    console.log("[Slack通知] メッセージタイプ:", type);

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(slackMessage),
    });

    const responseText = await response
      .text()
      .catch(() => "レスポンスの取得に失敗");

    if (!response.ok) {
      console.error("[Slack通知] Slack APIエラー:", {
        status: response.status,
        statusText: response.statusText,
        response: responseText,
        webhookUrl: `${webhookUrl.substring(0, 50)}...`,
      });
      throw new Error(
        `Slack API responded with ${response.status}: ${response.statusText}. Response: ${responseText}`,
      );
    }

    console.log("[Slack通知] 通知を正常に送信しました");
    return NextResponse.json({ success: true });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    console.error("[Slack通知] エラー詳細:", {
      error: errorMessage,
      stack: errorStack,
      type: typeof error,
    });

    return NextResponse.json(
      {
        success: false,
        error: "Failed to send Slack notification",
        details: errorMessage,
      },
      { status: 500 },
    );
  }
}
