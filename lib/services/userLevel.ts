import "server-only";

import { createServiceClient } from "@/lib/supabase/server";
import type { Tables, TablesInsert } from "@/lib/types/supabase";
import {
  executeChunkedInsert,
  executeChunkedQuery,
} from "@/lib/utils/supabase-utils";
import { calculateLevel, calculateMissionXp } from "../utils/utils";
import { getUser } from "./users";

export type UserLevel = Tables<"user_levels">;
export type XpTransaction = Tables<"xp_transactions">;
export type XpTransactionInsert = TablesInsert<"xp_transactions">;

/**
 * ユーザーのレベル情報を取得する
 */
export async function getMyUserLevel(): Promise<UserLevel | null> {
  const user = await getUser();
  if (!user) {
    console.error("User not found");
    return null;
  }

  const supabase = await createServiceClient();

  const { data } = await supabase
    .from("user_levels")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  return data;
}

/**
 * ユーザーのレベル情報を取得する
 */
export async function getUserLevel(userId: string): Promise<UserLevel | null> {
  const supabase = await createServiceClient();

  const { data } = await supabase
    .from("user_levels")
    .select("*")
    .eq("user_id", userId)
    .single();

  return data;
}

/**
 * ユーザーのレベル情報を初期化する（新規ユーザー用）
 */
export async function initializeUserLevel(
  userId: string,
): Promise<UserLevel | null> {
  const supabase = await createServiceClient();

  const { data, error } = await supabase
    .from("user_levels")
    .insert({
      user_id: userId,
      xp: 0,
      level: 1,
    })
    .select()
    .single();

  if (error) {
    console.error("Failed to initialize user level:", error);
    return null;
  }

  return data;
}

/**
 * ユーザーのレベル情報を取得、存在しない場合は初期化
 */
export async function getOrInitializeUserLevel(
  userId: string,
): Promise<UserLevel | null> {
  let userLevel = await getUserLevel(userId);

  if (!userLevel) {
    userLevel = await initializeUserLevel(userId);
  }

  return userLevel;
}

/**
 * XPトランザクションの記録を行う共通処理
 * ユーザーレベルの更新はデータベーストリガーに任せる
 */
async function processXpTransaction(
  userId: string,
  xpAmount: number,
  sourceType:
    | "MISSION_COMPLETION"
    | "BONUS"
    | "PENALTY"
    | "MISSION_CANCELLATION"
    | "USER_MISSION_LIKE_GIVEN"
    | "USER_MISSION_LIKES"
    | "USER_MISSION_CREATION"
    | "USER_MISSION_PRAISED",
  sourceId?: string,
  description?: string,
): Promise<{ success: boolean; userLevel?: UserLevel; error?: string }> {
  const supabase = await createServiceClient();

  try {
    // XPトランザクションを記録（トリガーがuser_levelsを自動更新）
    const { error: transactionError } = await supabase
      .from("xp_transactions")
      .insert({
        user_id: userId,
        xp_amount: xpAmount,
        source_type: sourceType,
        source_id: sourceId,
        description: description || `${sourceType}による経験値調整`,
      });

    if (transactionError) {
      console.error("Failed to create XP transaction:", transactionError);
      // ユニーク制約違反の場合は既にXPが付与されている可能性が高い
      if (isUniqueConstraintError(transactionError)) {
        return {
          success: false,
          error: "既にXPが付与されています",
        };
      }
      return { success: false, error: transactionError.message };
    }

    // トリガーによる更新後のユーザーレベル情報を取得
    const { data: updatedLevel, error: fetchError } = await supabase
      .from("user_levels")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (fetchError) {
      console.error("Failed to fetch updated user level:", fetchError);
      return {
        success: false,
        error: "ユーザーレベル情報の取得に失敗しました",
      };
    }

    return { success: true, userLevel: updatedLevel };
  } catch (error) {
    console.error("Error in processXpTransaction:", error);
    return { success: false, error: "予期しないエラーが発生しました" };
  }
}

/**
 * 手動でXPを付与する（ボーナスや調整用）
 */
export async function grantXp(
  userId: string,
  xpAmount: number,
  sourceType:
    | "MISSION_COMPLETION"
    | "BONUS"
    | "PENALTY"
    | "MISSION_CANCELLATION"
    | "USER_MISSION_LIKE_GIVEN"
    | "USER_MISSION_LIKES"
    | "USER_MISSION_CREATION"
    | "USER_MISSION_PRAISED" = "BONUS",
  sourceId?: string,
  description?: string,
): Promise<{ success: boolean; userLevel?: UserLevel; error?: string }> {
  return processXpTransaction(
    userId,
    xpAmount,
    sourceType,
    sourceId,
    description,
  );
}

/**
 * ユーザーのXP履歴を取得する
 */
export async function getUserXpHistory(
  userId: string,
  limit = 50,
): Promise<XpTransaction[]> {
  const supabase = await createServiceClient();

  const { data, error } = await supabase
    .from("xp_transactions")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Failed to fetch XP history:", error);
    return [];
  }

  return data || [];
}

/**
 * ユーザーのBONUSXPを取得する
 */
export async function getUserXpBonus(
  userId: string,
  achievementId: string,
): Promise<number> {
  const supabase = await createServiceClient();

  const { data, error } = await supabase
    .from("xp_transactions")
    .select("xp_amount")
    .eq("user_id", userId)
    .eq("source_id", achievementId)
    .eq("source_type", "BONUS")
    .single();

  if (error) {
    console.error("Failed to fetch BONUS XP:", error);
    return 0;
  }

  return data.xp_amount || 0;
}

/**
 * 特定ユーザーのランクを取得する
 */
export async function getUserRank(userId: string): Promise<number | null> {
  const supabase = await createServiceClient();

  // より高いXPを持つユーザーの数を数える
  const { data: userLevel } = await supabase
    .from("user_levels")
    .select("xp")
    .eq("user_id", userId)
    .single();

  if (!userLevel) return null;

  const { count, error } = await supabase
    .from("user_levels")
    .select("*", { count: "exact", head: true })
    .gt("xp", userLevel.xp);

  if (error) {
    console.error("Failed to calculate user rank:", error);
    return null;
  }

  return (count || 0) + 1; // より高いユーザー数 + 1 = 自分のランク
}

/**
 * エラーがリトライ可能かどうかを判定する
 */
function isRetryableError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  // Supabaseエラーの場合
  if ("code" in error) {
    const errorCode = String(error.code);
    // PostgreSQLエラーコードでリトライ可能なもの
    // 08000系: 接続例外
    // 40001: シリアライゼーション失敗（デッドロックなど）
    // 40P01: デッドロック検出
    // 55P03: ロックが取得できない
    if (
      errorCode.startsWith("08") ||
      errorCode === "40001" ||
      errorCode === "40P01" ||
      errorCode === "55P03"
    ) {
      return true;
    }
  }

  // ネットワークエラーやタイムアウトエラー
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    if (
      message.includes("network") ||
      message.includes("timeout") ||
      message.includes("connection") ||
      message.includes("econnreset") ||
      message.includes("etimedout")
    ) {
      return true;
    }
  }

  return false;
}

/**
 * エラーがユニーク制約違反（既にXPが付与されている）かどうかを判定する
 */
function isUniqueConstraintError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  // PostgreSQLのユニーク制約違反エラーコード: 23505
  if ("code" in error) {
    const errorCode = String(error.code);
    if (errorCode === "23505") {
      return true;
    }
  }

  // エラーメッセージからも判定
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    if (
      message.includes("unique") ||
      message.includes("duplicate") ||
      message.includes("already exists")
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Sentryにエラーを送信する（サーバーサイド用）
 */
async function captureErrorToSentry(
  error: Error | string,
  context?: Record<string, unknown>,
): Promise<void> {
  // サーバーサイドでのみ実行
  if (typeof window !== "undefined") {
    return;
  }

  try {
    // 動的インポートでSentryを読み込む（Edge Runtimeでも動作するように）
    const Sentry = await import("@sentry/nextjs").catch(() => null);
    if (!Sentry) {
      return;
    }

    if (typeof error === "string") {
      Sentry.captureMessage(error, {
        level: "error",
        extra: context,
        tags: {
          source: "xp-grant",
        },
      });
    } else {
      Sentry.captureException(error, {
        extra: context,
        tags: {
          source: "xp-grant",
        },
      });
    }
  } catch (sentryError) {
    // Sentryへの送信に失敗しても処理を続行
    console.error("Failed to send error to Sentry:", sentryError);
  }
}

/**
 * グッジョブ達成時にXPを付与する（リトライ機構付き）
 */
export async function grantMissionCompletionXp(
  userId: string,
  missionId: string,
  achievementId: string,
  retryCount = 0,
  maxRetries = 3,
): Promise<{
  success: boolean;
  userLevel?: UserLevel;
  xpGranted?: number;
  error?: string;
}> {
  const supabase = await createServiceClient();

  try {
    // グッジョブ情報を取得して難易度を確認
    const { data: mission, error: missionError } = await supabase
      .from("missions")
      .select("difficulty, title")
      .eq("id", missionId)
      .single();

    if (missionError) {
      console.error("Failed to fetch mission:", missionError);
      return { success: false, error: "グッジョブ情報の取得に失敗しました" };
    }

    // 難易度に基づくXP計算
    const xpToGrant = calculateMissionXp(mission.difficulty);
    const description = `グッジョブ「${mission.title}」達成による経験値獲得`;

    // 共通のXP処理を実行
    const result = await processXpTransaction(
      userId,
      xpToGrant,
      "MISSION_COMPLETION",
      achievementId,
      description,
    );

    if (result.success) {
      return {
        success: true,
        userLevel: result.userLevel,
        xpGranted: xpToGrant,
      };
    }

    // ユニーク制約違反の場合は既にXPが付与されている可能性が高い
    // この場合は成功として扱う（重複付与を防ぐため）
    if (isUniqueConstraintError(result.error)) {
      console.warn(
        "XP付与でユニーク制約違反が発生しました（既にXPが付与されている可能性があります）:",
        { userId, missionId, achievementId, error: result.error },
      );
      // 既存のXPトランザクションを確認して、実際に付与されているかチェック
      // 新しいユニーク制約(user_id, source_type, source_id)に合わせてuser_idも含めてチェック
      const { data: existingTransaction } = await supabase
        .from("xp_transactions")
        .select("xp_amount")
        .eq("user_id", userId)
        .eq("source_type", "MISSION_COMPLETION")
        .eq("source_id", achievementId)
        .single();

      if (existingTransaction) {
        // 既にXPが付与されている場合は成功として扱う
        const { data: userLevel } = await supabase
          .from("user_levels")
          .select("*")
          .eq("user_id", userId)
          .single();

        return {
          success: true,
          userLevel: userLevel || undefined,
          xpGranted: existingTransaction.xp_amount,
        };
      }
    }

    // リトライ可能なエラーで、リトライ回数が上限に達していない場合
    if (isRetryableError(result.error) && retryCount < maxRetries) {
      const delayMs = Math.min(1000 * 2 ** retryCount, 5000); // 指数バックオフ（最大5秒）
      console.warn(
        `XP付与に失敗しました（リトライ可能）。${delayMs}ms後にリトライします（${retryCount + 1}/${maxRetries}）:`,
        result.error,
      );

      await new Promise((resolve) => setTimeout(resolve, delayMs));

      return grantMissionCompletionXp(
        userId,
        missionId,
        achievementId,
        retryCount + 1,
        maxRetries,
      );
    }

    // リトライ不可能なエラー、またはリトライ上限に達した場合
    // Sentryにエラーを送信
    await captureErrorToSentry(
      new Error(`XP付与に失敗しました: ${result.error}`),
      {
        userId,
        missionId,
        achievementId,
        xpToGrant,
        retryCount,
        maxRetries,
        errorMessage: result.error,
      },
    );

    return result;
  } catch (error) {
    // 予期しないエラーもリトライ可能かチェック
    if (isRetryableError(error) && retryCount < maxRetries) {
      const delayMs = Math.min(1000 * 2 ** retryCount, 5000);
      console.warn(
        `XP付与で予期しないエラーが発生（リトライ可能）。${delayMs}ms後にリトライします（${retryCount + 1}/${maxRetries}）:`,
        error,
      );

      await new Promise((resolve) => setTimeout(resolve, delayMs));

      return grantMissionCompletionXp(
        userId,
        missionId,
        achievementId,
        retryCount + 1,
        maxRetries,
      );
    }

    // 予期しないエラーをSentryに送信
    const errorMessage =
      error instanceof Error ? error.message : "予期しないエラーが発生しました";
    await captureErrorToSentry(
      error instanceof Error ? error : new Error(errorMessage),
      {
        userId,
        missionId,
        achievementId,
        retryCount,
        maxRetries,
      },
    );

    console.error("Error in grantMissionCompletionXp:", error);
    return { success: false, error: errorMessage };
  }
}

/**
 * バッチ処理用：複数のユーザーに一括でXPを付与する
 * N+1問題を回避し、パフォーマンスを最適化
 */
export async function grantXpBatch(
  transactions: Array<{
    userId: string;
    xpAmount: number;
    sourceType:
      | "MISSION_COMPLETION"
      | "BONUS"
      | "PENALTY"
      | "MISSION_CANCELLATION";
    sourceId?: string;
    description?: string;
  }>,
): Promise<{
  success: boolean;
  results: Array<{
    userId: string;
    success: boolean;
    error?: string;
    newXp?: number;
    newLevel?: number;
  }>;
  error?: string;
}> {
  const supabase = await createServiceClient();

  if (!transactions || transactions.length === 0) {
    return { success: true, results: [] };
  }

  try {
    // 1. 全てのユーザーIDを収集（重複排除）
    const userIdSet = new Set<string>();
    for (const transaction of transactions) {
      userIdSet.add(transaction.userId);
    }
    const userIds = Array.from(userIdSet);

    // 2. 現在のユーザーレベル情報を一括取得（チャンク分割）
    const { data: currentLevels, error: levelsError } =
      await executeChunkedQuery<UserLevel>(
        userIds,
        async (chunkIds) => {
          return await supabase
            .from("user_levels")
            .select("*")
            .in("user_id", chunkIds);
        },
        50,
      );

    if (levelsError) {
      console.error("Failed to fetch user levels:", levelsError);
      return { success: false, error: levelsError.message, results: [] };
    }

    // 3. 現在のレベル情報をMapに変換（高速検索のため）
    const levelMap = new Map(
      currentLevels?.map((level) => [level.user_id, level]) || [],
    );

    // 4. 存在しないユーザーのレベル情報を初期化
    const missingUserIds = userIds.filter((userId) => !levelMap.has(userId));

    if (missingUserIds.length > 0) {
      const { data: initializedLevels, error: initError } =
        await executeChunkedInsert(
          missingUserIds.map((userId) => ({
            user_id: userId,
            xp: 0,
            level: 1,
          })),
          async (chunk) => {
            return await supabase.from("user_levels").insert(chunk).select();
          },
          50,
        );

      if (initError) {
        console.error("Failed to initialize user levels:", initError);
        return { success: false, error: initError.message, results: [] };
      }

      // 初期化されたレベルをMapに追加
      for (const level of initializedLevels || []) {
        levelMap.set(level.user_id, level);
      }
    }

    // 5. XPトランザクションを一括挿入
    const xpTransactions = transactions.map((transaction) => ({
      user_id: transaction.userId,
      xp_amount: transaction.xpAmount,
      source_type: transaction.sourceType,
      source_id: transaction.sourceId,
      description:
        transaction.description || `${transaction.sourceType}による経験値獲得`,
    }));

    const { error: transactionError } = await executeChunkedInsert(
      xpTransactions,
      async (chunk) => {
        return await supabase.from("xp_transactions").insert(chunk);
      },
      50,
    );

    if (transactionError) {
      console.error("Failed to insert XP transactions:", transactionError);
      return { success: false, error: transactionError.message, results: [] };
    }

    // 6. ユーザーごとのXP合計を計算
    const userXpUpdates = new Map<string, number>();

    for (const transaction of transactions) {
      const currentTotal = userXpUpdates.get(transaction.userId) || 0;
      userXpUpdates.set(
        transaction.userId,
        currentTotal + transaction.xpAmount,
      );
    }

    // 7. ユーザーレベルを一括更新
    const levelUpdates: Array<{
      user_id: string;
      xp: number;
      level: number;
      updated_at: string;
    }> = [];

    const results: Array<{
      userId: string;
      success: boolean;
      error?: string;
      newXp?: number;
      newLevel?: number;
    }> = [];

    for (const [userId, xpChange] of Array.from(userXpUpdates.entries())) {
      const currentLevel = levelMap.get(userId);
      if (!currentLevel) {
        results.push({
          userId,
          success: false,
          error: "ユーザーレベル情報が見つかりません",
        });
        continue;
      }

      const newXp = currentLevel.xp + xpChange;
      const newLevel = calculateLevel(newXp);

      levelUpdates.push({
        user_id: userId,
        xp: newXp,
        level: newLevel,
        updated_at: new Date().toISOString(),
      });

      results.push({
        userId,
        success: true,
        newXp,
        newLevel,
      });
    }

    // 8. レベル情報を一括更新（upsert）
    if (levelUpdates.length > 0) {
      const { error: updateError } = await supabase
        .from("user_levels")
        .upsert(levelUpdates, {
          onConflict: "user_id",
        });

      if (updateError) {
        console.error("Failed to update user levels:", updateError);
        return { success: false, error: updateError.message, results: [] };
      }
    }

    return { success: true, results };
  } catch (error) {
    console.error("Error in grantXpBatch:", error);
    const errorMessage =
      error instanceof Error ? error.message : "予期しないエラーが発生しました";
    return { success: false, error: errorMessage, results: [] };
  }
}
