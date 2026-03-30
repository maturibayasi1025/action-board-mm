import type { Database } from "@/lib/types/supabase";
import { findBestMatch } from "@/lib/utils/fuzzyMatch";
import type { SupabaseClient } from "@supabase/supabase-js";

function normalizeComparableName(s: string): string {
  return s.trim().replace(/\s+/g, "").toLowerCase();
}

/**
 * Slack 側の表示名と private_users.name のあいまい一致（Levenshtein 類似度 0.7 以上）
 */
export async function findPrivateUserByFuzzyName(
  slackUserName: string,
  supabase: SupabaseClient<Database>,
): Promise<string | null> {
  const { data: users, error } = await supabase
    .from("private_users")
    .select("id, name");

  if (error || !users) {
    console.error("ユーザー取得エラー:", error);
    return null;
  }

  const match = findBestMatch(
    slackUserName,
    users.map((u) => ({ text: u.name, data: u.id })),
    0.7,
  );

  if (match) {
    console.log(
      `ユーザー名マッチング: "${slackUserName}" → "${match.text}" (類似度: ${(match.similarity * 100).toFixed(1)}%)`,
    );
    return match.data;
  }

  return null;
}

function findPrivateUserBySubstringSymmetric(
  slackDisplayName: string,
  users: Array<{ id: string; name: string }>,
): string | null {
  const slackNorm = normalizeComparableName(slackDisplayName);
  if (slackNorm.length < 2) {
    return null;
  }

  for (const u of users) {
    const n = normalizeComparableName(u.name);
    if (n.length < 2) {
      continue;
    }
    if (slackNorm.includes(n) || n.includes(slackNorm)) {
      return u.id;
    }
  }
  return null;
}

/**
 * メンション先の Slack User ID と表示名から private_users.id を解決。
 * 1) slack_user_id 一致 2) あいまい一致 3) 正規化後の部分一致（双方向）
 */
export async function findPrivateUserIdForSlackMention(
  slackUserId: string,
  slackDisplayName: string,
  supabase: SupabaseClient<Database>,
): Promise<string | null> {
  const { data: bySlack } = await supabase
    .from("private_users")
    .select("id")
    .eq("slack_user_id", slackUserId)
    .maybeSingle();

  if (bySlack?.id) {
    return bySlack.id;
  }

  const fuzzy = await findPrivateUserByFuzzyName(slackDisplayName, supabase);
  if (fuzzy) {
    return fuzzy;
  }

  const { data: users, error } = await supabase
    .from("private_users")
    .select("id, name");

  if (error || !users) {
    return null;
  }

  const sub = findPrivateUserBySubstringSymmetric(slackDisplayName, users);
  if (sub) {
    console.log(`ユーザー名部分一致: "${slackDisplayName}"`);
  }
  return sub;
}

/**
 * 解決できた Slack メンバー ID を private_users に保存（NULL のときのみ）
 */
export async function ensureSlackUserIdStored(
  supabase: SupabaseClient<Database>,
  privateUserId: string,
  slackUserId: string,
): Promise<void> {
  const { data: row, error } = await supabase
    .from("private_users")
    .select("slack_user_id")
    .eq("id", privateUserId)
    .maybeSingle();

  if (error || !row) {
    console.error("ensureSlackUserIdStored: ユーザー取得エラー", error);
    return;
  }

  if (row.slack_user_id === slackUserId) {
    return;
  }

  if (row.slack_user_id === null) {
    const { error: updateError } = await supabase
      .from("private_users")
      .update({ slack_user_id: slackUserId })
      .eq("id", privateUserId)
      .is("slack_user_id", null);

    if (updateError) {
      console.error("ensureSlackUserIdStored: 更新エラー", updateError);
    }
    return;
  }

  if (row.slack_user_id !== slackUserId) {
    console.warn(
      `ensureSlackUserIdStored: 既存の slack_user_id が異なります (user=${privateUserId}): ${row.slack_user_id} vs ${slackUserId}`,
    );
  }
}
