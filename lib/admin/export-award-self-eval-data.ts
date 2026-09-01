import {
  SELF_EVAL_QUESTION_IDS,
  type SurveyRow,
  VALUE_LABELS,
  VALUE_ORDER,
  buildCsvContent,
  buildMonthRangeLabel,
  buildValueCell,
} from "@/lib/admin/export-award-self-eval";
import {
  type PrivateUserOrgRow,
  companyAndBusinessUnitFromPrivateUserRow,
} from "@/lib/admin/private-user-org";
import { fetchAllRows, fetchByIdChunks } from "@/lib/supabase/fetch-all-rows";
import type { Database } from "@/lib/types/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

type ResponseRow = {
  user_id: string;
  survey_id: string;
  question_id: string;
  text_value: string | null;
};

type UserRow = {
  id: string;
  name: string;
  company_name: string;
  business_unit_name: string;
};

export type AwardSelfEvalExportResult = {
  csvContent: string;
  filename: string;
  responderCount: number;
  responseCount: number;
  targetYearMonths: string[];
};

async function fetchSurveys(
  supabase: SupabaseClient<Database>,
  yearMonths: string[] | null,
): Promise<SurveyRow[]> {
  let query = supabase
    .from("award_surveys")
    .select("id, year_month, title")
    .order("year_month", { ascending: true });

  if (yearMonths) {
    query = query.in("year_month", yearMonths);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`アンケート取得に失敗しました: ${error.message}`);
  }

  const surveys = data ?? [];
  if (surveys.length === 0) {
    throw new Error("対象アンケートが見つかりません");
  }

  return surveys;
}

async function fetchSelfEvalResponses(
  supabase: SupabaseClient<Database>,
  surveyIds: string[],
): Promise<ResponseRow[]> {
  const questionIds = Object.values(SELF_EVAL_QUESTION_IDS);
  const rows = await fetchAllRows<ResponseRow>((from, to) =>
    supabase
      .from("award_responses")
      .select("user_id, survey_id, question_id, text_value")
      .in("survey_id", surveyIds)
      .in("question_id", questionIds)
      .range(from, to),
  );

  return rows.filter((r) => r.text_value?.trim());
}

async function fetchUsers(
  supabase: SupabaseClient<Database>,
  userIds: string[],
): Promise<Map<string, UserRow>> {
  if (userIds.length === 0) return new Map();

  const rows = await fetchByIdChunks<
    PrivateUserOrgRow & { id: string; name: string }
  >(userIds, (chunk) =>
    supabase
      .from("private_users")
      .select(
        `
      id,
      name,
      business_units (
        name,
        companies (
          name
        )
      )
    `,
      )
      .in("id", chunk),
  );

  return new Map(
    rows.map((u) => {
      const { company_name, business_unit_name } =
        companyAndBusinessUnitFromPrivateUserRow(u as PrivateUserOrgRow);
      return [
        u.id,
        {
          id: u.id,
          name: u.name,
          company_name,
          business_unit_name,
        },
      ] as const;
    }),
  );
}

export async function buildAwardSelfEvalCsv(
  supabase: SupabaseClient<Database>,
  yearMonths: string[] | null,
): Promise<AwardSelfEvalExportResult> {
  const surveys = await fetchSurveys(supabase, yearMonths);
  const surveyIds = surveys.map((s) => s.id);
  const surveyIdToYearMonth = new Map(surveys.map((s) => [s.id, s.year_month]));

  const responses = await fetchSelfEvalResponses(supabase, surveyIds);
  const userIds = Array.from(new Set(responses.map((r) => r.user_id)));
  const userMap = await fetchUsers(supabase, userIds);

  const responseIndex = new Map<string, string>();
  for (const r of responses) {
    const text = r.text_value?.trim();
    if (!text) continue;
    responseIndex.set(`${r.user_id}:${r.survey_id}:${r.question_id}`, text);
  }

  const sortedUserIds = [...userIds].sort((a, b) => {
    const nameA = userMap.get(a)?.name ?? "";
    const nameB = userMap.get(b)?.name ?? "";
    return nameA.localeCompare(nameB, "ja");
  });

  const headers = [
    "氏名",
    "会社",
    "部署",
    ...VALUE_ORDER.map((key) => VALUE_LABELS[key]),
  ];

  const dataRows = sortedUserIds.map((userId) => {
    const user = userMap.get(userId);
    return [
      user?.name ?? "不明",
      user?.company_name ?? "",
      user?.business_unit_name ?? "",
      ...VALUE_ORDER.map((valueKey) =>
        buildValueCell(
          userId,
          valueKey,
          surveys,
          surveyIdToYearMonth,
          responseIndex,
        ),
      ),
    ];
  });

  const monthRange = buildMonthRangeLabel(surveys);

  return {
    csvContent: buildCsvContent(headers, dataRows),
    filename: `award-self-eval-${monthRange}.csv`,
    responderCount: sortedUserIds.length,
    responseCount: responses.length,
    targetYearMonths: surveys.map((s) => s.year_month),
  };
}
