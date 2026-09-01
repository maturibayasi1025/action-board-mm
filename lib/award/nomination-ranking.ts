import {
  AWARD_QUESTION_GROUP_LABELS,
  AWARD_QUESTION_GROUP_ORDER,
  type AwardQuarter,
  type AwardQuarterGroupRanking,
  type AwardQuarterMonthBreakdown,
  type AwardQuarterRankingRow,
  type AwardQuarterlyRankingResult,
} from "@/app/(protected)/admin/award-surveys/quarterly-ranking-model";

const NOMINATION_GROUP_SET = new Set<string>(AWARD_QUESTION_GROUP_ORDER);
const UNMATCHED_FALLBACK_NAME = "未突合";
const TOP_N = 5;
const TOP_N_MAX_WITH_TIES = 10;

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
  survey_id?: string;
  user_id?: string;
  year_month?: string;
  is_late_submission?: boolean | null;
};

export type ResolvedNominee = {
  key: string;
  name: string;
  nominee_user_id: string | null;
  unmatched: boolean;
};

export type NominationTallyRow = {
  key: string;
  name: string;
  votes: number;
  nominee_user_id: string | null;
  unmatched: boolean;
  onTimeVotes: number;
  lateVotes: number;
  votesByMonth: Record<string, number>;
};

export type NominationAggregate = {
  rows: NominationTallyRow[];
  topRows: NominationTallyRow[];
  totalVotes: number;
  unmatchedVotes: number;
  onTimeVotes: number;
  lateVotes: number;
};

export function normalizeNomineeName(name: string): string {
  return name
    .normalize("NFKC")
    .replace(/[\s\u3000]+/g, "")
    .toLowerCase();
}

export function buildNormalizedNameIndex(
  userNameById: Map<string, string>,
): Map<string, string[]> {
  const index = new Map<string, string[]>();
  for (const [id, name] of userNameById) {
    const normalized = normalizeNomineeName(name);
    if (!normalized) continue;
    const existing = index.get(normalized);
    if (existing) {
      existing.push(id);
    } else {
      index.set(normalized, [id]);
    }
  }
  return index;
}

export function resolveNominee(
  response: AwardNominationResponse,
  question: Pick<AwardNominationQuestion, "question_type">,
  userNameById: Map<string, string>,
  nameIndex: Map<string, string[]>,
  options?: { dropUnknownUserIds?: boolean },
): ResolvedNominee | null {
  const dropUnknownUserIds = options?.dropUnknownUserIds ?? false;

  if (question.question_type === "user_select") {
    if (response.nominee_user_id) {
      const name = userNameById.get(response.nominee_user_id);
      if (name) {
        return {
          key: `uid:${response.nominee_user_id}`,
          name,
          nominee_user_id: response.nominee_user_id,
          unmatched: false,
        };
      }
      if (dropUnknownUserIds) {
        return null;
      }
      const fallback =
        response.text_value?.trim() ||
        `${UNMATCHED_FALLBACK_NAME} (${response.nominee_user_id.slice(0, 8)})`;
      return {
        key: `uid:${response.nominee_user_id}`,
        name: fallback,
        nominee_user_id: response.nominee_user_id,
        unmatched: true,
      };
    }

    const legacy = response.text_value?.trim();
    if (!legacy) {
      return null;
    }
    return resolveTextNominee(legacy, userNameById, nameIndex, true);
  }

  const textValue = response.text_value?.trim();
  if (!textValue) {
    return null;
  }
  return resolveTextNominee(textValue, userNameById, nameIndex, false);
}

function resolveTextNominee(
  rawName: string,
  userNameById: Map<string, string>,
  nameIndex: Map<string, string[]>,
  tryUserMatch: boolean,
): ResolvedNominee {
  if (tryUserMatch) {
    const matches = nameIndex.get(normalizeNomineeName(rawName)) ?? [];
    if (matches.length === 1) {
      const userId = matches[0];
      return {
        key: `uid:${userId}`,
        name: userNameById.get(userId) ?? rawName,
        nominee_user_id: userId,
        unmatched: false,
      };
    }
  }
  return {
    key: `text:${normalizeNomineeName(rawName) || rawName}`,
    name: rawName,
    nominee_user_id: null,
    unmatched: tryUserMatch,
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

export function takeTopNWithTies<T extends { votes: number }>(
  rows: T[],
  n: number,
  maxRows = TOP_N_MAX_WITH_TIES,
): T[] {
  if (rows.length <= n) {
    return rows;
  }
  const cutoff = rows[n - 1].votes;
  return rows.filter((row) => row.votes >= cutoff).slice(0, maxRows);
}

export function aggregateNominationsForQuestion(
  responses: AwardNominationResponse[],
  question: AwardNominationQuestion,
  userNameById: Map<string, string>,
  options?: { dropUnknownUserIds?: boolean },
): NominationAggregate {
  const nameIndex = buildNormalizedNameIndex(userNameById);
  const counts = new Map<string, NominationTallyRow>();
  let unmatchedVotes = 0;
  let totalVotes = 0;
  let onTimeVotes = 0;
  let lateVotes = 0;

  for (const response of responses) {
    if (response.question_id !== question.id) {
      continue;
    }
    const nominee = resolveNominee(
      response,
      question,
      userNameById,
      nameIndex,
      options,
    );
    if (!nominee) {
      continue;
    }

    totalVotes += 1;
    const isLate = Boolean(response.is_late_submission);
    if (isLate) {
      lateVotes += 1;
    } else {
      onTimeVotes += 1;
    }
    if (nominee.unmatched) {
      unmatchedVotes += 1;
    }

    const existing = counts.get(nominee.key);
    if (existing) {
      existing.votes += 1;
      if (isLate) {
        existing.lateVotes += 1;
      } else {
        existing.onTimeVotes += 1;
      }
      if (response.year_month) {
        existing.votesByMonth[response.year_month] =
          (existing.votesByMonth[response.year_month] ?? 0) + 1;
      }
      if (!existing.unmatched && nominee.unmatched) {
        existing.unmatched = true;
      }
    } else {
      counts.set(nominee.key, {
        key: nominee.key,
        name: nominee.name,
        votes: 1,
        nominee_user_id: nominee.nominee_user_id,
        unmatched: nominee.unmatched,
        onTimeVotes: isLate ? 0 : 1,
        lateVotes: isLate ? 1 : 0,
        votesByMonth: response.year_month ? { [response.year_month]: 1 } : {},
      });
    }
  }

  const rows = Array.from(counts.values()).sort((a, b) => {
    if (b.votes !== a.votes) {
      return b.votes - a.votes;
    }
    return a.name.localeCompare(b.name, "ja");
  });

  return {
    rows,
    topRows: takeTopNWithTies(rows, TOP_N),
    totalVotes,
    unmatchedVotes,
    onTimeVotes,
    lateVotes,
  };
}

export type AwardSurveyForRanking = {
  id: string;
  year_month: string;
  title: string;
};

export type AwardResponseForRanking = {
  survey_id: string;
  question_id: string;
  user_id: string;
  text_value: string | null;
  nominee_user_id: string | null;
  is_late_submission: boolean | null;
};

export function buildAwardQuarterlyRanking(input: {
  year: number;
  quarter: AwardQuarter;
  label: string;
  expectedYearMonths: string[];
  surveys: AwardSurveyForRanking[];
  questions: AwardNominationQuestion[];
  responses: AwardResponseForRanking[];
  userNameById: Map<string, string>;
  dbResponseCount: number | null;
}): AwardQuarterlyRankingResult {
  const { label } = input;
  const surveyById = new Map(
    input.surveys.map((survey) => [survey.id, survey]),
  );
  const foundMonths = new Set(input.surveys.map((survey) => survey.year_month));
  const missingYearMonths = input.expectedYearMonths.filter(
    (yearMonth) => !foundMonths.has(yearMonth),
  );

  const responsesWithMonth: AwardNominationResponse[] = input.responses.map(
    (response) => ({
      ...response,
      year_month: surveyById.get(response.survey_id)?.year_month,
    }),
  );

  const nominationQuestionById = new Map<string, AwardNominationQuestion>();
  for (const group of AWARD_QUESTION_GROUP_ORDER) {
    const question = pickNominationQuestionForGroup(input.questions, group);
    if (question) {
      nominationQuestionById.set(question.id, question);
    }
  }
  const nominationQuestionIds = new Set(nominationQuestionById.keys());

  const months: AwardQuarterMonthBreakdown[] = input.expectedYearMonths.map(
    (yearMonth) => {
      const survey = input.surveys.find((row) => row.year_month === yearMonth);
      if (!survey) {
        return {
          yearMonth,
          surveyId: null,
          surveyTitle: null,
          responseRowCount: 0,
          uniqueResponderCount: 0,
          nominationVoteCount: 0,
          onTimeNominationVoteCount: 0,
          lateNominationVoteCount: 0,
          unmatchedVoteCount: 0,
        };
      }

      const monthResponses = responsesWithMonth.filter(
        (response) => response.year_month === yearMonth,
      );
      const uniqueResponders = new Set(
        monthResponses
          .map((response) => response.user_id)
          .filter((userId): userId is string => typeof userId === "string"),
      );
      let nominationVoteCount = 0;
      let onTimeNominationVoteCount = 0;
      let lateNominationVoteCount = 0;
      let unmatchedVoteCount = 0;
      const nameIndex = buildNormalizedNameIndex(input.userNameById);

      for (const response of monthResponses) {
        const question = nominationQuestionById.get(response.question_id);
        if (!question) continue;
        const nominee = resolveNominee(
          response,
          question,
          input.userNameById,
          nameIndex,
        );
        if (!nominee) continue;
        nominationVoteCount += 1;
        if (response.is_late_submission) {
          lateNominationVoteCount += 1;
        } else {
          onTimeNominationVoteCount += 1;
        }
        if (nominee.unmatched) {
          unmatchedVoteCount += 1;
        }
      }

      return {
        yearMonth,
        surveyId: survey.id,
        surveyTitle: survey.title,
        responseRowCount: monthResponses.length,
        uniqueResponderCount: uniqueResponders.size,
        nominationVoteCount,
        onTimeNominationVoteCount,
        lateNominationVoteCount,
        unmatchedVoteCount,
      };
    },
  );

  const groups: AwardQuarterGroupRanking[] = AWARD_QUESTION_GROUP_ORDER.map(
    (group) => {
      const question = pickNominationQuestionForGroup(input.questions, group);
      if (!question) {
        return {
          group,
          label: AWARD_QUESTION_GROUP_LABELS[group] ?? group,
          rows: [],
          totalVotes: 0,
          unmatchedVotes: 0,
        };
      }
      const aggregate = aggregateNominationsForQuestion(
        responsesWithMonth,
        question,
        input.userNameById,
      );
      return {
        group,
        label: AWARD_QUESTION_GROUP_LABELS[group] ?? group,
        rows: aggregate.topRows.map(toRankingRow),
        totalVotes: aggregate.totalVotes,
        unmatchedVotes: aggregate.unmatchedVotes,
      };
    },
  );

  const nominationVoteCount = groups.reduce(
    (sum, group) => sum + group.totalVotes,
    0,
  );
  const unmatchedVoteCount = groups.reduce(
    (sum, group) => sum + group.unmatchedVotes,
    0,
  );
  const onTimeNominationVoteCount = months.reduce(
    (sum, month) => sum + month.onTimeNominationVoteCount,
    0,
  );
  const lateNominationVoteCount = months.reduce(
    (sum, month) => sum + month.lateNominationVoteCount,
    0,
  );
  const monthlyNominationSum = months.reduce(
    (sum, month) => sum + month.nominationVoteCount,
    0,
  );

  const uniqueResponderCount = new Set(
    input.responses
      .map((response) => response.user_id)
      .filter((userId): userId is string => typeof userId === "string"),
  ).size;

  return {
    year: input.year,
    quarter: input.quarter,
    label,
    expectedSurveyCount: input.expectedYearMonths.length,
    surveyCount: input.surveys.length,
    missingYearMonths,
    responseRowCount: input.responses.length,
    dbResponseCount: input.dbResponseCount,
    uniqueResponderCount,
    nominationVoteCount,
    unmatchedVoteCount,
    onTimeNominationVoteCount,
    lateNominationVoteCount,
    monthlyNominationSum,
    checksumOk: monthlyNominationSum === nominationVoteCount,
    responseCountMismatch:
      input.dbResponseCount != null &&
      input.dbResponseCount !== input.responses.length,
    months,
    groups,
    nominationQuestionCount: nominationQuestionIds.size,
  };
}

function toRankingRow(row: NominationTallyRow): AwardQuarterRankingRow {
  return {
    key: row.key,
    name: row.name,
    votes: row.votes,
    onTimeVotes: row.onTimeVotes,
    lateVotes: row.lateVotes,
    unmatched: row.unmatched,
    votesByMonth: row.votesByMonth,
  };
}

export function emptyAwardQuarterlyRankingResult(
  year: number,
  quarter: AwardQuarter,
  label: string,
  expectedYearMonths: string[],
): AwardQuarterlyRankingResult {
  return buildAwardQuarterlyRanking({
    year,
    quarter,
    label,
    expectedYearMonths,
    surveys: [],
    questions: [],
    responses: [],
    userNameById: new Map(),
    dbResponseCount: 0,
  });
}
