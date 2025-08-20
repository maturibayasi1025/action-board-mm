import { type NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, type, data } = body;

    const webhookUrl = process.env.SLACK_WEBHOOK_URL;
    if (!webhookUrl) {
      console.warn("Slack Webhook URLが設定されていません");
      return NextResponse.json(
        { success: true, message: "Slack通知はスキップされました" },
        { status: 200 },
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

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(slackMessage),
    });

    if (!response.ok) {
      throw new Error(`Slack API responded with ${response.status}`);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Slack notification error:", error);
    return NextResponse.json(
      { error: "Failed to send Slack notification" },
      { status: 500 },
    );
  }
}
