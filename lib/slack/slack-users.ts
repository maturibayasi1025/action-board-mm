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

/** Slack users.list の1リクエストあたりの最大件数（公式上限 1000、ここではページングの粒度として 200 を使用） */
const USERS_LIST_PAGE_LIMIT = 200;

/** 無限ループ防止（異常時のフェイルセーフ） */
const USERS_LIST_MAX_PAGES = 500;

type SlackUsersListResponse = {
  ok: boolean;
  error?: string;
  members?: SlackUser[];
  response_metadata?: { next_cursor?: string };
};

/**
 * Slack APIの users.list をカーソルページングで全メンバー取得
 */
export async function getSlackUsersList(): Promise<SlackUser[]> {
  const botToken = process.env.SLACK_BOT_TOKEN;
  if (!botToken) {
    console.warn(
      `${LOG_PREFIX} SLACK_BOT_TOKENが設定されていません。ユーザー情報を取得できません。`,
    );
    return [];
  }

  const allMembers: SlackUser[] = [];

  try {
    let cursor: string | undefined;
    for (let page = 0; page < USERS_LIST_MAX_PAGES; page++) {
      const url = new URL("https://slack.com/api/users.list");
      url.searchParams.set("limit", String(USERS_LIST_PAGE_LIMIT));
      if (cursor) {
        url.searchParams.set("cursor", cursor);
      }

      const response = await fetch(url.toString(), {
        method: "GET",
        headers: {
          Authorization: `Bearer ${botToken}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        console.error(`${LOG_PREFIX} Slack API エラー: ${response.status}`);
        return allMembers.length > 0 ? allMembers : [];
      }

      const data = (await response.json()) as SlackUsersListResponse;
      if (!data.ok) {
        console.error(`${LOG_PREFIX} Slack API エラー: ${data.error}`);
        return allMembers.length > 0 ? allMembers : [];
      }

      const members = data.members;
      if (members?.length) {
        allMembers.push(...members);
      }

      const next = data.response_metadata?.next_cursor;
      if (!next) {
        break;
      }
      cursor = next;
    }
  } catch (error) {
    console.error(`${LOG_PREFIX} Slack API呼び出しエラー:`, error);
    return allMembers.length > 0 ? allMembers : [];
  }

  return allMembers;
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

/** グッジョブ Slack 通知用: DB の slack_user_id を優先し、無い場合のみ名前で解決 */
export function buildPraisedMentionsLine(
  internalUsers: Array<{ name: string; slack_user_id: string | null }>,
  externalNames: string[],
  slackUsers: SlackUser[],
): string {
  const parts: string[] = [];

  for (const u of internalUsers) {
    if (u.slack_user_id) {
      parts.push(`<@${u.slack_user_id}>`);
    } else {
      const single = formatPraisedNamesWithMentions(u.name, slackUsers);
      if (single) parts.push(single);
    }
  }

  for (const ext of externalNames) {
    const formatted = formatPraisedNamesWithMentions(ext, slackUsers);
    if (formatted) parts.push(formatted);
  }

  return parts.join(", ");
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
