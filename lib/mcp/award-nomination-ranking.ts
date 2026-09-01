import {
  AWARD_QUESTION_GROUP_LABELS,
  AWARD_QUESTION_GROUP_ORDER,
  type AwardQuarter,
  fiscalYearAndQuarterFromYearMonth,
  formatQuarterLabel,
  parseYearMonth,
} from "@/app/(protected)/admin/award-surveys/quarterly-ranking-model";
import {
  type AwardNominationQuestion,
  type AwardNominationResponse,
  aggregateNominationsForQuestion,
  pickNominationQuestionForGroup,
} from "@/lib/award/nomination-ranking";

export type {
  AwardNominationQuestion,
  AwardNominationResponse,
} from "@/lib/award/nomination-ranking";

export { pickNominationQuestionForGroup } from "@/lib/award/nomination-ranking";

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

export function aggregateTopFiveForQuestion(
  responses: AwardNominationResponse[],
  question: AwardNominationQuestion,
  userNameById: Map<string, string>,
): AwardNominationRow[] {
  const { topRows } = aggregateNominationsForQuestion(
    responses,
    question,
    userNameById,
    { dropUnknownUserIds: true },
  );
  return topRows.map((row) => ({
    name: row.name,
    votes: row.votes,
    nominee_user_id: row.nominee_user_id,
  }));
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
  return buildAwardNominationGroups([], [], new Map());
}
