import "server-only";

import { createServiceClient } from "@/lib/supabase/server";
import { USER_DELETED_ERROR, isDeletedAt } from "@/lib/utils/user-status";

export { USER_DELETED_ERROR, isDeletedAt } from "@/lib/utils/user-status";

export async function getUserDeletedAt(userId: string): Promise<string | null> {
  const supabase = await createServiceClient();
  const { data } = await supabase
    .from("private_users")
    .select("deleted_at")
    .eq("id", userId)
    .maybeSingle();
  return data?.deleted_at ?? null;
}

export async function assertUserNotDeleted(userId: string): Promise<void> {
  if (isDeletedAt(await getUserDeletedAt(userId))) {
    throw new Error(USER_DELETED_ERROR);
  }
}
