import {
  USER_SUSPENDED_ERROR,
  filterActiveUserIds,
  isSuspendedUser,
} from "@/lib/services/user-status";
import {
  ensureSlackUserIdStored,
  findPrivateUserIdForSlackMention,
} from "@/lib/slack/match-private-user-for-slack";
import { createServiceClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/types/supabase";
import { type NextRequest, NextResponse } from "next/server";

// Edge RuntimeではcryptoはWeb Crypto APIを使用
export const runtime = "edge";

// 処理済みメッセージを記録（メモリ上、本番環境ではRedis等の使用を推奨）
const processedMessages = new Set<string>();

/**
 * Slack署名検証（Edge Runtime対応）
 */
async function verifySlackSignature(
  body: string,
  signature: string,
  timestamp: string,
): Promise<boolean> {
  try {
    const signingSecret = process.env.SLACK_SIGNING_SECRET;
    if (!signingSecret) {
      console.error("SLACK_SIGNING_SECRETが設定されていません");
      return false;
    }

    // リプレイ攻撃防止: 5分以上のタイムスタンプは拒否
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const timestampNum = Number.parseInt(timestamp, 10);
    if (Number.isNaN(timestampNum)) {
      console.error("無効なタイムスタンプ形式:", timestamp);
      return false;
    }

    if (Math.abs(currentTimestamp - timestampNum) > 300) {
      console.error("タイムスタンプのずれが大きすぎます");
      return false;
    }

    // Web Crypto APIを使用して署名を計算
    const sigBaseString = `v0:${timestamp}:${body}`;
    const encoder = new TextEncoder();
    const keyData = encoder.encode(signingSecret);
    const messageData = encoder.encode(sigBaseString);

    const key = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );

    const signatureBuffer = await crypto.subtle.sign("HMAC", key, messageData);
    const signatureArray = Array.from(new Uint8Array(signatureBuffer));
    const mySignature = `v0=${signatureArray
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")}`;

    // タイミング攻撃対策のため、文字列比較を使用（Edge RuntimeではBufferが使えない）
    // 固定長なので、タイミング攻撃のリスクは低い
    if (mySignature.length !== signature.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < mySignature.length; i++) {
      result |= mySignature.charCodeAt(i) ^ signature.charCodeAt(i);
    }

    return result === 0;
  } catch (error) {
    console.error("署名検証処理中にエラーが発生しました:", error);
    return false;
  }
}

/**
 * SlackメンションからユーザーIDを抽出
 * 形式: <@U123456> または <@U123456|username>
 */
function extractMentions(text: string): string[] {
  const mentionRegex = /<@(U[A-Z0-9]+)(?:\|([^>]+))?>/g;
  const mentions: string[] = [];
  let match: RegExpExecArray | null = mentionRegex.exec(text);

  while (match !== null) {
    // ユーザーIDを追加（後でユーザー情報を取得して名前を取得）
    mentions.push(match[1]);
    match = mentionRegex.exec(text);
  }

  return mentions;
}

/**
 * Slack Web APIを使用してユーザー情報を取得
 */
async function getSlackUserInfo(slackUserId: string): Promise<{
  name: string;
  display_name?: string;
} | null> {
  const botToken = process.env.SLACK_BOT_TOKEN;
  if (!botToken) {
    console.warn(
      "SLACK_BOT_TOKENが設定されていません。ユーザー情報を取得できません。",
    );
    return null;
  }

  try {
    const response = await fetch(
      `https://slack.com/api/users.info?user=${slackUserId}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${botToken}`,
          "Content-Type": "application/json",
        },
      },
    );

    if (!response.ok) {
      console.error(`Slack API エラー: ${response.status}`);
      return null;
    }

    const data = await response.json();
    if (!data.ok) {
      console.error(`Slack API エラー: ${data.error}`);
      return null;
    }

    const user = data.user;
    return {
      name: user.real_name || user.name || "不明なユーザー",
      display_name: user.profile?.display_name || user.real_name,
    };
  } catch (error) {
    console.error("Slack API呼び出しエラー:", error);
    return null;
  }
}

/**
 * メッセージからタイトルと内容を抽出
 * 最初の行をタイトル、残りを内容とする
 */
function parseMessage(text: string): { title: string; content: string } {
  const lines = text.split("\n");
  const title = lines[0]?.trim() || "Slack投稿";
  const content = lines.slice(1).join("\n").trim() || title;

  return { title, content };
}

/**
 * メッセージが「グッジョブ」キーワードを含むかチェック
 */
function isGoodJobMessage(text: string): boolean {
  return /グッジョブ|グッ・ジョブ|good\s*job/i.test(text);
}

/**
 * Slackファイルを取得してSupabase Storageに保存
 */
async function downloadAndSaveSlackImage(
  fileId: string,
  userId: string,
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
): Promise<string | null> {
  const botToken = process.env.SLACK_BOT_TOKEN;
  if (!botToken) {
    console.warn("SLACK_BOT_TOKENが設定されていません");
    return null;
  }

  try {
    // ファイル情報を取得
    const fileInfoResponse = await fetch(
      `https://slack.com/api/files.info?file=${fileId}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${botToken}`,
          "Content-Type": "application/json",
        },
      },
    );

    if (!fileInfoResponse.ok) {
      console.error("Slackファイル情報取得エラー:", fileInfoResponse.status);
      return null;
    }

    const fileInfoData = await fileInfoResponse.json();
    if (!fileInfoData.ok || !fileInfoData.file) {
      console.error("Slackファイル情報取得エラー:", fileInfoData.error);
      return null;
    }

    const file = fileInfoData.file;
    // 画像ファイルのみ処理
    if (!file.mimetype?.startsWith("image/")) {
      console.log("画像ファイルではないためスキップ:", file.mimetype);
      return null;
    }

    // ファイルをダウンロード
    const downloadUrl = file.url_private;
    if (!downloadUrl) {
      console.error("ファイルのダウンロードURLがありません");
      return null;
    }

    const imageResponse = await fetch(downloadUrl, {
      headers: {
        Authorization: `Bearer ${botToken}`,
      },
    });

    if (!imageResponse.ok) {
      console.error("画像ダウンロードエラー:", imageResponse.status);
      return null;
    }

    const imageBlob = await imageResponse.blob();

    // ファイル名を生成
    const fileExtension = file.name?.split(".").pop() || "jpg";
    const fileName = `${userId}/${Date.now()}_slack_${fileId}.${fileExtension}`;

    // Supabase Storageにアップロード（Edge RuntimeではBlobを使用）
    const { data, error } = await supabase.storage
      .from("user_mission_images")
      .upload(fileName, imageBlob, {
        contentType: file.mimetype,
      });

    if (error) {
      console.error("画像アップロードエラー:", error);
      return null;
    }

    return data.path;
  } catch (error) {
    console.error("Slack画像処理エラー:", error);
    return null;
  }
}

/**
 * グッジョブを作成
 */
async function createGoodJobFromSlack(
  slackUserId: string,
  slackUserName: string,
  messageText: string,
  mentionedUserIds: string[],
  fileIds: string[],
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
): Promise<{ success: boolean; missionId?: string; error?: string }> {
  try {
    // 投稿者を特定（Slack User ID 保存済み・あいまい一致・部分一致）
    const creatorId = await findPrivateUserIdForSlackMention(
      slackUserId,
      slackUserName,
      supabase,
    );
    if (!creatorId) {
      return {
        success: false,
        error: `投稿者のユーザーが見つかりませんでした: ${slackUserName}`,
      };
    }

    if (await isSuspendedUser(creatorId)) {
      return {
        success: false,
        error: USER_SUSPENDED_ERROR,
      };
    }

    await ensureSlackUserIdStored(supabase, creatorId, slackUserId);

    // メンション先のユーザーを特定
    const praisedUserIds: string[] = [];
    const praisedExternalUserNames: string[] = [];
    for (const mentionedId of mentionedUserIds) {
      // Slack APIでユーザー情報を取得
      const userInfo = await getSlackUserInfo(mentionedId);
      if (userInfo) {
        // 表示名または実名を使用
        const mentionedUserName = userInfo.display_name || userInfo.name;
        const mentionedUserId = await findPrivateUserIdForSlackMention(
          mentionedId,
          mentionedUserName,
          supabase,
        );
        if (mentionedUserId && mentionedUserId !== creatorId) {
          praisedUserIds.push(mentionedUserId);
          await ensureSlackUserIdStored(supabase, mentionedUserId, mentionedId);
        } else if (!mentionedUserId) {
          // 登録されていないユーザーは外部ユーザーとして扱う
          praisedExternalUserNames.push(mentionedUserName);
          console.log(
            `メンションされたユーザーが見つかりませんでした。外部ユーザーとして登録: ${mentionedUserName}`,
          );
        }
      }
    }

    // メッセージからメンションを除去してテキストを取得
    const cleanText = messageText
      .replace(/<@[^>]+>/g, "")
      .replace(/グッジョブ/gi, "")
      .trim();

    // タイトルと内容を抽出
    const { title, content } = parseMessage(cleanText);

    // 画像をダウンロードして保存
    const imagePaths: string[] = [];
    if (fileIds && fileIds.length > 0) {
      for (const fileId of fileIds.slice(0, 3)) {
        // 最大3枚まで
        const imagePath = await downloadAndSaveSlackImage(
          fileId,
          creatorId,
          supabase,
        );
        if (imagePath) {
          imagePaths.push(imagePath);
        }
      }
    }

    // グッジョブを作成
    const { data: mission, error: missionError } = await supabase
      .from("user_missions")
      .insert({
        created_by: creatorId,
        title,
        content,
        image_paths: imagePaths.length > 0 ? (imagePaths as Json) : [],
        status: "approved",
        approved_at: new Date().toISOString(),
        approved_by: creatorId,
      })
      .select()
      .single();

    if (missionError || !mission) {
      console.error("グッジョブ作成エラー:", missionError);
      return {
        success: false,
        error: `グッジョブ作成に失敗しました: ${missionError?.message}`,
      };
    }

    // 賞賛対象ユーザーを挿入（メンション先）
    if (praisedUserIds.length > 0) {
      const praisedUsers = praisedUserIds.map((userId) => ({
        user_mission_id: mission.id,
        praised_user_id: userId,
      }));

      const { error: praisedError } = await supabase
        .from("user_mission_praised_users")
        .insert(praisedUsers);

      if (praisedError) {
        console.error("賞賛対象ユーザー挿入エラー:", praisedError);
        // エラーが発生してもグッジョブは作成されているので続行
      }
    }

    // 外部ユーザーを挿入
    if (praisedExternalUserNames.length > 0) {
      const externalUsers = praisedExternalUserNames.map((name) => ({
        user_mission_id: mission.id,
        praised_person_name: name,
      }));

      const { error: externalError } = await supabase
        .from("user_mission_praised_external_users")
        .insert(externalUsers);

      if (externalError) {
        console.error("外部ユーザー挿入エラー:", externalError);
        // エラーが発生してもグッジョブは作成されているので続行
      } else {
        // 外部ユーザー用の保留ポイントを保存
        const pendingXpRecords = externalUsers.map((extUser) => ({
          external_user_name: extUser.praised_person_name,
          user_mission_id: mission.id,
          xp_amount: 5,
          source_type: "USER_MISSION_PRAISED_EXTERNAL",
          description: `ユーザーグッジョブ「${title}」で賞賛されました（保留中・Slack投稿）`,
        }));

        const { error: pendingXpError } = await supabase
          .from("external_user_pending_xp")
          .insert(pendingXpRecords);

        if (pendingXpError) {
          console.error("保留ポイント挿入エラー:", pendingXpError);
          // エラーが発生してもグッジョブ作成処理は継続
        }
      }
    }

    // ポイント付与
    await awardPointsForMissionCreation(
      mission.id,
      creatorId,
      praisedUserIds,
      praisedExternalUserNames,
      supabase,
    );

    return { success: true, missionId: mission.id };
  } catch (error) {
    console.error("グッジョブ作成処理エラー:", error);
    return {
      success: false,
      error: `予期しないエラー: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * グッジョブ作成時のポイント付与（既存ロジックを再利用）
 */
async function awardPointsForMissionCreation(
  missionId: string,
  creatorId: string,
  praisedUserIds: string[],
  praisedExternalUserNames: string[],
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
) {
  try {
    const activePraisedIds = await filterActiveUserIds(praisedUserIds);
    // 作成者に5ポイント
    await supabase.from("xp_transactions").insert({
      user_id: creatorId,
      xp_amount: 5,
      source_type: "USER_MISSION_CREATION",
      source_id: missionId,
      description: "ユーザーグッジョブを作成しました（Slack投稿）",
    });

    // 賞賛対象者に各々5ポイント
    for (const userId of praisedUserIds) {
      if (userId === creatorId) continue;
      if (!activePraisedIds.has(userId)) continue;
      await supabase.from("xp_transactions").insert({
        user_id: userId,
        xp_amount: 5,
        source_type: "USER_MISSION_PRAISED",
        source_id: missionId,
        description: "ユーザーグッジョブで賞賛されました（Slack投稿）",
      });
    }

    // 外部ユーザーのポイントは保留テーブルに既に保存済み
  } catch (error) {
    console.error("ポイント付与エラー:", error);
  }
}

/**
 * Slack Webhook受信エンドポイント
 */
export async function POST(request: NextRequest) {
  try {
    // 署名検証
    const signature = request.headers.get("x-slack-signature");
    const timestamp = request.headers.get("x-slack-request-timestamp");

    if (!signature || !timestamp) {
      console.error("署名ヘッダーが不足しています");
      return NextResponse.json(
        { error: "Missing required headers" },
        { status: 401 },
      );
    }

    // bodyを取得（署名検証のために必要）
    const body = await request.text();

    // 署名検証
    const isValidSignature = await verifySlackSignature(
      body,
      signature,
      timestamp,
    );
    if (!isValidSignature) {
      console.error("署名検証に失敗しました");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    // JSONパース
    let payload: {
      type?: string;
      challenge?: string;
      event?: {
        type?: string;
        subtype?: string;
        channel?: string;
        text?: string;
        user?: string;
        user_name?: string;
        ts?: string;
      };
    };
    try {
      payload = JSON.parse(body);
    } catch (parseError) {
      console.error("JSON解析エラー:", parseError);
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    // URL Verification（初回設定時に必要）
    if (payload.type === "url_verification") {
      if (!payload.challenge) {
        console.error("challengeが含まれていません");
        return NextResponse.json(
          { error: "Missing challenge" },
          { status: 400 },
        );
      }
      return NextResponse.json({ challenge: payload.challenge });
    }

    // イベント処理
    if (payload.type === "event_callback" && payload.event) {
      const event = payload.event;

      // メッセージイベントのみ処理
      if (event.type === "message" && event.subtype !== "bot_message") {
        // チャンネルフィルタリング
        const monitorChannelId = process.env.SLACK_MONITOR_CHANNEL_ID;
        if (monitorChannelId && event.channel !== monitorChannelId) {
          console.log(
            `チャンネルIDが一致しません: ${event.channel} (監視対象: ${monitorChannelId})`,
          );
          return NextResponse.json({ ok: true });
        }

        // 重複チェック
        const messageKey = `${event.channel}:${event.ts}`;
        if (processedMessages.has(messageKey)) {
          console.log(`メッセージは既に処理済み: ${messageKey}`);
          return NextResponse.json({ ok: true });
        }

        // 「グッジョブ」キーワードチェック
        const messageText = event.text || "";
        if (!isGoodJobMessage(messageText)) {
          return NextResponse.json({ ok: true });
        }

        // 処理済みとして記録
        processedMessages.add(messageKey);

        // 投稿者が存在しない場合はスキップ
        if (!event.user) {
          console.warn("メッセージにユーザー情報が含まれていません");
          return NextResponse.json({ ok: true });
        }

        // 非同期でグッジョブ作成処理（レスポンスを即座に返す）
        const supabase = await createServiceClient();
        const mentionedUserIds = extractMentions(messageText);

        // 画像ファイルIDを取得
        const eventWithFiles = event as {
          files?: Array<{ id: string; mimetype?: string }>;
        };
        const fileIds =
          eventWithFiles.files
            ?.filter((file) => file.mimetype?.startsWith("image/"))
            .map((file) => file.id) || [];

        // 投稿者の情報を取得
        const userInfo = await getSlackUserInfo(event.user);
        const slackUserName =
          userInfo?.display_name ||
          userInfo?.name ||
          event.user_name ||
          "不明なユーザー";

        createGoodJobFromSlack(
          event.user,
          slackUserName,
          messageText,
          mentionedUserIds,
          fileIds,
          supabase,
        ).then((result) => {
          if (result.success) {
            console.log(`グッジョブ作成成功: missionId=${result.missionId}`);
          } else {
            console.error(`グッジョブ作成失敗: ${result.error}`);
          }
        });

        return NextResponse.json({ ok: true });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Slack webhookエラー:", error);
    // エラーの詳細をログに出力（本番環境でのデバッグ用）
    if (error instanceof Error) {
      console.error("エラーメッセージ:", error.message);
      console.error("エラースタック:", error.stack);
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
