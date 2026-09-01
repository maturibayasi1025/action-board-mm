import { fetchAllRows, fetchByIdChunks } from "@/lib/supabase/fetch-all-rows";
import type { Database } from "@/lib/types/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

type AwardDb = SupabaseClient<Database>;

type PageResult<T> = {
  data: T[] | null;
  error: { message: string } | null;
};

async function asPageResult<T>(
  query: PromiseLike<{
    data: unknown;
    error: { message: string } | null;
  }>,
): Promise<PageResult<T>> {
  const { data, error } = await query;
  return {
    data: (data as T[] | null) ?? null,
    error,
  };
}

export const AWARD_RANKING_RESPONSE_COLUMNS =
  "survey_id, question_id, user_id, text_value, nominee_user_id, is_late_submission";

export async function countAwardResponses(
  supabase: AwardDb,
  surveyIds: string[],
): Promise<number | null> {
  if (surveyIds.length === 0) {
    return 0;
  }

  let query = supabase
    .from("award_responses")
    .select("id", { count: "exact", head: true });
  query =
    surveyIds.length === 1
      ? query.eq("survey_id", surveyIds[0])
      : query.in("survey_id", surveyIds);

  const { count, error } = await query;
  if (error) {
    throw new Error(error.message);
  }
  return count;
}

export async function fetchAllAwardResponses<T>(
  supabase: AwardDb,
  surveyIds: string[],
  columns: string,
): Promise<T[]> {
  if (surveyIds.length === 0) {
    return [];
  }

  // range ページングは id で安定させないと、同一 created_at の提出が欠けたり重複したりする
  if (surveyIds.length === 1) {
    return fetchAllRows<T>((from, to) =>
      asPageResult<T>(
        supabase
          .from("award_responses")
          .select(columns)
          .eq("survey_id", surveyIds[0])
          .order("id", { ascending: true })
          .range(from, to),
      ),
    );
  }

  return fetchAllRows<T>((from, to) =>
    asPageResult<T>(
      supabase
        .from("award_responses")
        .select(columns)
        .in("survey_id", surveyIds)
        .order("id", { ascending: true })
        .range(from, to),
    ),
  );
}

export async function fetchAwardResponsesForSurvey<T>(
  supabase: AwardDb,
  surveyId: string,
  columns: string,
  options?: { orderByCreatedAtDesc?: boolean },
): Promise<T[]> {
  return fetchAllRows<T>((from, to) => {
    const query = supabase
      .from("award_responses")
      .select(columns)
      .eq("survey_id", surveyId);
    const ordered = options?.orderByCreatedAtDesc
      ? query
          .order("created_at", { ascending: false })
          .order("id", { ascending: false })
      : query.order("id", { ascending: true });
    return asPageResult<T>(ordered.range(from, to));
  });
}

export async function fetchAllPrivateUserNames(
  supabase: AwardDb,
): Promise<Map<string, string>> {
  const rows = await fetchAllRows<{ id: string; name: string }>((from, to) =>
    supabase
      .from("private_users")
      .select("id, name")
      .order("id", { ascending: true })
      .range(from, to),
  );
  return new Map(rows.map((row) => [row.id, row.name]));
}

export async function fetchPrivateUsersByIds<T>(
  supabase: AwardDb,
  userIds: string[],
  columns: string,
): Promise<T[]> {
  if (userIds.length === 0) {
    return [];
  }
  return fetchByIdChunks<T>(userIds, (chunk) =>
    asPageResult<T>(
      supabase.from("private_users").select(columns).in("id", chunk),
    ),
  );
}
