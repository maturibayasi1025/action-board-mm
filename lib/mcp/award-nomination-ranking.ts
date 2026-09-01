import {
  AWARD_QUESTION_GROUP_LABELS,
  AWARD_QUESTION_GROUP_ORDER,
  type AwardQuarter,
  fiscalYearAndQuarterFromYearMonth,
  formatQuarterLabel,
  parseYearMonth,
} from "@/app/(protected)/admin/award-surveys/quarterly-ranking-model";

const NOMINATION_GROUP_SET = new Set<string>(AWARD_QUESTION_GROUP_ORDER);

export type AwardNominationQuestion = {
  id: string;
  question_text: string;
  question_type: string;
  question_group: string | null;
  display_order: number;
  is_active: boolean;
};

export type AwardNominationResponse = {
  question_id: string;
  text_value: string | null;
  nominee_user_id: string | null;
};

export type AwardNominationRow = {
  name: string;
  votes: number;
  nominee_user_id: string | null;
};

export type AwardNominationGroup = {
  group: string;
  label: string;
  rows: AwardNominationRow[];
};

export function labelForAwardQuarter(
  year: number,
  quarter: AwardQuarter,
): string {
  return formatQuarterLabel(year, quarter);
}

export function fiscalPeriodFromYearMonth(yearMonth: string): {
  year: number;
  quarter: AwardQuarter;
  label: string;
} | null {
  const parsed = parseYearMonth(yearMonth);
  if (!parsed) {
    return null;
  }
  const { fiscalYear, quarter } = fiscalYearAndQuarterFromYearMonth(
    parsed.year,
    parsed.month,
  );
  return {
    year: fiscalYear,
    quarter,
    label: formatQuarterLabel(fiscalYear, quarter),
  };
}

export function pickNominationQuestionForGroup(
  masterQuestions: AwardNominationQuestion[],
  group: string,
): AwardNominationQuestion | undefined {
  const groupQuestions = masterQuestions.filter(
    (question) =>
      question.question_group === group &&
      question.is_active &&
      NOMINATION_GROUP_SET.has(question.question_group ?? ""),
  );
  if (group === "team_value") {
    return groupQuestions
      .filter((question) => question.question_type === "text")
      .sort((a, b) => a.display_order - b.display_order)[0];
  }
  return groupQuestions
    .filter((question) => question.question_type === "user_select")
    .sort((a, b) => a.display_order - b.display_order)[0];
}

function resolveNominee(
  response: AwardNominationResponse,
  question: AwardNominationQuestion,
  userNameById: Map<string, string>,
): AwardNominationRow | null {
  if (question.question_type === "user_select") {
    if (response.nominee_user_id) {
      const name = userNameById.get(response.nominee_user_id);
      if (!name) {
        return null;
      }
      return {
        name,
        votes: 1,
        nominee_user_id: response.nominee_user_id,
      };
    }
    const legacy = response.text_value?.trim();
    if (legacy) {
      return { name: legacy, votes: 1, nominee_user_id: null };
    }
    return null;
  }
  const textValue = response.text_value?.trim();
  if (textValue) {
    return { name: textValue, votes: 1, nominee_user_id: null };
  }
  return null;
}

function nomineeKey(row: AwardNominationRow): string {
  return row.nominee_user_id
    ? `uid:${row.nominee_user_id}`
    : `text:${row.name}`;
}

export function aggregateTopFiveForQuestion(
  responses: AwardNominationResponse[],
  question: AwardNominationQuestion,
  userNameById: Map<string, string>,
): AwardNominationRow[] {
  const counts = new Map<string, AwardNominationRow>();
  for (const response of responses) {
    if (response.question_id !== question.id) {
      continue;
    }
    const nominee = resolveNominee(response, question, userNameById);
    if (!nominee) {
      continue;
    }
    const key = nomineeKey(nominee);
    const existing = counts.get(key);
    if (existing) {
      existing.votes += 1;
    } else {
      counts.set(key, { ...nominee });
    }
  }
  return Array.from(counts.values())
    .sort((a, b) => b.votes - a.votes)
    .slice(0, 5);
}

export function buildAwardNominationGroups(
  questions: AwardNominationQuestion[],
  responses: AwardNominationResponse[],
  userNameById: Map<string, string>,
): AwardNominationGroup[] {
  return AWARD_QUESTION_GROUP_ORDER.map((group) => {
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
      rows: aggregateTopFiveForQuestion(responses, question, userNameById),
    };
  });
}

export function emptyAwardNominationGroups(): AwardNominationGroup[] {
  return AWARD_QUESTION_GROUP_ORDER.map((group) => ({
    group,
    label: AWARD_QUESTION_GROUP_LABELS[group] ?? group,
    rows: [],
  }));
}
