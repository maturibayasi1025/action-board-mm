/**
 * Slack API users.list および表示名からのユーザーID解決（Incoming Webhook メンション等で共有）
 */

export type SlackUser = {
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

const LOG_PREFIX = "[Slack]";

/**
 * Slack APIの users.list を使用して全メンバーを取得
 */
export async function getSlackUsersList(): Promise<SlackUser[]> {
  const botToken = process.env.SLACK_BOT_TOKEN;
  if (!botToken) {
    console.warn(
      `${LOG_PREFIX} SLACK_BOT_TOKENが設定されていません。ユーザー情報を取得できません。`,
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
      console.error(`${LOG_PREFIX} Slack API エラー: ${response.status}`);
      return [];
    }

    const data = await response.json();
    if (!data.ok) {
      console.error(`${LOG_PREFIX} Slack API エラー: ${data.error}`);
      return [];
    }

    return data.members || [];
  } catch (error) {
    console.error(`${LOG_PREFIX} Slack API呼び出しエラー:`, error);
    return [];
  }
}

/**
 * アプリ側の表示名から Slack ユーザーIDを取得（部分一致、スペース除去）
 */
export function findSlackUserIdByName(
  userName: string,
  slackUsers: SlackUser[],
): string | null {
  if (!userName || slackUsers.length === 0) {
    return null;
  }

  const normalizedUserName = userName.trim().replace(/\s+/g, "").toLowerCase();
  if (!normalizedUserName) {
    return null;
  }

  for (const user of slackUsers) {
    if (user.id.startsWith("B") || user.is_bot || user.deleted === true) {
      continue;
    }

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
 * カンマ区切りの名前文字列をメンション形式に変換（グッジョブ通知用）
 */
export function formatPraisedNamesWithMentions(
  praisedNames: string,
  slackUsers: SlackUser[],
): string {
  if (!praisedNames || praisedNames.trim() === "") {
    return "";
  }

  const names = praisedNames
    .split(",")
    .map((name) => name.trim())
    .filter((name) => name.length > 0);
  const formattedNames: string[] = [];

  for (const name of names) {
    if (!name || name.trim() === "") continue;

    const slackUserId = findSlackUserIdByName(name.trim(), slackUsers);
    if (slackUserId) {
      formattedNames.push(`<@${slackUserId}>`);
    } else {
      formattedNames.push(name.trim());
    }
  }

  return formattedNames.join(", ");
}

export type ResolveNamesResult = {
  /** メンションをスペース区切りで連結 */
  mentionText: string;
  unmatchedNames: string[];
};

/**
 * 名前の配列を Slack メンションに解決
 */
export function resolvePrivateUserNamesToMentions(
  names: string[],
  slackUsers: SlackUser[],
): ResolveNamesResult {
  const mentionParts: string[] = [];
  const unmatchedNames: string[] = [];

  for (const raw of names) {
    const name = raw.trim();
    if (!name) continue;
    const slackUserId = findSlackUserIdByName(name, slackUsers);
    if (slackUserId) {
      mentionParts.push(`<@${slackUserId}>`);
    } else {
      unmatchedNames.push(name);
    }
  }

  return {
    mentionText: mentionParts.join(" "),
    unmatchedNames,
  };
}
