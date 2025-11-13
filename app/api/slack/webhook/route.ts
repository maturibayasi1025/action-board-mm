import { createServiceClient } from "@/lib/supabase/server";
import { findBestMatch } from "@/lib/utils/fuzzyMatch";
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
      console.error("[Slack Webhook] SLACK_SIGNING_SECRETが設定されていません");
      return false;
    }

    // リプレイ攻撃防止: 5分以上のタイムスタンプは拒否
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const timestampNum = Number.parseInt(timestamp, 10);
    if (Number.isNaN(timestampNum)) {
      console.error(
        "[Slack Webhook] 無効なタイムスタンプ形式:",
        timestamp,
        "現在時刻:",
        currentTimestamp,
      );
      return false;
    }

    const timeDiff = Math.abs(currentTimestamp - timestampNum);
    if (timeDiff > 300) {
      console.error(
        `[Slack Webhook] タイムスタンプのずれが大きすぎます: ${timeDiff}秒 (現在: ${currentTimestamp}, リクエスト: ${timestampNum})`,
      );
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
      console.error(
        `[Slack Webhook] 署名の長さが一致しません: 期待値=${mySignature.length}, 実際=${signature.length}`,
      );
      return false;
    }

    let result = 0;
    for (let i = 0; i < mySignature.length; i++) {
      result |= mySignature.charCodeAt(i) ^ signature.charCodeAt(i);
    }

    const isValid = result === 0;
    if (!isValid) {
      console.error("[Slack Webhook] 署名検証に失敗しました");
    }
    return isValid;
  } catch (error) {
    console.error(
      "[Slack Webhook] 署名検証処理中にエラーが発生しました:",
      error instanceof Error
        ? {
            message: error.message,
            stack: error.stack,
            name: error.name,
          }
        : error,
    );
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
      "[Slack Webhook] SLACK_BOT_TOKENが設定されていません。ユーザー情報を取得できません。",
    );
    return null;
  }

  try {
    console.log(`[Slack Webhook] Slackユーザー情報を取得中: ${slackUserId}`);
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
      console.error(
        `[Slack Webhook] Slack API HTTPエラー: ${response.status} ${response.statusText}`,
      );
      return null;
    }

    const data = await response.json();
    if (!data.ok) {
      console.error(
        `[Slack Webhook] Slack API エラー: ${data.error} (ユーザーID: ${slackUserId})`,
      );
      return null;
    }

    const user = data.user;
    const userInfo = {
      name: user.real_name || user.name || "不明なユーザー",
      display_name: user.profile?.display_name || user.real_name,
    };
    console.log(
      `[Slack Webhook] ユーザー情報取得成功: ${userInfo.name} (display_name: ${userInfo.display_name})`,
    );
    return userInfo;
  } catch (error) {
    console.error(
      "[Slack Webhook] Slack API呼び出しエラー:",
      error instanceof Error
        ? {
            message: error.message,
            stack: error.stack,
            name: error.name,
            userId: slackUserId,
          }
        : { error, userId: slackUserId },
    );
    return null;
  }
}

/**
 * アプリ内のユーザー名からユーザーIDを取得（あいまい検索）
 */
async function findUserByName(
  slackUserName: string,
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
): Promise<string | null> {
  try {
    console.log(`[Slack Webhook] ユーザー名で検索中: "${slackUserName}"`);
    // 全てのユーザーを取得（Service ClientなのでRLSバイパス）
    const { data: users, error } = await supabase
      .from("private_users")
      .select("id, name");

    if (error) {
      console.error(
        "[Slack Webhook] ユーザー取得エラー:",
        error instanceof Error
          ? {
              message: error.message,
              stack: error.stack,
              code: error.code,
              details: error.details,
            }
          : error,
      );
      return null;
    }

    if (!users || users.length === 0) {
      console.warn("[Slack Webhook] ユーザーが存在しません");
      return null;
    }

    console.log(`[Slack Webhook] ユーザー検索対象数: ${users.length}件`);

    // あいまい検索でマッチング
    const match = findBestMatch(
      slackUserName,
      users.map((u) => ({ text: u.name, data: u.id })),
      0.7, // 類似度70%以上でマッチング
    );

    if (match) {
      console.log(
        `[Slack Webhook] ユーザー名マッチング成功: "${slackUserName}" → "${match.text}" (類似度: ${(match.similarity * 100).toFixed(1)}%, ユーザーID: ${match.data})`,
      );
      return match.data;
    }

    console.warn(
      `[Slack Webhook] ユーザー名が見つかりませんでした: "${slackUserName}" (検索対象: ${users.length}件)`,
    );
    return null;
  } catch (error) {
    console.error(
      "[Slack Webhook] findUserByName処理エラー:",
      error instanceof Error
        ? {
            message: error.message,
            stack: error.stack,
            name: error.name,
            slackUserName,
          }
        : { error, slackUserName },
    );
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
 * グッジョブを作成
 */
async function createGoodJobFromSlack(
  slackUserId: string,
  slackUserName: string,
  messageText: string,
  mentionedUserIds: string[],
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
): Promise<{ success: boolean; missionId?: string; error?: string }> {
  const startTime = Date.now();
  console.log(
    `[Slack Webhook] グッジョブ作成処理開始: 投稿者=${slackUserName} (${slackUserId}), メンション数=${mentionedUserIds.length}`,
  );

  try {
    // 投稿者を特定
    console.log(`[Slack Webhook] 投稿者のユーザー検索中: "${slackUserName}"`);
    const creatorId = await findUserByName(slackUserName, supabase);
    if (!creatorId) {
      const errorMsg = `投稿者のユーザーが見つかりませんでした: ${slackUserName}`;
      console.error(`[Slack Webhook] ${errorMsg}`);
      return {
        success: false,
        error: errorMsg,
      };
    }
    console.log(`[Slack Webhook] 投稿者のユーザーID取得: ${creatorId}`);

    // メンション先のユーザーを特定
    const praisedUserIds: string[] = [];
    console.log(
      `[Slack Webhook] メンションされたユーザーの検索開始: ${mentionedUserIds.length}件`,
    );
    for (const mentionedId of mentionedUserIds) {
      try {
        // Slack APIでユーザー情報を取得
        const userInfo = await getSlackUserInfo(mentionedId);
        if (userInfo) {
          // 表示名または実名を使用
          const mentionedUserName = userInfo.display_name || userInfo.name;
          const mentionedUserId = await findUserByName(
            mentionedUserName,
            supabase,
          );
          if (mentionedUserId && mentionedUserId !== creatorId) {
            praisedUserIds.push(mentionedUserId);
            console.log(
              `[Slack Webhook] メンション対象ユーザー追加: ${mentionedUserName} (${mentionedUserId})`,
            );
          } else if (!mentionedUserId) {
            console.warn(
              `[Slack Webhook] メンションされたユーザーが見つかりませんでした: ${mentionedUserName} (Slack ID: ${mentionedId})`,
            );
          } else {
            console.log(
              `[Slack Webhook] メンション対象が投稿者と同じためスキップ: ${mentionedUserName}`,
            );
          }
        } else {
          console.warn(
            `[Slack Webhook] Slackユーザー情報の取得に失敗: ${mentionedId}`,
          );
        }
      } catch (mentionError) {
        console.error(
          `[Slack Webhook] メンション処理エラー (${mentionedId}):`,
          mentionError instanceof Error
            ? {
                message: mentionError.message,
                stack: mentionError.stack,
              }
            : mentionError,
        );
      }
    }
    console.log(
      `[Slack Webhook] 賞賛対象ユーザー数: ${praisedUserIds.length}件`,
    );

    // メッセージからメンションを除去してテキストを取得
    const cleanText = messageText
      .replace(/<@[^>]+>/g, "")
      .replace(/グッジョブ/gi, "")
      .trim();

    // タイトルと内容を抽出
    const { title, content } = parseMessage(cleanText);
    console.log(
      `[Slack Webhook] メッセージ解析完了: タイトル="${title}", 内容長=${content.length}文字`,
    );

    // グッジョブを作成
    console.log("[Slack Webhook] グッジョブをデータベースに挿入中...");
    const { data: mission, error: missionError } = await supabase
      .from("user_missions")
      .insert({
        created_by: creatorId,
        title,
        content,
        status: "approved",
        approved_at: new Date().toISOString(),
        approved_by: creatorId,
      })
      .select()
      .single();

    if (missionError) {
      console.error(
        "[Slack Webhook] グッジョブ作成エラー:",
        missionError instanceof Error
          ? {
              message: missionError.message,
              stack: missionError.stack,
              code: missionError.code,
              details: missionError.details,
            }
          : missionError,
      );
      return {
        success: false,
        error: `グッジョブ作成に失敗しました: ${missionError?.message || String(missionError)}`,
      };
    }

    if (!mission) {
      console.error(
        "[Slack Webhook] グッジョブ作成失敗: データが返されませんでした",
      );
      return {
        success: false,
        error: "グッジョブ作成に失敗しました: データが返されませんでした",
      };
    }

    console.log(`[Slack Webhook] グッジョブ作成成功: missionId=${mission.id}`);

    // 賞賛対象ユーザーを挿入（メンション先）
    if (praisedUserIds.length > 0) {
      console.log(
        `[Slack Webhook] 賞賛対象ユーザーを挿入中: ${praisedUserIds.length}件`,
      );
      const praisedUsers = praisedUserIds.map((userId) => ({
        user_mission_id: mission.id,
        praised_user_id: userId,
      }));

      const { error: praisedError } = await supabase
        .from("user_mission_praised_users")
        .insert(praisedUsers);

      if (praisedError) {
        console.error(
          "[Slack Webhook] 賞賛対象ユーザー挿入エラー:",
          praisedError instanceof Error
            ? {
                message: praisedError.message,
                stack: praisedError.stack,
                code: praisedError.code,
                details: praisedError.details,
              }
            : praisedError,
        );
        // エラーが発生してもグッジョブは作成されているので続行
      } else {
        console.log(
          `[Slack Webhook] 賞賛対象ユーザー挿入成功: ${praisedUserIds.length}件`,
        );
      }
    }

    // ポイント付与
    console.log("[Slack Webhook] ポイント付与処理開始");
    await awardPointsForMissionCreation(
      mission.id,
      creatorId,
      praisedUserIds,
      supabase,
    );
    console.log("[Slack Webhook] ポイント付与処理完了");

    const duration = Date.now() - startTime;
    console.log(
      `[Slack Webhook] グッジョブ作成処理完了: missionId=${mission.id}, 処理時間=${duration}ms`,
    );

    return { success: true, missionId: mission.id };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(
      `[Slack Webhook] グッジョブ作成処理エラー (処理時間: ${duration}ms):`,
      error instanceof Error
        ? {
            message: error.message,
            stack: error.stack,
            name: error.name,
            slackUserId,
            slackUserName,
            mentionedUserIds,
          }
        : { error, slackUserId, slackUserName, mentionedUserIds },
    );
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
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
) {
  try {
    console.log(
      `[Slack Webhook] ポイント付与開始: 作成者=${creatorId}, 賞賛対象=${praisedUserIds.length}件`,
    );

    // 作成者に5ポイント
    const { error: creatorError } = await supabase
      .from("xp_transactions")
      .insert({
        user_id: creatorId,
        xp_amount: 5,
        source_type: "USER_MISSION_CREATION",
        source_id: missionId,
        description: "ユーザーグッジョブを作成しました（Slack投稿）",
      });

    if (creatorError) {
      console.error(
        "[Slack Webhook] 作成者へのポイント付与エラー:",
        creatorError instanceof Error
          ? {
              message: creatorError.message,
              code: creatorError.code,
              details: creatorError.details,
            }
          : creatorError,
      );
    } else {
      console.log(`[Slack Webhook] 作成者へのポイント付与成功: ${creatorId}`);
    }

    // 賞賛対象者に各々5ポイント
    for (const userId of praisedUserIds) {
      if (userId === creatorId) {
        console.log(
          `[Slack Webhook] 賞賛対象が作成者と同じためスキップ: ${userId}`,
        );
        continue;
      }

      const { error: praisedError } = await supabase
        .from("xp_transactions")
        .insert({
          user_id: userId,
          xp_amount: 5,
          source_type: "USER_MISSION_PRAISED",
          source_id: missionId,
          description: "ユーザーグッジョブで賞賛されました（Slack投稿）",
        });

      if (praisedError) {
        console.error(
          `[Slack Webhook] 賞賛対象へのポイント付与エラー (${userId}):`,
          praisedError instanceof Error
            ? {
                message: praisedError.message,
                code: praisedError.code,
                details: praisedError.details,
              }
            : praisedError,
        );
      } else {
        console.log(`[Slack Webhook] 賞賛対象へのポイント付与成功: ${userId}`);
      }
    }

    console.log("[Slack Webhook] ポイント付与処理完了");
  } catch (error) {
    console.error(
      "[Slack Webhook] ポイント付与エラー:",
      error instanceof Error
        ? {
            message: error.message,
            stack: error.stack,
            name: error.name,
            missionId,
            creatorId,
            praisedUserIds,
          }
        : { error, missionId, creatorId, praisedUserIds },
    );
  }
}

/**
 * 環境変数の検証
 */
function validateEnvironmentVariables(): {
  isValid: boolean;
  missingVars: string[];
} {
  const requiredVars = [
    "SLACK_SIGNING_SECRET",
    "SLACK_BOT_TOKEN",
    "SLACK_MONITOR_CHANNEL_ID",
  ];
  const missingVars: string[] = [];

  for (const varName of requiredVars) {
    if (!process.env[varName]) {
      missingVars.push(varName);
    }
  }

  return {
    isValid: missingVars.length === 0,
    missingVars,
  };
}

/**
 * Slack Webhook受信エンドポイント
 */
export async function POST(request: NextRequest) {
  const requestStartTime = Date.now();
  console.log("[Slack Webhook] リクエスト受信開始");

  try {
    // 環境変数の検証
    const envValidation = validateEnvironmentVariables();
    if (!envValidation.isValid) {
      console.error(
        `[Slack Webhook] 必要な環境変数が不足しています: ${envValidation.missingVars.join(", ")}`,
      );
      return NextResponse.json(
        {
          error: "Configuration error",
          message: `Missing environment variables: ${envValidation.missingVars.join(", ")}`,
        },
        { status: 500 },
      );
    }

    // 署名検証
    const signature = request.headers.get("x-slack-signature");
    const timestamp = request.headers.get("x-slack-request-timestamp");

    console.log(
      `[Slack Webhook] ヘッダー確認: signature=${!!signature}, timestamp=${!!timestamp}`,
    );

    if (!signature || !timestamp) {
      console.error("[Slack Webhook] 署名ヘッダーが不足しています", {
        hasSignature: !!signature,
        hasTimestamp: !!timestamp,
      });
      return NextResponse.json(
        { error: "Missing required headers" },
        { status: 401 },
      );
    }

    // bodyを取得（署名検証のために必要）
    const body = await request.text();
    console.log(`[Slack Webhook] リクエストボディ取得完了: ${body.length}文字`);

    // 署名検証
    console.log("[Slack Webhook] 署名検証開始");
    const isValidSignature = await verifySlackSignature(
      body,
      signature,
      timestamp,
    );
    if (!isValidSignature) {
      console.error("[Slack Webhook] 署名検証に失敗しました");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
    console.log("[Slack Webhook] 署名検証成功");

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
        thread_ts?: string;
        files?: unknown[];
      };
    };
    try {
      payload = JSON.parse(body);
      console.log(
        `[Slack Webhook] JSON解析成功: type=${payload.type}, event.type=${payload.event?.type}`,
      );
    } catch (parseError) {
      console.error(
        "[Slack Webhook] JSON解析エラー:",
        parseError instanceof Error
          ? {
              message: parseError.message,
              stack: parseError.stack,
            }
          : parseError,
      );
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    // URL Verification（初回設定時に必要）
    if (payload.type === "url_verification") {
      console.log("[Slack Webhook] URL Verification リクエスト受信");
      if (!payload.challenge) {
        console.error("[Slack Webhook] challengeが含まれていません");
        return NextResponse.json(
          { error: "Missing challenge" },
          { status: 400 },
        );
      }
      console.log(`[Slack Webhook] Challenge返却: ${payload.challenge}`);
      return NextResponse.json({ challenge: payload.challenge });
    }

    // イベント処理
    if (payload.type === "event_callback" && payload.event) {
      const event = payload.event;

      console.log(
        `[Slack Webhook] イベント受信: type=${event.type}, subtype=${event.subtype || "なし"}, channel=${event.channel}, user=${event.user || "なし"}`,
      );

      // メッセージイベントのみ処理
      if (event.type === "message") {
        // ボットメッセージをスキップ
        if (event.subtype === "bot_message") {
          console.log("[Slack Webhook] ボットメッセージのためスキップ");
          return NextResponse.json({ ok: true });
        }

        // スレッド返信をスキップ（必要に応じて有効化可能）
        if (event.thread_ts) {
          console.log(
            `[Slack Webhook] スレッド返信のためスキップ: thread_ts=${event.thread_ts}`,
          );
          return NextResponse.json({ ok: true });
        }

        // ファイルアップロードのみのメッセージをスキップ
        if (event.files && event.files.length > 0 && !event.text) {
          console.log(
            `[Slack Webhook] ファイルアップロードのみのメッセージのためスキップ: files=${event.files.length}件`,
          );
          return NextResponse.json({ ok: true });
        }

        // チャンネルフィルタリング
        const monitorChannelId = process.env.SLACK_MONITOR_CHANNEL_ID;
        if (monitorChannelId && event.channel !== monitorChannelId) {
          console.log(
            `[Slack Webhook] チャンネルIDが一致しません: ${event.channel} (監視対象: ${monitorChannelId})`,
          );
          return NextResponse.json({ ok: true });
        }

        // 重複チェック
        const messageKey = `${event.channel}:${event.ts}`;
        if (processedMessages.has(messageKey)) {
          console.log(
            `[Slack Webhook] メッセージは既に処理済み: ${messageKey}`,
          );
          return NextResponse.json({ ok: true });
        }

        // メッセージテキストの確認
        const messageText = event.text || "";
        if (!messageText) {
          console.log(
            "[Slack Webhook] メッセージテキストが存在しないためスキップ",
          );
          return NextResponse.json({ ok: true });
        }

        console.log(
          `[Slack Webhook] メッセージテキスト: "${messageText.substring(0, 100)}${messageText.length > 100 ? "..." : ""}"`,
        );

        // 「グッジョブ」キーワードチェック
        if (!isGoodJobMessage(messageText)) {
          console.log(
            "[Slack Webhook] 「グッジョブ」キーワードが見つかりませんでした",
          );
          return NextResponse.json({ ok: true });
        }

        console.log("[Slack Webhook] 「グッジョブ」キーワードを検出");

        // 処理済みとして記録
        processedMessages.add(messageKey);

        // 投稿者が存在しない場合はスキップ
        if (!event.user) {
          console.warn(
            "[Slack Webhook] メッセージにユーザー情報が含まれていません",
          );
          return NextResponse.json({ ok: true });
        }

        // 非同期でグッジョブ作成処理（レスポンスを即座に返す）
        console.log("[Slack Webhook] Supabaseクライアント作成中...");
        const supabase = await createServiceClient();
        const mentionedUserIds = extractMentions(messageText);
        console.log(
          `[Slack Webhook] メンション抽出完了: ${mentionedUserIds.length}件`,
        );

        // 投稿者の情報を取得
        console.log(`[Slack Webhook] 投稿者情報取得中: ${event.user}`);
        const userInfo = await getSlackUserInfo(event.user);
        const slackUserName =
          userInfo?.display_name ||
          userInfo?.name ||
          event.user_name ||
          "不明なユーザー";

        console.log(
          `[Slack Webhook] グッジョブ作成処理を非同期で開始: 投稿者=${slackUserName}`,
        );

        // 非同期処理のエラーハンドリングを強化
        createGoodJobFromSlack(
          event.user,
          slackUserName,
          messageText,
          mentionedUserIds,
          supabase,
        )
          .then((result) => {
            if (result.success) {
              console.log(
                `[Slack Webhook] グッジョブ作成成功: missionId=${result.missionId}`,
              );
            } else {
              console.error(
                `[Slack Webhook] グッジョブ作成失敗: ${result.error}`,
                {
                  slackUserId: event.user,
                  slackUserName,
                  messageText: messageText.substring(0, 200),
                  mentionedUserIds,
                },
              );
            }
          })
          .catch((error) => {
            console.error(
              "[Slack Webhook] グッジョブ作成処理で予期しないエラー:",
              error instanceof Error
                ? {
                    message: error.message,
                    stack: error.stack,
                    name: error.name,
                    slackUserId: event.user,
                    slackUserName,
                    mentionedUserIds,
                  }
                : {
                    error,
                    slackUserId: event.user,
                    slackUserName,
                    mentionedUserIds,
                  },
            );
          });

        const requestDuration = Date.now() - requestStartTime;
        console.log(
          `[Slack Webhook] リクエスト処理完了: 処理時間=${requestDuration}ms`,
        );

        return NextResponse.json({ ok: true });
      }
      console.log(
        `[Slack Webhook] メッセージイベント以外のためスキップ: type=${event.type}`,
      );
    } else {
      console.log(
        `[Slack Webhook] event_callback以外のイベント: type=${payload.type}`,
      );
    }

    const requestDuration = Date.now() - requestStartTime;
    console.log(
      `[Slack Webhook] リクエスト処理完了（処理なし）: 処理時間=${requestDuration}ms`,
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    const requestDuration = Date.now() - requestStartTime;
    console.error(
      `[Slack Webhook] エラー発生 (処理時間: ${requestDuration}ms):`,
      error instanceof Error
        ? {
            message: error.message,
            stack: error.stack,
            name: error.name,
          }
        : error,
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
