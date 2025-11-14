import { type NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, type, data } = body;

    const webhookUrl = process.env.SLACK_WEBHOOK_URL;
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
      const { title, content, creatorName, praisedNames } = data;
      slackMessage = {
        text: ":tada: 新しいグッジョブが作成されました！",
        blocks: [
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
                text: `*賞賛対象:*\n${praisedNames}`,
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
        ],
      };
    } else if (type === "user_mission_liked") {
      const { title, likerName, creatorName } = data;
      slackMessage = {
        text: ":heart: グッジョブにいいねがつきました！",
        blocks: [
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
        ],
      };
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
