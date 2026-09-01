import "server-only";

import { createServiceClient } from "@/lib/supabase/server";
import { USER_SUSPENDED_ERROR, isSuspendedAt } from "@/lib/utils/user-status";

export { USER_SUSPENDED_ERROR, isSuspendedAt } from "@/lib/utils/user-status";

export async function getUserSuspendedAt(
  userId: string,
): Promise<string | null> {
  const supabase = await createServiceClient();
  const { data } = await supabase
    .from("private_users")
    .select("suspended_at")
    .eq("id", userId)
    .maybeSingle();
  return data?.suspended_at ?? null;
}

export async function isSuspendedUser(userId: string): Promise<boolean> {
  return isSuspendedAt(await getUserSuspendedAt(userId));
}

export async function assertUserActive(userId: string): Promise<void> {
  if (await isSuspendedUser(userId)) {
    throw new Error(USER_SUSPENDED_ERROR);
  }
}

export async function filterActiveUserIds(
  userIds: string[],
): Promise<Set<string>> {
  if (userIds.length === 0) {
    return new Set();
  }
  const supabase = await createServiceClient();
  const { data } = await supabase
    .from("private_users")
    .select("id")
    .in("id", userIds)
    .is("suspended_at", null);
  return new Set((data ?? []).map((row) => row.id));
}
