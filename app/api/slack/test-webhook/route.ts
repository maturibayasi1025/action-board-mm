import { type NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

type SlackPayload =
  | { type: "url_verification"; challenge: string }
  | { type: string; [key: string]: unknown };

/**
 * Slack Event Subscriptions テスト用エンドポイント
 * 署名検証をスキップして、チャレンジレスポンスのテストを行う
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    console.log("[Test Webhook] リクエスト受信:", body);

    let payload: SlackPayload;
    try {
      payload = JSON.parse(body) as SlackPayload;
    } catch (parseError) {
      console.error("JSON解析エラー:", parseError);
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    console.log("[Test Webhook] Payload type:", payload.type);

    // URL Verification
    if (payload.type === "url_verification") {
      console.log("[Test Webhook] Challenge received:", payload.challenge);
      return NextResponse.json({ challenge: payload.challenge });
    }

    // その他のイベント
    console.log("[Test Webhook] Event received:", payload);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[Test Webhook] エラー:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
