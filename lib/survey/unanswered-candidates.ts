import type { Database } from "@/lib/types/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

export type PrivateUserRow = { id: string; name: string };

export async function fetchGlobalExcludedUserIds(
  supabase: SupabaseClient<Database>,
): Promise<Set<string>> {
  const { data } = await supabase
    .from("unanswered_survey_global_exclusions")
    .select("user_id");

  return new Set((data ?? []).map((r) => r.user_id));
}

export function filterUnansweredPrivateUsers(
  allUsers: PrivateUserRow[],
  answeredUserIds: Set<string>,
  excludedUserIds: Set<string>,
): PrivateUserRow[] {
  return allUsers.filter(
    (u) => !answeredUserIds.has(u.id) && !excludedUserIds.has(u.id),
  );
}
