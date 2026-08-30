export const USER_DELETED_ERROR = "このアカウントは削除されています";

export function isDeletedAt(deletedAt: string | null | undefined): boolean {
  return deletedAt != null && deletedAt !== "";
}
