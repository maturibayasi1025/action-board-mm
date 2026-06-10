"use server";

import {
  AWARD_QUESTION_GROUP_LABELS,
  AWARD_QUESTION_GROUP_ORDER,
  type AwardQuarter,
  type AwardQuarterGroupRanking,
  type AwardQuarterOption,
  type AwardQuarterRankingRow,
  type AwardQuarterlyRankingResult,
  fiscalYearAndQuarterFromYearMonth,
  formatQuarterLabel,
  parseYearMonth,
  quarterKey,
  yearMonthKeysForQuarter,
} from "@/app/(protected)/admin/award-surveys/quarterly-ranking-model";
import { createServiceClient } from "@/lib/supabase/server";
import { requireOwner } from "@/lib/utils/isOwner";

const NOMINATION_GROUP_SET = new Set<string>(AWARD_QUESTION_GROUP_ORDER);

type MasterQuestion = {
  id: string;
  question_text: string;
  question_type: string;
  question_group: string | null;
  display_order: number;
  is_active: boolean;
};

type ResponseRow = {
  question_id: string;
  text_value: string | null;
  nominee_user_id: string | null;
  is_late_submission: boolean | null;
};

function pickNominationQuestionForGroup(
  masterQuestions: MasterQuestion[],
  group: string,
): MasterQuestion | undefined {
  const groupQuestions = masterQuestions.filter(
    (q) =>
      q.question_group === group &&
      q.is_active &&
      NOMINATION_GROUP_SET.has(q.question_group ?? ""),
  );
  if (group === "team_value") {
    return groupQuestions
      .filter((q) => q.question_type === "text")
      .sort((a, b) => a.display_order - b.display_order)[0];
  }
  return groupQuestions
    .filter((q) => q.question_type === "user_select")
    .sort((a, b) => a.display_order - b.display_order)[0];
}

function resolveNomineeKey(
  response: ResponseRow,
  question: MasterQuestion,
  userNameById: Map<string, string>,
): { key: string; name: string } | null {
  if (question.question_type === "user_select") {
    if (response.nominee_user_id) {
      const name = userNameById.get(response.nominee_user_id) ?? "不明";
      return { key: `uid:${response.nominee_user_id}`, name };
    }
    const legacy = response.text_value?.trim();
    if (legacy) {
      return { key: `text:${legacy}`, name: legacy };
    }
    return null;
  }
  const text = response.text_value?.trim();
  if (!text) return null;
  return { key: `text:${text}`, name: text };
}

function aggregateTopFiveForQuestion(
  responses: ResponseRow[],
  question: MasterQuestion,
  userNameById: Map<string, string>,
): AwardQuarterRankingRow[] {
  const counts = new Map<string, { name: string; votes: number }>();

  for (const r of responses) {
    if (r.question_id !== question.id) continue;
    const nominee = resolveNomineeKey(r, question, userNameById);
    if (!nominee) continue;

    const existing = counts.get(nominee.key);
    if (existing) {
      existing.votes += 1;
    } else {
      counts.set(nominee.key, { name: nominee.name, votes: 1 });
    }
  }

  return Array.from(counts.values())
    .sort((a, b) => b.votes - a.votes)
    .slice(0, 5);
}

export async function getAvailableAwardQuarters(): Promise<
  AwardQuarterOption[]
> {
  await requireOwner();
  const supabase = await createServiceClient();

  const { data: surveys, error } = await supabase
    .from("award_surveys")
    .select("year_month");

  if (error) {
    console.error("四半期一覧の取得エラー:", error);
    return [];
  }

  const seen = new Set<string>();
  const options: AwardQuarterOption[] = [];

  for (const row of surveys ?? []) {
    const parsed = parseYearMonth(row.year_month);
    if (!parsed) continue;
    const { fiscalYear, quarter } = fiscalYearAndQuarterFromYearMonth(
      parsed.year,
      parsed.month,
    );
    const key = quarterKey(fiscalYear, quarter);
    if (seen.has(key)) continue;
    seen.add(key);
    options.push({
      year: fiscalYear,
      quarter,
      label: formatQuarterLabel(fiscalYear, quarter),
    });
  }

  options.sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year;
    return b.quarter - a.quarter;
  });

  return options;
}

export async function getAwardQuarterlyNominationRanking(
  year: number,
  quarter: AwardQuarter,
): Promise<AwardQuarterlyRankingResult> {
  await requireOwner();
  const supabase = await createServiceClient();
  const label = formatQuarterLabel(year, quarter);
  const targetYearMonths = yearMonthKeysForQuarter(year, quarter);

  const { data: surveys, error: surveysError } = await supabase
    .from("award_surveys")
    .select("id")
    .in("year_month", targetYearMonths);

  if (surveysError) {
    console.error("四半期アンケートの取得エラー:", surveysError);
    return {
      year,
      quarter,
      label,
      surveyCount: 0,
      groups: AWARD_QUESTION_GROUP_ORDER.map((group) => ({
        group,
        label: AWARD_QUESTION_GROUP_LABELS[group] ?? group,
        rows: [],
      })),
    };
  }

  const surveyIds = (surveys ?? []).map((s) => s.id);
  const surveyCount = surveyIds.length;

  const emptyGroups: AwardQuarterGroupRanking[] =
    AWARD_QUESTION_GROUP_ORDER.map((group) => ({
      group,
      label: AWARD_QUESTION_GROUP_LABELS[group] ?? group,
      rows: [],
    }));

  if (surveyIds.length === 0) {
    return { year, quarter, label, surveyCount: 0, groups: emptyGroups };
  }

  const [
    { data: masterQuestions },
    { data: responses, error: responsesError },
  ] = await Promise.all([
    supabase
      .from("award_questions")
      .select(
        "id, question_text, question_type, question_group, display_order, is_active",
      )
      .order("display_order", { ascending: true }),
    supabase
      .from("award_responses")
      .select("question_id, text_value, nominee_user_id, is_late_submission")
      .in("survey_id", surveyIds),
  ]);

  if (responsesError) {
    console.error("四半期回答の取得エラー:", responsesError);
    return { year, quarter, label, surveyCount, groups: emptyGroups };
  }

  const nomineeIds = Array.from(
    new Set(
      (responses ?? [])
        .map((r) => r.nominee_user_id)
        .filter((id): id is string => id != null),
    ),
  );

  const userNameById = new Map<string, string>();
  if (nomineeIds.length > 0) {
    const { data: users } = await supabase
      .from("private_users")
      .select("id, name")
      .in("id", nomineeIds);
    for (const u of users ?? []) {
      userNameById.set(u.id, u.name);
    }
  }

  const questions = (masterQuestions ?? []) as MasterQuestion[];
  const responseRows = (responses ?? []) as ResponseRow[];

  const groups: AwardQuarterGroupRanking[] = AWARD_QUESTION_GROUP_ORDER.map(
    (group) => {
      const question = pickNominationQuestionForGroup(questions, group);
      if (!question) {
        return {
          group,
          label: AWARD_QUESTION_GROUP_LABELS[group] ?? group,
          rows: [],
        };
      }
      return {
        group,
        label: AWARD_QUESTION_GROUP_LABELS[group] ?? group,
        rows: aggregateTopFiveForQuestion(responseRows, question, userNameById),
      };
    },
  );

  return { year, quarter, label, surveyCount, groups };
}
