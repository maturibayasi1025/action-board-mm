import {
  AWARD_QUESTION_GROUP_LABELS,
  type AwardQuarter,
  yearMonthKeysForQuarter,
} from "@/app/(protected)/admin/award-surveys/quarterly-ranking-model";
import {
  buildAwardNominationGroups,
  emptyAwardNominationGroups,
  fiscalPeriodFromYearMonth,
  labelForAwardQuarter,
} from "@/lib/mcp/award-nomination-ranking";
import { McpToolError } from "@/lib/mcp/errors";
import { fetchAllRows } from "@/lib/supabase/fetch-all-rows";
import {
  type SurveyExportAnswer,
  type SurveyExportQuestion,
  buildSurveyResponsesCsv,
  surveyResponsesCsvFilename,
  surveyResponsesCsvText,
} from "@/lib/survey/export-responses-csv";
import type { Database } from "@/lib/types/supabase";
import { type SupabaseClient, createClient } from "@supabase/supabase-js";

type PrivilegedDb = SupabaseClient<Database>;

export const PRIVATE_USERS_SLACK_SELECT = "id, slack_user_id";
export const PUBLIC_PROFILE_NAME_SELECT = "id, name";
export const PUBLIC_PROFILE_ORG_SELECT = "id, name, business_unit_id";
export const BUSINESS_UNIT_NAME_SELECT = "id, name, company_id";
export const COMPANY_NAME_SELECT = "id, name";
export const ENPS_SURVEY_SELECT =
  "id, title, description, year_month, start_date, end_date, is_active, created_at";
export const ENPS_QUESTION_SELECT =
  "id, question_text, question_type, display_order, is_active, is_required, parent_question_id";
export const ENPS_SNAPSHOT_SELECT =
  "id, survey_id, question_id, scope, company_name, business_unit_name, target_count, respondent_count, promoters, passives, detractors, nps_respondent_base, nps_imputed_base, computed_at";
export const ENPS_RESPONSE_SELECT =
  "id, survey_id, question_id, user_id, score_value, text_value, is_late_submission, created_at";
export const AWARD_SURVEY_SELECT =
  "id, title, year_month, start_date, end_date";
export const AWARD_QUESTION_SELECT =
  "id, question_text, question_type, question_group, display_order, is_active";
export const AWARD_RESPONSE_SELECT =
  "id, survey_id, question_id, user_id, nominee_user_id, text_value, is_late_submission, created_at";
export const AWARD_RANKING_RESPONSE_SELECT =
  "question_id, text_value, nominee_user_id";

const YEAR_MONTH_RE = /^\d{4}-\d{2}$/;
const GROUP_RE = /^[^,()"]{1,80}$/;

function createPrivilegedDb(): PrivilegedDb {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new McpToolError(
      "Privileged MCP queries are not configured",
      "query_failed",
    );
  }
  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        "X-Client-Info": "action-board-mcp-privileged",
      },
    },
  });
}

function throwIfError(
  error: { message: string } | null,
  message: string,
): void {
  if (error) {
    throw new McpToolError(`${message}: ${error.message}`);
  }
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

function escapeIlike(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

async function mapPublicNames(
  db: PrivilegedDb,
  ids: string[],
): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  const unique = [...new Set(ids.filter((id) => id.length > 0))];
  for (const batch of chunk(unique, 200)) {
    const { data, error } = await db
      .from("public_user_profiles")
      .select(PUBLIC_PROFILE_NAME_SELECT)
      .in("id", batch);
    throwIfError(error, "公開名の取得に失敗しました");
    for (const row of data ?? []) {
      names.set(row.id, row.name);
    }
  }
  return names;
}

async function mapPublicOrgs(
  db: PrivilegedDb,
  ids: string[],
): Promise<
  Map<
    string,
    { name: string; company_name: string; business_unit_name: string }
  >
> {
  const orgs = new Map<
    string,
    { name: string; company_name: string; business_unit_name: string }
  >();
  const unique = [...new Set(ids.filter((id) => id.length > 0))];
  if (unique.length === 0) {
    return orgs;
  }

  const profiles: Array<{
    id: string;
    name: string;
    business_unit_id: string | null;
  }> = [];
  for (const batch of chunk(unique, 200)) {
    const { data, error } = await db
      .from("public_user_profiles")
      .select(PUBLIC_PROFILE_ORG_SELECT)
      .in("id", batch);
    throwIfError(error, "公開プロフィールの取得に失敗しました");
    profiles.push(...(data ?? []));
  }

  const unitIds = [
    ...new Set(
      profiles
        .map((row) => row.business_unit_id)
        .filter((id): id is string => typeof id === "string" && id.length > 0),
    ),
  ];
  const units = new Map<string, { name: string; company_id: string }>();
  for (const batch of chunk(unitIds, 200)) {
    const { data, error } = await db
      .from("business_units")
      .select(BUSINESS_UNIT_NAME_SELECT)
      .in("id", batch);
    throwIfError(error, "部署名の取得に失敗しました");
    for (const unit of data ?? []) {
      units.set(unit.id, { name: unit.name, company_id: unit.company_id });
    }
  }

  const companyIds = [
    ...new Set([...units.values()].map((unit) => unit.company_id)),
  ];
  const companies = new Map<string, string>();
  for (const batch of chunk(companyIds, 200)) {
    const { data, error } = await db
      .from("companies")
      .select(COMPANY_NAME_SELECT)
      .in("id", batch);
    throwIfError(error, "会社名の取得に失敗しました");
    for (const company of data ?? []) {
      companies.set(company.id, company.name);
    }
  }

  for (const profile of profiles) {
    const unit = profile.business_unit_id
      ? units.get(profile.business_unit_id)
      : undefined;
    orgs.set(profile.id, {
      name: profile.name,
      company_name: unit ? (companies.get(unit.company_id) ?? "") : "",
      business_unit_name: unit?.name ?? "",
    });
  }
  return orgs;
}

export async function listSlackIdsByUserIds(
  userIds: string[],
): Promise<Map<string, string | null>> {
  const db = createPrivilegedDb();
  return mapSlackIds(db, userIds);
}

async function mapSlackIds(
  db: PrivilegedDb,
  ids: string[],
): Promise<Map<string, string | null>> {
  const slackIds = new Map<string, string | null>();
  const unique = [...new Set(ids.filter((id) => id.length > 0))];
  for (const batch of chunk(unique, 200)) {
    const { data, error } = await db
      .from("private_users")
      .select(PRIVATE_USERS_SLACK_SELECT)
      .in("id", batch)
      .is("suspended_at", null);
    throwIfError(error, "Slack ID の取得に失敗しました");
    for (const row of data ?? []) {
      slackIds.set(row.id, row.slack_user_id);
    }
  }
  return slackIds;
}

export type EnpsSurveyRow = {
  id: string;
  title: string;
  description: string | null;
  year_month: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  created_at: string;
};

export type EnpsQuestionRow = {
  id: string;
  question_text: string;
  question_type: string;
  display_order: number;
  is_active: boolean;
  is_required: boolean;
  parent_question_id: string | null;
};

export async function listEnpsSurveys(input: {
  year?: number;
  limit: number;
  offset: number;
}): Promise<{
  items: EnpsSurveyRow[];
  questions: EnpsQuestionRow[];
  limit: number;
  offset: number;
}> {
  const db = createPrivilegedDb();
  let query = db
    .from("enps_surveys")
    .select(ENPS_SURVEY_SELECT)
    .order("year_month", { ascending: false });
  if (input.year !== undefined) {
    query = query.like("year_month", `${input.year}-%`);
  }
  const { data, error } = await query.range(
    input.offset,
    input.offset + input.limit - 1,
  );
  throwIfError(error, "eNPS サーベイ一覧の取得に失敗しました");

  const { data: questions, error: questionError } = await db
    .from("enps_questions")
    .select(ENPS_QUESTION_SELECT)
    .order("display_order", { ascending: true });
  throwIfError(questionError, "eNPS 設問の取得に失敗しました");

  return {
    items: (data ?? []) as EnpsSurveyRow[],
    questions: (questions ?? []) as EnpsQuestionRow[],
    limit: input.limit,
    offset: input.offset,
  };
}

export type EnpsSnapshotRow = {
  id: string;
  survey_id: string;
  question_id: string;
  question_text: string | null;
  year_month: string | null;
  scope: string;
  company_name: string;
  business_unit_name: string;
  target_count: number;
  respondent_count: number;
  promoters: number;
  passives: number;
  detractors: number;
  nps_respondent_base: number | null;
  nps_imputed_base: number | null;
  computed_at: string;
};

export async function listEnpsMonthlySnapshots(input: {
  year_month?: string;
  group?: string;
  limit: number;
  offset: number;
}): Promise<{ items: EnpsSnapshotRow[]; limit: number; offset: number }> {
  if (input.year_month && !YEAR_MONTH_RE.test(input.year_month)) {
    throw new McpToolError(
      "year_month は YYYY-MM 形式で指定してください",
      "invalid_input",
    );
  }
  if (input.group && !GROUP_RE.test(input.group)) {
    throw new McpToolError("group の形式が不正です", "invalid_input");
  }

  const db = createPrivilegedDb();
  let query = db
    .from("enps_monthly_snapshots")
    .select(ENPS_SNAPSHOT_SELECT)
    .order("computed_at", { ascending: false });

  if (input.year_month) {
    const { data: surveys, error: surveyError } = await db
      .from("enps_surveys")
      .select("id")
      .eq("year_month", input.year_month);
    throwIfError(surveyError, "eNPS サーベイの取得に失敗しました");
    const surveyIds = (surveys ?? []).map((row) => row.id);
    if (surveyIds.length === 0) {
      return { items: [], limit: input.limit, offset: input.offset };
    }
    query = query.in("survey_id", surveyIds);
  }
  if (input.group) {
    query = query.or(
      `company_name.eq."${input.group}",business_unit_name.eq."${input.group}",scope.eq."${input.group}"`,
    );
  }

  const { data, error } = await query.range(
    input.offset,
    input.offset + input.limit - 1,
  );
  throwIfError(error, "eNPS 月次スナップショットの取得に失敗しました");

  const rows = data ?? [];
  const surveyIds = [...new Set(rows.map((row) => row.survey_id))];
  const questionIds = [...new Set(rows.map((row) => row.question_id))];

  const yearMonthBySurvey = new Map<string, string>();
  for (const batch of chunk(surveyIds, 200)) {
    const { data: surveys, error: surveyError } = await db
      .from("enps_surveys")
      .select("id, year_month")
      .in("id", batch);
    throwIfError(surveyError, "eNPS サーベイ月の取得に失敗しました");
    for (const survey of surveys ?? []) {
      yearMonthBySurvey.set(survey.id, survey.year_month);
    }
  }

  const questionTextById = new Map<string, string>();
  for (const batch of chunk(questionIds, 200)) {
    const { data: questions, error: questionError } = await db
      .from("enps_questions")
      .select("id, question_text")
      .in("id", batch);
    throwIfError(questionError, "eNPS 設問文の取得に失敗しました");
    for (const question of questions ?? []) {
      questionTextById.set(question.id, question.question_text);
    }
  }

  return {
    items: rows.map((row) => ({
      id: row.id,
      survey_id: row.survey_id,
      question_id: row.question_id,
      question_text: questionTextById.get(row.question_id) ?? null,
      year_month: yearMonthBySurvey.get(row.survey_id) ?? null,
      scope: row.scope,
      company_name: row.company_name,
      business_unit_name: row.business_unit_name,
      target_count: row.target_count,
      respondent_count: row.respondent_count,
      promoters: row.promoters,
      passives: row.passives,
      detractors: row.detractors,
      nps_respondent_base: row.nps_respondent_base,
      nps_imputed_base: row.nps_imputed_base,
      computed_at: row.computed_at,
    })),
    limit: input.limit,
    offset: input.offset,
  };
}

export async function getAwardNominationRanking(input: {
  survey_id?: string;
  year?: number;
  quarter?: AwardQuarter;
}): Promise<{
  year: number | null;
  quarter: AwardQuarter | null;
  label: string;
  survey_id: string | null;
  survey_ids: string[];
  survey_count: number;
  groups: ReturnType<typeof buildAwardNominationGroups>;
}> {
  const db = createPrivilegedDb();
  let surveyIds: string[] = [];
  let year: number | null = input.year ?? null;
  let quarter: AwardQuarter | null = input.quarter ?? null;
  let label = "";
  const surveyId: string | null = input.survey_id ?? null;

  if (input.survey_id) {
    const { data: survey, error } = await db
      .from("award_surveys")
      .select(AWARD_SURVEY_SELECT)
      .eq("id", input.survey_id)
      .maybeSingle();
    throwIfError(error, "表彰サーベイの取得に失敗しました");
    if (!survey) {
      throw new McpToolError("表彰サーベイが見つかりません", "not_found");
    }
    surveyIds = [survey.id];
    const period = fiscalPeriodFromYearMonth(survey.year_month);
    if (period) {
      year = period.year;
      quarter = period.quarter;
      label = period.label;
    } else {
      label = survey.title;
    }
  } else if (input.year !== undefined && input.quarter !== undefined) {
    const yearMonths = yearMonthKeysForQuarter(input.year, input.quarter);
    const { data: surveys, error } = await db
      .from("award_surveys")
      .select("id")
      .in("year_month", yearMonths);
    throwIfError(error, "表彰サーベイ一覧の取得に失敗しました");
    surveyIds = (surveys ?? []).map((row) => row.id);
    year = input.year;
    quarter = input.quarter;
    label = labelForAwardQuarter(input.year, input.quarter);
  }

  if (surveyIds.length === 0) {
    return {
      year,
      quarter,
      label,
      survey_id: surveyId,
      survey_ids: [],
      survey_count: 0,
      groups: emptyAwardNominationGroups(),
    };
  }

  let responses: Array<{
    question_id: string;
    text_value: string | null;
    nominee_user_id: string | null;
  }>;
  let questions: Array<{
    id: string;
    question_text: string;
    question_type: string;
    question_group: string | null;
    display_order: number;
    is_active: boolean;
  }> = [];

  try {
    const [questionsResult, fetchedResponses] = await Promise.all([
      db
        .from("award_questions")
        .select(AWARD_QUESTION_SELECT)
        .order("display_order", { ascending: true }),
      fetchAllRows<{
        question_id: string;
        text_value: string | null;
        nominee_user_id: string | null;
      }>((from, to) =>
        db
          .from("award_responses")
          .select(AWARD_RANKING_RESPONSE_SELECT)
          .in("survey_id", surveyIds)
          .order("id", { ascending: true })
          .range(from, to),
      ),
    ]);
    throwIfError(questionsResult.error, "表彰設問の取得に失敗しました");
    questions = questionsResult.data ?? [];
    responses = fetchedResponses;
  } catch (error) {
    if (error instanceof McpToolError) {
      throw error;
    }
    throw new McpToolError(
      `表彰回答の取得に失敗しました: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  const nomineeIds = [
    ...new Set(
      responses
        .map((row) => row.nominee_user_id)
        .filter((id): id is string => id != null),
    ),
  ];
  const userNameById = await mapPublicNames(db, nomineeIds);

  return {
    year,
    quarter,
    label,
    survey_id: surveyId,
    survey_ids: surveyIds,
    survey_count: surveyIds.length,
    groups: buildAwardNominationGroups(questions, responses, userNameById),
  };
}

export type SlackDirectoryRow = {
  user_id: string;
  name: string | null;
  slack_user_id: string | null;
};

export async function listSlackDirectory(input: {
  user_id?: string;
  query?: string;
  include_missing: boolean;
  limit: number;
  offset: number;
}): Promise<{ items: SlackDirectoryRow[]; limit: number; offset: number }> {
  const db = createPrivilegedDb();
  let allowedIds: string[] | null = null;
  if (input.query) {
    const { data: profiles, error } = await db
      .from("public_user_profiles")
      .select(PUBLIC_PROFILE_NAME_SELECT)
      .ilike("name", `%${escapeIlike(input.query)}%`)
      .limit(500);
    throwIfError(error, "公開プロフィール検索に失敗しました");
    allowedIds = (profiles ?? []).map((row) => row.id);
    if (allowedIds.length === 0) {
      return { items: [], limit: input.limit, offset: input.offset };
    }
  }

  let query = db
    .from("private_users")
    .select(PRIVATE_USERS_SLACK_SELECT)
    .is("suspended_at", null)
    .order("id", { ascending: true });
  if (input.user_id) {
    query = query.eq("id", input.user_id);
  }
  if (allowedIds) {
    query = query.in("id", allowedIds);
  }
  if (!input.include_missing) {
    query = query.not("slack_user_id", "is", null);
  }

  const { data, error } = await query.range(
    input.offset,
    input.offset + input.limit - 1,
  );
  throwIfError(error, "Slack 対応表の取得に失敗しました");
  const rows = data ?? [];
  const names = await mapPublicNames(
    db,
    rows.map((row) => row.id),
  );
  return {
    items: rows.map((row) => ({
      user_id: row.id,
      name: names.get(row.id) ?? null,
      slack_user_id: row.slack_user_id,
    })),
    limit: input.limit,
    offset: input.offset,
  };
}

export async function getSlackDirectoryEntry(
  userId: string,
): Promise<SlackDirectoryRow> {
  const db = createPrivilegedDb();
  const { data, error } = await db
    .from("private_users")
    .select(PRIVATE_USERS_SLACK_SELECT)
    .eq("id", userId)
    .is("suspended_at", null)
    .maybeSingle();
  throwIfError(error, "Slack ID の取得に失敗しました");
  if (!data) {
    throw new McpToolError("ユーザーが見つかりません", "not_found");
  }
  const names = await mapPublicNames(db, [data.id]);
  return {
    user_id: data.id,
    name: names.get(data.id) ?? null,
    slack_user_id: data.slack_user_id,
  };
}

export type EnpsResponseRow = {
  id: string;
  survey_id: string;
  question_id: string;
  question_text: string | null;
  user_id: string;
  user_name: string | null;
  score_value: number | null;
  text_value: string | null;
  is_late_submission: boolean;
  created_at: string;
};

export type AwardResponseRow = {
  id: string;
  survey_id: string;
  question_id: string;
  question_text: string | null;
  user_id: string;
  user_name: string | null;
  nominee_user_id: string | null;
  nominee_name: string | null;
  text_value: string | null;
  is_late_submission: boolean;
  created_at: string;
};

export async function listEnpsResponses(input: {
  survey_id: string;
  question_id?: string;
  user_id?: string;
  limit: number;
  offset: number;
}): Promise<{
  items: EnpsResponseRow[];
  survey_id: string;
  limit: number;
  offset: number;
}> {
  const db = createPrivilegedDb();
  let query = db
    .from("enps_responses")
    .select(ENPS_RESPONSE_SELECT)
    .eq("survey_id", input.survey_id)
    .order("created_at", { ascending: false });
  if (input.question_id) {
    query = query.eq("question_id", input.question_id);
  }
  if (input.user_id) {
    query = query.eq("user_id", input.user_id);
  }
  const { data, error } = await query.range(
    input.offset,
    input.offset + input.limit - 1,
  );
  throwIfError(error, "eNPS 個別回答の取得に失敗しました");
  return {
    items: await hydrateEnpsResponses(db, data ?? []),
    survey_id: input.survey_id,
    limit: input.limit,
    offset: input.offset,
  };
}

export async function getEnpsResponse(id: string): Promise<EnpsResponseRow> {
  const db = createPrivilegedDb();
  const { data, error } = await db
    .from("enps_responses")
    .select(ENPS_RESPONSE_SELECT)
    .eq("id", id)
    .maybeSingle();
  throwIfError(error, "eNPS 個別回答の取得に失敗しました");
  if (!data) {
    throw new McpToolError("eNPS 回答が見つかりません", "not_found");
  }
  const [row] = await hydrateEnpsResponses(db, [data]);
  if (!row) {
    throw new McpToolError("eNPS 回答が見つかりません", "not_found");
  }
  return row;
}

export async function listAwardResponses(input: {
  survey_id: string;
  question_id?: string;
  user_id?: string;
  nominee_user_id?: string;
  limit: number;
  offset: number;
}): Promise<{
  items: AwardResponseRow[];
  survey_id: string;
  limit: number;
  offset: number;
}> {
  const db = createPrivilegedDb();
  let query = db
    .from("award_responses")
    .select(AWARD_RESPONSE_SELECT)
    .eq("survey_id", input.survey_id)
    .order("created_at", { ascending: false });
  if (input.question_id) {
    query = query.eq("question_id", input.question_id);
  }
  if (input.user_id) {
    query = query.eq("user_id", input.user_id);
  }
  if (input.nominee_user_id) {
    query = query.eq("nominee_user_id", input.nominee_user_id);
  }
  const { data, error } = await query.range(
    input.offset,
    input.offset + input.limit - 1,
  );
  throwIfError(error, "表彰個別回答の取得に失敗しました");
  return {
    items: await hydrateAwardResponses(db, data ?? []),
    survey_id: input.survey_id,
    limit: input.limit,
    offset: input.offset,
  };
}

export async function getAwardResponse(id: string): Promise<AwardResponseRow> {
  const db = createPrivilegedDb();
  const { data, error } = await db
    .from("award_responses")
    .select(AWARD_RESPONSE_SELECT)
    .eq("id", id)
    .maybeSingle();
  throwIfError(error, "表彰個別回答の取得に失敗しました");
  if (!data) {
    throw new McpToolError("表彰回答が見つかりません", "not_found");
  }
  const [row] = await hydrateAwardResponses(db, [data]);
  if (!row) {
    throw new McpToolError("表彰回答が見つかりません", "not_found");
  }
  return row;
}

async function hydrateEnpsResponses(
  db: PrivilegedDb,
  rows: Array<{
    id: string;
    survey_id: string;
    question_id: string;
    user_id: string;
    score_value: number | null;
    text_value: string | null;
    is_late_submission: boolean;
    created_at: string;
  }>,
): Promise<EnpsResponseRow[]> {
  const questionText = await mapQuestionText(
    db,
    "enps_questions",
    rows.map((row) => row.question_id),
  );
  const names = await mapPublicNames(
    db,
    rows.map((row) => row.user_id),
  );
  return rows.map((row) => ({
    id: row.id,
    survey_id: row.survey_id,
    question_id: row.question_id,
    question_text: questionText.get(row.question_id) ?? null,
    user_id: row.user_id,
    user_name: names.get(row.user_id) ?? null,
    score_value: row.score_value,
    text_value: row.text_value,
    is_late_submission: row.is_late_submission,
    created_at: row.created_at,
  }));
}

async function hydrateAwardResponses(
  db: PrivilegedDb,
  rows: Array<{
    id: string;
    survey_id: string;
    question_id: string;
    user_id: string;
    nominee_user_id: string | null;
    text_value: string | null;
    is_late_submission: boolean;
    created_at: string;
  }>,
): Promise<AwardResponseRow[]> {
  const questionText = await mapQuestionText(
    db,
    "award_questions",
    rows.map((row) => row.question_id),
  );
  const nameIds = rows.flatMap((row) =>
    row.nominee_user_id ? [row.user_id, row.nominee_user_id] : [row.user_id],
  );
  const names = await mapPublicNames(db, nameIds);
  return rows.map((row) => ({
    id: row.id,
    survey_id: row.survey_id,
    question_id: row.question_id,
    question_text: questionText.get(row.question_id) ?? null,
    user_id: row.user_id,
    user_name: names.get(row.user_id) ?? null,
    nominee_user_id: row.nominee_user_id,
    nominee_name: row.nominee_user_id
      ? (names.get(row.nominee_user_id) ?? null)
      : null,
    text_value: row.text_value,
    is_late_submission: row.is_late_submission,
    created_at: row.created_at,
  }));
}

async function mapQuestionText(
  db: PrivilegedDb,
  table: "enps_questions" | "award_questions",
  ids: string[],
): Promise<Map<string, string>> {
  const texts = new Map<string, string>();
  const unique = [...new Set(ids.filter((id) => id.length > 0))];
  for (const batch of chunk(unique, 200)) {
    const { data, error } = await db
      .from(table)
      .select("id, question_text")
      .in("id", batch);
    throwIfError(error, "設問文の取得に失敗しました");
    for (const row of data ?? []) {
      texts.set(row.id, row.question_text);
    }
  }
  return texts;
}

export type SurveyResponsesCsvExport = {
  survey_id: string;
  year_month: string;
  title: string;
  filename: string;
  csv: string;
  row_count: number;
  question_count: number;
};

type SurveyLocator = {
  survey_id?: string;
  year_month?: string;
};

type SurveyMeta = {
  id: string;
  title: string;
  year_month: string;
};

function toSurveyMeta(row: {
  id: string;
  title: string;
  year_month: string;
}): SurveyMeta {
  return {
    id: row.id,
    title: row.title,
    year_month: row.year_month,
  };
}

async function resolveEnpsSurvey(input: SurveyLocator): Promise<SurveyMeta> {
  const db = createPrivilegedDb();
  if (input.survey_id) {
    const { data, error } = await db
      .from("enps_surveys")
      .select(ENPS_SURVEY_SELECT)
      .eq("id", input.survey_id)
      .maybeSingle();
    throwIfError(error, "サーベイの取得に失敗しました");
    if (!data) {
      throw new McpToolError("eNPS サーベイが見つかりません", "not_found");
    }
    return toSurveyMeta(data as unknown as EnpsSurveyRow);
  }
  if (!input.year_month || !YEAR_MONTH_RE.test(input.year_month)) {
    throw new McpToolError(
      "survey_id か year_month を指定してください",
      "invalid_input",
    );
  }
  const { data, error } = await db
    .from("enps_surveys")
    .select(ENPS_SURVEY_SELECT)
    .eq("year_month", input.year_month)
    .maybeSingle();
  throwIfError(error, "サーベイの取得に失敗しました");
  if (!data) {
    throw new McpToolError("eNPS サーベイが見つかりません", "not_found");
  }
  return toSurveyMeta(data as unknown as EnpsSurveyRow);
}

async function resolveAwardSurvey(input: SurveyLocator): Promise<SurveyMeta> {
  const db = createPrivilegedDb();
  if (input.survey_id) {
    const { data, error } = await db
      .from("award_surveys")
      .select(AWARD_SURVEY_SELECT)
      .eq("id", input.survey_id)
      .maybeSingle();
    throwIfError(error, "サーベイの取得に失敗しました");
    if (!data) {
      throw new McpToolError("表彰サーベイが見つかりません", "not_found");
    }
    return toSurveyMeta(data as unknown as SurveyMeta);
  }
  if (!input.year_month || !YEAR_MONTH_RE.test(input.year_month)) {
    throw new McpToolError(
      "survey_id か year_month を指定してください",
      "invalid_input",
    );
  }
  const { data, error } = await db
    .from("award_surveys")
    .select(AWARD_SURVEY_SELECT)
    .eq("year_month", input.year_month)
    .maybeSingle();
  throwIfError(error, "サーベイの取得に失敗しました");
  if (!data) {
    throw new McpToolError("表彰サーベイが見つかりません", "not_found");
  }
  return toSurveyMeta(data as unknown as SurveyMeta);
}

function buildCsvExport(input: {
  kind: "enps" | "award";
  survey: SurveyMeta;
  questions: SurveyExportQuestion[];
  responses: SurveyExportAnswer[];
}): SurveyResponsesCsvExport {
  const { lines, rowCount } = buildSurveyResponsesCsv({
    questions: input.questions,
    responses: input.responses,
  });
  return {
    survey_id: input.survey.id,
    year_month: input.survey.year_month,
    title: input.survey.title,
    filename: surveyResponsesCsvFilename(input.kind, input.survey.year_month),
    csv: surveyResponsesCsvText(lines),
    row_count: rowCount,
    question_count: input.questions.length,
  };
}

export async function exportEnpsResponsesCsv(
  input: SurveyLocator,
): Promise<SurveyResponsesCsvExport> {
  const survey = await resolveEnpsSurvey(input);
  const db = createPrivilegedDb();
  const { data: questions, error: questionError } = await db
    .from("enps_questions")
    .select(ENPS_QUESTION_SELECT)
    .eq("is_active", true)
    .order("display_order", { ascending: true });
  throwIfError(questionError, "eNPS 設問の取得に失敗しました");

  let rows: Array<{
    id: string;
    question_id: string;
    user_id: string;
    score_value: number | null;
    text_value: string | null;
    is_late_submission: boolean;
    created_at: string;
  }>;
  try {
    rows = await fetchAllRows((from, to) =>
      db
        .from("enps_responses")
        .select(ENPS_RESPONSE_SELECT)
        .eq("survey_id", survey.id)
        .order("id", { ascending: true })
        .range(from, to),
    );
  } catch (error) {
    throw new McpToolError(
      `eNPS 個別回答の取得に失敗しました: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  const orgs = await mapPublicOrgs(
    db,
    rows.map((row) => row.user_id),
  );
  const exportQuestions: SurveyExportQuestion[] = (questions ?? []).map(
    (question) => ({
      id: question.id,
      question_text: question.question_text,
      question_type: question.question_type,
      display_order: question.display_order,
    }),
  );
  const exportResponses: SurveyExportAnswer[] = rows.map((row) => {
    const org = orgs.get(row.user_id);
    return {
      id: row.id,
      question_id: row.question_id,
      user_id: row.user_id,
      user_name: org?.name ?? "不明",
      company_name: org?.company_name ?? "",
      business_unit_name: org?.business_unit_name ?? "",
      created_at: row.created_at,
      score_value: row.score_value,
      text_value: row.text_value,
      is_late_submission: Boolean(row.is_late_submission),
    };
  });

  return buildCsvExport({
    kind: "enps",
    survey,
    questions: exportQuestions,
    responses: exportResponses,
  });
}

export async function exportAwardResponsesCsv(
  input: SurveyLocator,
): Promise<SurveyResponsesCsvExport> {
  const survey = await resolveAwardSurvey(input);
  const db = createPrivilegedDb();
  const { data: questions, error: questionError } = await db
    .from("award_questions")
    .select(AWARD_QUESTION_SELECT)
    .eq("is_active", true)
    .order("display_order", { ascending: true });
  throwIfError(questionError, "表彰設問の取得に失敗しました");

  let rows: Array<{
    id: string;
    question_id: string;
    user_id: string;
    nominee_user_id: string | null;
    text_value: string | null;
    is_late_submission: boolean;
    created_at: string;
  }>;
  try {
    rows = await fetchAllRows((from, to) =>
      db
        .from("award_responses")
        .select(AWARD_RESPONSE_SELECT)
        .eq("survey_id", survey.id)
        .order("id", { ascending: true })
        .range(from, to),
    );
  } catch (error) {
    throw new McpToolError(
      `表彰個別回答の取得に失敗しました: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  const orgs = await mapPublicOrgs(
    db,
    rows.flatMap((row) =>
      row.nominee_user_id ? [row.user_id, row.nominee_user_id] : [row.user_id],
    ),
  );
  const exportQuestions: SurveyExportQuestion[] = (questions ?? []).map(
    (question) => {
      const groupLabel = question.question_group
        ? AWARD_QUESTION_GROUP_LABELS[question.question_group]
        : undefined;
      return {
        id: question.id,
        question_text: question.question_text,
        question_type: question.question_type,
        display_order: question.display_order,
        header: groupLabel
          ? `${groupLabel} / ${question.question_text}`
          : question.question_text,
      };
    },
  );
  const exportResponses: SurveyExportAnswer[] = rows.map((row) => {
    const org = orgs.get(row.user_id);
    return {
      id: row.id,
      question_id: row.question_id,
      user_id: row.user_id,
      user_name: org?.name ?? "不明",
      company_name: org?.company_name ?? "",
      business_unit_name: org?.business_unit_name ?? "",
      created_at: row.created_at,
      score_value: null,
      text_value: row.text_value,
      nominee_user_id: row.nominee_user_id,
      nominee_user_name: row.nominee_user_id
        ? (orgs.get(row.nominee_user_id)?.name ?? null)
        : null,
      is_late_submission: Boolean(row.is_late_submission),
    };
  });

  return buildCsvExport({
    kind: "award",
    survey,
    questions: exportQuestions,
    responses: exportResponses,
  });
}
