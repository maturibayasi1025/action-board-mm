/**
 * eNPS 集計で使うクエリ。行上限とURL長の制約を必ず通すため、直接 supabase を叩かずここを経由する。
 * Supabase クライアントを引数で受け取るので、画面（サービスロール）とバッチスクリプトの両方から使える。
 */

import {
  type EnpsSnapshotTarget,
  UNASSIGNED_ORG_LABEL,
} from "@/lib/admin/enps-report/build-snapshot";
import {
  fetchAllRows,
  fetchByIdChunks,
} from "@/lib/admin/enps-report/fetch-all";
import {
  type PrivateUserOrgRow,
  companyAndBusinessUnitFromPrivateUserRow,
} from "@/lib/admin/private-user-org";
import type { Database } from "@/lib/types/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

export const PRIVATE_USER_ORG_SELECT = `
  id,
  name,
  business_units (
    name,
    display_order,
    companies (
      name,
      display_order
    )
  )
`;

export type UserOrgInfo = {
  name: string;
  company_name: string;
  business_unit_name: string;
};

export async function fetchExcludedUserIds(
  supabase: SupabaseClient<Database>,
): Promise<Set<string>> {
  const rows = await fetchAllRows<{ user_id: string }>((from, to) =>
    supabase
      .from("unanswered_survey_global_exclusions")
      .select("user_id")
      .range(from, to),
  );
  return new Set(rows.map((r) => r.user_id));
}

export async function fetchAllPrivateUserIds(
  supabase: SupabaseClient<Database>,
): Promise<string[]> {
  const rows = await fetchAllRows<{ id: string }>((from, to) =>
    supabase.from("private_users").select("id").range(from, to),
  );
  return rows.map((r) => r.id);
}

export async function fetchOrgMapForUserIds(
  supabase: SupabaseClient<Database>,
  userIds: string[],
): Promise<Map<string, UserOrgInfo>> {
  const map = new Map<string, UserOrgInfo>();
  if (userIds.length === 0) {
    return map;
  }

  const rows = await fetchByIdChunks<PrivateUserOrgRow>(userIds, (chunk) =>
    supabase
      .from("private_users")
      .select(PRIVATE_USER_ORG_SELECT)
      .in("id", chunk),
  );

  for (const row of rows) {
    const { company_name, business_unit_name } =
      companyAndBusinessUnitFromPrivateUserRow(row);
    map.set(row.id, {
      name: row.name?.trim() ?? "",
      company_name,
      business_unit_name,
    });
  }
  return map;
}

/**
 * スナップショット集計の母数。グローバル除外のユーザーは対象から外す。
 */
export async function fetchSnapshotTargets(
  supabase: SupabaseClient<Database>,
): Promise<EnpsSnapshotTarget[]> {
  const [allIds, excluded] = await Promise.all([
    fetchAllPrivateUserIds(supabase),
    fetchExcludedUserIds(supabase),
  ]);
  const eligibleIds = allIds.filter((id) => !excluded.has(id));
  const orgMap = await fetchOrgMapForUserIds(supabase, eligibleIds);

  return eligibleIds.map((id) => {
    const org = orgMap.get(id);
    return {
      user_id: id,
      company_name: org?.company_name || UNASSIGNED_ORG_LABEL,
      business_unit_name: org?.business_unit_name || UNASSIGNED_ORG_LABEL,
    };
  });
}

export type ScoreResponseRow = {
  question_id: string;
  user_id: string;
  score_value: number | null;
  is_late_submission: boolean | null;
  created_at: string;
};

export async function fetchScoreResponsesForSurvey(
  supabase: SupabaseClient<Database>,
  surveyId: string,
): Promise<ScoreResponseRow[]> {
  return fetchAllRows<ScoreResponseRow>((from, to) =>
    supabase
      .from("enps_responses")
      .select(
        "question_id, user_id, score_value, is_late_submission, created_at",
      )
      .eq("survey_id", surveyId)
      .not("score_value", "is", null)
      .range(from, to),
  );
}

export type TextResponseRow = {
  question_id: string;
  user_id: string;
  text_value: string | null;
  is_late_submission: boolean | null;
  created_at: string;
};

export async function fetchTextResponsesForSurvey(
  supabase: SupabaseClient<Database>,
  surveyId: string,
): Promise<TextResponseRow[]> {
  return fetchAllRows<TextResponseRow>((from, to) =>
    supabase
      .from("enps_responses")
      .select(
        "question_id, user_id, text_value, is_late_submission, created_at",
      )
      .eq("survey_id", surveyId)
      .not("text_value", "is", null)
      .range(from, to),
  );
}
