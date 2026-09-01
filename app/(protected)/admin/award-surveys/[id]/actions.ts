"use server";

import {
  type PrivateUserOrgRow,
  companyAndBusinessUnitFromPrivateUserRow,
} from "@/lib/admin/private-user-org";
import {
  fetchAwardResponsesForSurvey,
  fetchPrivateUsersByIds,
} from "@/lib/award/fetch-award-rows";
import {
  buildNormalizedNameIndex,
  resolveNominee,
} from "@/lib/award/nomination-ranking";
import { fetchAllRows } from "@/lib/supabase/fetch-all-rows";
import { createServiceClient } from "@/lib/supabase/server";
import {
  fetchGlobalExcludedUserIds,
  filterUnansweredPrivateUsers,
} from "@/lib/survey/unanswered-candidates";
import type {
  AwardGroupSummary,
  AwardNominationDetail,
} from "@/lib/types/award-nomination";
import { requireOwner } from "@/lib/utils/isOwner";

const WINNER_COMMENT_GROUPS = [
  "passionate_execution",
  "supreme_relations",
  "happiness_cycle",
] as const;

const WINNER_COMMENT_GROUP_LABELS: Record<
  (typeof WINNER_COMMENT_GROUPS)[number],
  string
> = {
  passionate_execution: "夢中になってやり切る賞",
  supreme_relations: "至高な人間関係を賞",
  happiness_cycle: "幸せの循環賞",
};

export async function getAwardSurveyDetail(surveyId: string) {
  await requireOwner();
  const supabase = await createServiceClient();

  const { data: survey, error } = await supabase
    .from("award_surveys")
    .select("*")
    .eq("id", surveyId)
    .single();

  if (error || !survey) {
    return null;
  }

  return survey;
}

export async function getAwardSurveyResponses(surveyId: string) {
  await requireOwner();
  const supabase = await createServiceClient();

  const { data: questions } = await supabase
    .from("award_questions")
    .select(
      "id, question_text, question_type, question_group, display_order, is_active",
    )
    .eq("is_active", true)
    .order("display_order", { ascending: true });

  let responses: Array<{
    id: string;
    question_id: string;
    text_value: string | null;
    nominee_user_id: string | null;
    created_at: string;
    user_id: string;
    is_late_submission: boolean | null;
  }> = [];
  try {
    responses = await fetchAwardResponsesForSurvey(
      supabase,
      surveyId,
      "id, question_id, text_value, nominee_user_id, created_at, user_id, is_late_submission",
      { orderByCreatedAtDesc: true },
    );
  } catch (error) {
    console.error("回答の取得エラー:", error);
    return {
      questions: questions || [],
      responses: [],
      nominationDetails: [] as AwardNominationDetail[],
      lateNominationDetails: [] as AwardNominationDetail[],
      winnerComments: [] as AwardGroupSummary[],
    };
  }

  const userIds = Array.from(
    new Set([
      ...responses.map((r) => r.user_id),
      ...responses
        .map((r) => r.nominee_user_id)
        .filter((id): id is string => id != null),
    ]),
  );
  type UserFields = {
    name: string;
    company_name: string;
    business_unit_name: string;
  };
  let userMap = new Map<string, UserFields>();
  if (userIds.length > 0) {
    const users = await fetchPrivateUsersByIds<
      {
        id: string;
        name: string;
        suspended_at: string | null;
      } & PrivateUserOrgRow
    >(
      supabase,
      userIds,
      `
        id,
        name,
        suspended_at,
        business_units (
          name,
          display_order,
          companies (
            name,
            display_order
          )
        )
      `,
    );

    userMap = new Map(
      users.map((u) => {
        const { company_name, business_unit_name } =
          companyAndBusinessUnitFromPrivateUserRow(u as PrivateUserOrgRow);
        return [
          u.id,
          { name: u.name, company_name, business_unit_name },
        ] as const;
      }),
    );
  }

  const responsesWithUsers = (responses || []).map((r) => {
    const u = userMap.get(r.user_id);
    const nominee = r.nominee_user_id
      ? userMap.get(r.nominee_user_id)
      : undefined;
    return {
      ...r,
      is_late_submission: Boolean(r.is_late_submission),
      user_name: u?.name ?? "不明",
      company_name: u?.company_name ?? "",
      business_unit_name: u?.business_unit_name ?? "",
      nominee_user_name: nominee?.name ?? null,
    };
  });

  const NOMINATION_GROUPS = new Set([
    "passionate_execution",
    "supreme_relations",
    "happiness_cycle",
    "team_value",
  ]);

  const nominationQuestions = (questions || []).filter((q) => {
    if (!q.question_group || !NOMINATION_GROUPS.has(q.question_group)) {
      return false;
    }
    if (q.question_group === "team_value") {
      return q.question_type === "text";
    }
    return q.question_type === "user_select";
  });
  const nominationQuestionIds = new Set(nominationQuestions.map((q) => q.id));
  const questionIdToGroup = new Map(
    nominationQuestions.map((q) => [q.id, q.question_group]),
  );

  const userNameById = new Map(
    Array.from(userMap.entries()).map(([id, fields]) => [id, fields.name]),
  );
  const nameIndex = buildNormalizedNameIndex(userNameById);

  function resolveNomineeKey(response: (typeof responsesWithUsers)[number]): {
    key: string;
    name: string;
  } | null {
    const question = nominationQuestions.find(
      (q) => q.id === response.question_id,
    );
    if (!question) {
      return null;
    }
    const resolved = resolveNominee(
      {
        question_id: response.question_id,
        text_value: response.text_value,
        nominee_user_id: response.nominee_user_id,
      },
      question,
      userNameById,
      nameIndex,
    );
    if (!resolved) {
      return null;
    }
    return { key: resolved.key, name: resolved.name };
  }

  function aggregateNominations(
    source: typeof responsesWithUsers,
    onlyLate: boolean | null,
  ): AwardNominationDetail[] {
    const aggregate = new Map<
      string,
      { name: string; total: number; byGroup: Partial<Record<string, number>> }
    >();

    for (const response of source) {
      if (onlyLate === true && !response.is_late_submission) continue;
      if (onlyLate === false && response.is_late_submission) continue;
      if (!nominationQuestionIds.has(response.question_id)) continue;

      const nominee = resolveNomineeKey(response);
      if (!nominee) continue;

      const group = questionIdToGroup.get(response.question_id);
      if (!group) continue;

      let row = aggregate.get(nominee.key);
      if (!row) {
        row = { name: nominee.name, total: 0, byGroup: {} };
        aggregate.set(nominee.key, row);
      }
      row.total += 1;
      row.byGroup[group] = (row.byGroup[group] || 0) + 1;
    }

    return Array.from(aggregate.values())
      .map(({ name, total, byGroup }) => ({ name, total, byGroup }))
      .sort((a, b) => b.total - a.total);
  }

  const nominationDetails = aggregateNominations(responsesWithUsers, false);
  const lateNominationDetails = aggregateNominations(responsesWithUsers, true);

  const activeQuestions = questions || [];
  const regularResponses = responsesWithUsers.filter(
    (r) => !r.is_late_submission,
  );

  function aggregateWinnerComments(): AwardGroupSummary[] {
    return WINNER_COMMENT_GROUPS.map((group) => {
      const groupQuestions = activeQuestions.filter(
        (q) => q.question_group === group,
      );
      const nominationQuestion = groupQuestions.find(
        (q) => q.question_type === "user_select",
      );
      const reasonQuestion = groupQuestions.find(
        (q) =>
          q.question_type === "textarea" &&
          nominationQuestion != null &&
          q.display_order > nominationQuestion.display_order,
      );

      const reasonByUserId = new Map<string, string>();
      if (reasonQuestion) {
        for (const response of regularResponses) {
          if (response.question_id !== reasonQuestion.id) continue;
          const comment = response.text_value?.trim();
          if (comment) {
            reasonByUserId.set(response.user_id, comment);
          }
        }
      }

      const winnerMap = new Map<
        string,
        {
          key: string;
          name: string;
          total: number;
          recommenders: { recommenderName: string; comment: string }[];
        }
      >();

      if (nominationQuestion) {
        for (const response of regularResponses) {
          if (response.question_id !== nominationQuestion.id) continue;

          const nominee = resolveNomineeKey(response);
          if (!nominee) continue;

          let row = winnerMap.get(nominee.key);
          if (!row) {
            row = {
              key: nominee.key,
              name: nominee.name,
              total: 0,
              recommenders: [],
            };
            winnerMap.set(nominee.key, row);
          }
          row.total += 1;
          row.recommenders.push({
            recommenderName: response.user_name,
            comment: reasonByUserId.get(response.user_id) ?? "",
          });
        }
      }

      const winners = Array.from(winnerMap.values())
        .map(({ key, name, total, recommenders }) => ({
          key,
          name,
          total,
          recommenders,
        }))
        .sort((a, b) => b.total - a.total);

      return {
        group,
        label: WINNER_COMMENT_GROUP_LABELS[group],
        winners,
      };
    }).filter((summary) => summary.winners.length > 0);
  }

  const winnerComments = aggregateWinnerComments();

  return {
    questions: questions || [],
    responses: responsesWithUsers,
    nominationDetails,
    lateNominationDetails,
    winnerComments,
  };
}

export async function getAwardUnansweredUsers(surveyId: string) {
  await requireOwner();
  const supabase = await createServiceClient();

  const answeredUsers = await fetchAwardResponsesForSurvey<{
    user_id: string;
  }>(supabase, surveyId, "user_id");

  const answeredUserIds = new Set(answeredUsers.map((u) => u.user_id));

  const excludedUserIds = await fetchGlobalExcludedUserIds(supabase);

  const allUsers = await fetchAllRows<{ id: string; name: string }>(
    (from, to) =>
      supabase
        .from("private_users")
        .select("id, name")
        .is("suspended_at", null)
        .range(from, to),
  );

  return filterUnansweredPrivateUsers(
    allUsers ?? [],
    answeredUserIds,
    excludedUserIds,
  );
}
