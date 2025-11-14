import { type NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

/**
 * Slackユーザー情報の型定義
 */
type SlackUser = {
  id: string;
  name: string;
  real_name?: string;
  display_name?: string;
  is_bot?: boolean;
  deleted?: boolean;
  profile?: {
    display_name?: string;
    real_name?: string;
  };
};

/**
 * Slack APIのusers.listを使用して全ユーザーを取得
 */
async function getSlackUsersList(): Promise<SlackUser[]> {
  const botToken = process.env.SLACK_BOT_TOKEN;
  if (!botToken) {
    console.warn(
      "[Slack通知] SLACK_BOT_TOKENが設定されていません。ユーザー情報を取得できません。",
    );
    return [];
  }

  try {
    const response = await fetch("https://slack.com/api/users.list", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${botToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      console.error(`[Slack通知] Slack API エラー: ${response.status}`);
      return [];
    }

    const data = await response.json();
    if (!data.ok) {
      console.error(`[Slack通知] Slack API エラー: ${data.error}`);
      return [];
    }

    return data.members || [];
  } catch (error) {
    console.error("[Slack通知] Slack API呼び出しエラー:", error);
    return [];
  }
}

/**
 * ユーザー名からSlackユーザーIDを取得（名前でマッチング）
 */
function findSlackUserIdByName(
  userName: string,
  slackUsers: SlackUser[],
): string | null {
  if (!userName || slackUsers.length === 0) {
    return null;
  }

  // 大文字小文字を区別しない比較（前後の空白と中間のスペースも除去）
  const normalizedUserName = userName.trim().replace(/\s+/g, "").toLowerCase();
  if (!normalizedUserName) {
    return null;
  }

  for (const user of slackUsers) {
    // ボットユーザーと解除済みアカウントは除外
    if (user.id.startsWith("B") || user.is_bot || user.deleted === true) {
      continue;
    }

    // 表示名、実名、ユーザー名でマッチング（部分一致、スペースも除去）
    const displayName = (
      user.profile?.display_name ||
      user.display_name ||
      user.real_name ||
      user.name ||
      ""
    )
      .trim()
      .replace(/\s+/g, "")
      .toLowerCase();

    const realName = (user.real_name || user.name || "")
      .trim()
      .replace(/\s+/g, "")
      .toLowerCase();

    const userNameLower = (user.name || "")
      .trim()
      .replace(/\s+/g, "")
      .toLowerCase();

    // 部分一致マッチング（検索対象の名前がSlackのユーザー名に含まれているかチェック）
    if (
      displayName?.includes(normalizedUserName) ||
      realName?.includes(normalizedUserName) ||
      userNameLower?.includes(normalizedUserName)
    ) {
      return user.id;
    }
  }

  return null;
}

/**
 * 賞賛対象者の名前リストをメンション形式に変換
 * 例: "田中太郎, 佐藤花子" -> "<@U123456>, <@U789012>"
 */
function formatPraisedNamesWithMentions(
  praisedNames: string,
  slackUsers: SlackUser[],
): string {
  if (!praisedNames || praisedNames.trim() === "") {
    return "";
  }

  // カンマで分割して各ユーザー名を処理（前後の空白を確実に除去）
  const names = praisedNames
    .split(",")
    .map((name) => name.trim())
    .filter((name) => name.length > 0); // 空文字列を除外
  const formattedNames: string[] = [];

  for (const name of names) {
    if (!name || name.trim() === "") continue;

    const slackUserId = findSlackUserIdByName(name.trim(), slackUsers);
    if (slackUserId) {
      // メンション形式のみ（名前は表示しない）
      formattedNames.push(`<@${slackUserId}>`);
    } else {
      // SlackユーザーIDが見つからない場合は名前のみ
      formattedNames.push(name.trim());
    }
  }

  return formattedNames.join(", ");
}

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

      // Slackユーザーリストを取得してメンション形式に変換
      const slackUsers = await getSlackUsersList();
      const praisedNamesWithMentions = formatPraisedNamesWithMentions(
        praisedNames || "",
        slackUsers,
      );

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
