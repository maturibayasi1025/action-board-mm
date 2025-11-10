import "server-only";
import { createClient } from "@/lib/supabase/server";

/**
 * 現在のユーザーが経営者かどうかを判定する
 * 環境変数 OWNER_USER_IDS（カンマ区切り）または OWNER_EMAILS（カンマ区切り）で経営者を管理
 * @returns 経営者の場合 true、それ以外の場合 false
 */
export async function isOwner(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return false;
  }

  // 環境変数から経営者のユーザーIDを取得
  const ownerUserIds =
    process.env.OWNER_USER_IDS?.split(",").map((id) => id.trim()) ?? [];

  // 環境変数から経営者のメールアドレスを取得
  const ownerEmails =
    process.env.OWNER_EMAILS?.split(",").map((email) => email.trim()) ?? [];

  // ユーザーIDでチェック
  if (ownerUserIds.length > 0 && ownerUserIds.includes(user.id)) {
    return true;
  }

  // メールアドレスでチェック
  if (
    ownerEmails.length > 0 &&
    user.email &&
    ownerEmails.includes(user.email)
  ) {
    return true;
  }

  return false;
}

/**
 * 経営者権限チェック（エラーをthrowする版）
 * @throws Error 経営者でない場合
 */
export async function requireOwner(): Promise<void> {
  const owner = await isOwner();
  if (!owner) {
    throw new Error("経営者権限が必要です");
  }
}
