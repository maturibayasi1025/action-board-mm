export const USER_SUSPENDED_ERROR = "このアカウントは停止されています";

export function isSuspendedAt(suspendedAt: string | null | undefined): boolean {
  return suspendedAt != null;
}

export function filterActiveBySuspendedAt<
  T extends { suspended_at?: string | null },
>(rows: T[]): T[] {
  return rows.filter((row) => !isSuspendedAt(row.suspended_at));
}
