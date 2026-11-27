import { fetchAllRows } from "@/lib/supabase/fetch-all-rows";
import type { Database } from "@/lib/types/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

export type PrivateUserRow = { id: string; name: string };

export type SurveyResponseTable = "enps_responses" | "award_responses";

export async function fetchGlobalExcludedUserIds(
  supabase: SupabaseClient<Database>,
): Promise<Set<string>> {
  const rows = await fetchAllRows<{ user_id: string }>((from, to) =>
    supabase
      .from("unanswered_survey_global_exclusions")
      .select("user_id")
      .order("user_id", { ascending: true })
      .range(from, to),
  );

  return new Set(rows.map((r) => r.user_id));
}

function filterUnansweredPrivateUsers(
  allUsers: PrivateUserRow[],
  answeredUserIds: Set<string>,
  excludedUserIds: Set<string>,
): PrivateUserRow[] {
  return allUsers.filter(
    (u) => !answeredUserIds.has(u.id) && !excludedUserIds.has(u.id),
  );
}

/**
 * 休止中でもグローバル除外でもなく、指定アンケートに1件も回答していないユーザー。
 * 回答・ユーザー・除外はいずれも 1000 行を超えうるため全件取得する。
 */
export async function fetchUnansweredPrivateUsers(
  supabase: SupabaseClient<Database>,
  table: SurveyResponseTable,
  surveyId: string,
  options?: { orderByName?: boolean },
): Promise<PrivateUserRow[]> {
  const [answeredRows, excludedUserIds, allUsers] = await Promise.all([
    fetchAllRows<{ user_id: string }>((from, to) =>
      supabase
        .from(table)
        .select("user_id")
        .eq("survey_id", surveyId)
        .order("id", { ascending: true })
        .range(from, to),
    ),
    fetchGlobalExcludedUserIds(supabase),
    fetchAllRows<PrivateUserRow>((from, to) => {
      const query = supabase
        .from("private_users")
        .select("id, name")
        .is("suspended_at", null);
      const ordered = options?.orderByName
        ? query
            .order("name", { ascending: true })
            .order("id", { ascending: true })
        : query.order("id", { ascending: true });
      return ordered.range(from, to);
    }),
  ]);

  return filterUnansweredPrivateUsers(
    allUsers,
    new Set(answeredRows.map((r) => r.user_id)),
    excludedUserIds,
  );
}
