"use server";

import {
  type PrivateUserOrgRow,
  companyAndBusinessUnitFromPrivateUserRow,
} from "@/lib/admin/private-user-org";
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

  const { data: responses, error } = await supabase
    .from("award_responses")
    .select(
      "id, question_id, text_value, nominee_user_id, created_at, user_id, is_late_submission",
    )
    .eq("survey_id", surveyId)
    .order("created_at", { ascending: false });

  if (error) {
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
      ...(responses || []).map((r) => r.user_id),
      ...(responses || [])
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
    const { data: users } = await supabase
      .from("private_users")
      .select(
        `
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
      `,
      )
      .in("id", userIds);

    userMap = new Map(
      (users || []).map((u) => {
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

  function resolveNomineeKey(response: (typeof responsesWithUsers)[number]): {
    key: string;
    name: string;
  } | null {
    if (response.nominee_user_id) {
      const name =
        response.nominee_user_name ??
        userMap.get(response.nominee_user_id)?.name ??
        "不明";
      return { key: `uid:${response.nominee_user_id}`, name };
    }
    const legacy = response.text_value?.trim();
    if (legacy) {
      return { key: `text:${legacy}`, name: legacy };
    }
    return null;
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
            row = { name: nominee.name, total: 0, recommenders: [] };
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
        .map(({ name, total, recommenders }) => ({
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

  const { data: answeredUsers } = await supabase
    .from("award_responses")
    .select("user_id")
    .eq("survey_id", surveyId);

  const answeredUserIds = new Set(answeredUsers?.map((u) => u.user_id) || []);

  const excludedUserIds = await fetchGlobalExcludedUserIds(supabase);

  const { data: allUsers } = await supabase
    .from("private_users")
    .select("id, name");

  return filterUnansweredPrivateUsers(
    allUsers ?? [],
    answeredUserIds,
    excludedUserIds,
  );
}
