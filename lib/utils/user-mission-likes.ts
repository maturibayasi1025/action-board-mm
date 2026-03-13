export const LIKE_AVAILABLE_DAYS = 7;

const DAY_IN_MS = 24 * 60 * 60 * 1000;

export function isLikeExpired(
  publishedAt: string | null,
  now = new Date(),
): boolean {
  if (!publishedAt) {
    return false;
  }

  const publishedAtDate = new Date(publishedAt);
  if (Number.isNaN(publishedAtDate.getTime())) {
    return false;
  }

  const likeWindowMs = LIKE_AVAILABLE_DAYS * DAY_IN_MS;
  return now.getTime() - publishedAtDate.getTime() > likeWindowMs;
}
