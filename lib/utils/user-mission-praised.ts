/**
 * ユーザーグッジョブの賞賛対象から作成者自身を除外する。
 * 作成者は自分自身を「賞賛されたメンバー」として登録できない。
 */
export function excludeCreatorFromPraisedUserIds(
  praisedUserIds: string[],
  creatorId: string,
): string[] {
  return praisedUserIds.filter((id) => id.length > 0 && id !== creatorId);
}
