import { type NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

export async function POST(request: NextRequest) {
  try {
    const logEntry = await request.json();

    // 本番環境では外部ログサービスに送信
    if (process.env.NODE_ENV === "production") {
      // CloudWatch、Datadog、またはその他のログサービスに送信
      // 例: await sendToCloudWatch(logEntry);
      // 例: await sendToDatadog(logEntry);

      // 現在は一時的にサーバーログに出力
      console.error(
        "[Production Error Log]",
        JSON.stringify(logEntry, null, 2),
      );

      // Slackへの通知（重要なエラーの場合）
      if (logEntry.level === "error" && process.env.SLACK_WEBHOOK_URL) {
        await notifySlack(logEntry);
      }
    } else {
      // 開発環境ではコンソールに出力
      console.log("[Development Error Log]", logEntry);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Log API Error]", error);
    return NextResponse.json(
      { error: "Failed to process log entry" },
      { status: 500 },
    );
  }
}

// Slack通知関数
async function notifySlack(logEntry: {
  message: string;
  timestamp: string;
  digest?: string;
  level: string;
}) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) return;

  try {
    const message = {
      text: "🚨 本番環境エラー",
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*エラーが発生しました*\n*メッセージ:* ${logEntry.message}\n*時刻:* ${logEntry.timestamp}\n*Digest:* ${logEntry.digest || "N/A"}`,
          },
        },
      ],
    };

    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(message),
    });
  } catch (error) {
    console.error("[Slack Notification Error]", error);
  }
}

// ヘルスチェック用のGETエンドポイント
export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "error-logging",
    timestamp: new Date().toISOString(),
  });
}
