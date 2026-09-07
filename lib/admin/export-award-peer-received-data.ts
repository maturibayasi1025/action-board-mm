import {
  type PeerMasterQuestion,
  type PeerReceivedRow,
  type PeerResponseRow,
  type PeerSurveyRow,
  type PeerUserRow,
  aggregatePeerReceivedRows,
  buildPeerReceivedCsvContent,
  buildPeerReceivedDetailCsvContent,
  buildPeerReceivedDetailRows,
  collectPeerNominationEvents,
} from "@/lib/admin/export-award-peer-received";
import {
  type PrivateUserOrgRow,
  companyAndBusinessUnitFromPrivateUserRow,
} from "@/lib/admin/private-user-org";
import type { Database } from "@/lib/types/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

export type AwardPeerReceivedCollected = {
  surveys: PeerSurveyRow[];
  rows: PeerReceivedRow[];
  events: ReturnType<typeof collectPeerNominationEvents>;
  targetYearMonths: string[];
};

export type AwardPeerReceivedExportResult = {
  csvContent: string;
  filename: string;
  detailCsvContent: string;
  detailFilename: string;
  nomineeCount: number;
  nominationCount: number;
  targetYearMonths: string[];
};

async function fetchSurveys(
  supabase: SupabaseClient<Database>,
  yearMonths: string[],
): Promise<PeerSurveyRow[]> {
  const { data, error } = await supabase
    .from("award_surveys")
    .select("id, year_month, title")
    .in("year_month", yearMonths)
    .order("year_month", { ascending: true });

  if (error) {
    throw new Error(`アンケート取得に失敗しました: ${error.message}`);
  }

  const surveys = data ?? [];
  if (surveys.length === 0) {
    throw new Error("対象アンケートが見つかりません");
  }

  return surveys;
}

async function fetchQuestions(
  supabase: SupabaseClient<Database>,
): Promise<PeerMasterQuestion[]> {
  const { data, error } = await supabase
    .from("award_questions")
    .select(
      "id, question_text, question_type, question_group, display_order, is_active",
    )
    .order("display_order", { ascending: true });

  if (error) {
    throw new Error(`質問取得に失敗しました: ${error.message}`);
  }

  return (data ?? []) as PeerMasterQuestion[];
}

async function fetchResponses(
  supabase: SupabaseClient<Database>,
  surveyIds: string[],
): Promise<PeerResponseRow[]> {
  const { data, error } = await supabase
    .from("award_responses")
    .select(
      "survey_id, user_id, question_id, text_value, nominee_user_id, is_late_submission",
    )
    .in("survey_id", surveyIds);

  if (error) {
    throw new Error(`回答取得に失敗しました: ${error.message}`);
  }

  return (data ?? []) as PeerResponseRow[];
}

async function fetchUsers(
  supabase: SupabaseClient<Database>,
  userIds: string[],
): Promise<Map<string, PeerUserRow>> {
  if (userIds.length === 0) return new Map();

  const { data, error } = await supabase
    .from("private_users")
    .select(
      `
      id,
      name,
      suspended_at,
      business_units (
        name,
        companies (
          name
        )
      )
    `,
    )
    .in("id", userIds);

  if (error) {
    throw new Error(`ユーザー取得に失敗しました: ${error.message}`);
  }

  return new Map(
    (data ?? []).map((u) => {
      const { company_name, business_unit_name } =
        companyAndBusinessUnitFromPrivateUserRow(u as PrivateUserOrgRow);
      return [
        u.id,
        {
          id: u.id,
          name: u.name,
          companyName: company_name,
          businessUnitName: business_unit_name,
          suspended: Boolean(u.suspended_at),
        },
      ] as const;
    }),
  );
}

export async function collectAwardPeerReceivedData(
  supabase: SupabaseClient<Database>,
  yearMonths: string[],
): Promise<AwardPeerReceivedCollected> {
  const surveys = await fetchSurveys(supabase, yearMonths);
  const surveyIds = surveys.map((survey) => survey.id);

  const [questions, responses] = await Promise.all([
    fetchQuestions(supabase),
    fetchResponses(supabase, surveyIds),
  ]);

  const userIds = Array.from(
    new Set([
      ...responses.map((r) => r.user_id),
      ...responses
        .map((r) => r.nominee_user_id)
        .filter((id): id is string => id != null),
    ]),
  );
  const users = await fetchUsers(supabase, userIds);
  const events = collectPeerNominationEvents(
    surveys,
    questions,
    responses,
    users,
  );
  const rows = aggregatePeerReceivedRows(events, users);

  return {
    surveys,
    rows,
    events,
    targetYearMonths: surveys.map((survey) => survey.year_month),
  };
}

export async function buildAwardPeerReceivedCsv(
  supabase: SupabaseClient<Database>,
  yearMonths: string[],
  filenameLabel: string,
): Promise<AwardPeerReceivedExportResult> {
  const collected = await collectAwardPeerReceivedData(supabase, yearMonths);
  const detailRows = buildPeerReceivedDetailRows(collected.events);

  return {
    csvContent: buildPeerReceivedCsvContent(collected.rows),
    filename: `award-peer-received-${filenameLabel}.csv`,
    detailCsvContent: buildPeerReceivedDetailCsvContent(detailRows),
    detailFilename: `award-peer-received-detail-${filenameLabel}.csv`,
    nomineeCount: collected.rows.length,
    nominationCount: collected.events.length,
    targetYearMonths: collected.targetYearMonths,
  };
}
