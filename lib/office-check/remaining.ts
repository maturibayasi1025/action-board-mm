export type PresenceEvent = {
  userId: string;
  at: string;
};

/**
 * 当日の入室・退室から、いま在室中のユーザー ID を返す。
 * 同一ユーザーは「最後の入室が入室側の最新」かつ「それより後の退室がない」場合に在室。
 */
export function remainingUserIds(
  checkins: PresenceEvent[],
  leaves: PresenceEvent[],
): string[] {
  const latestCheckin = new Map<string, string>();
  for (const event of checkins) {
    const previous = latestCheckin.get(event.userId);
    if (!previous || event.at > previous) {
      latestCheckin.set(event.userId, event.at);
    }
  }

  const latestLeave = new Map<string, string>();
  for (const event of leaves) {
    const previous = latestLeave.get(event.userId);
    if (!previous || event.at > previous) {
      latestLeave.set(event.userId, event.at);
    }
  }

  const remaining: string[] = [];
  for (const [userId, checkedInAt] of latestCheckin) {
    const leftAt = latestLeave.get(userId);
    if (!leftAt || checkedInAt > leftAt) {
      remaining.push(userId);
    }
  }
  return remaining;
}

export function formatRemainingNames(names: string[]): string {
  if (names.length === 0) {
    return "なし（全員退室）";
  }
  return `${names.join("、")}（${names.length}名）`;
}
