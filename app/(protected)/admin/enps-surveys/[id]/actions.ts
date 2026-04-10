"use server";

import {
  type EnpsOrgDrilldownSourceRow,
  type EnpsResponseForOrgAggregate,
  aggregateNpsByBusinessUnitForScoreQuestions,
} from "@/lib/admin/enps-nps-by-business-unit";
import {
  buildImputedDrilldownRows,
  buildImputedOrgAggregateRows,
  buildPrivateUserOrgMap,
  isEnpsSurveyEnded,
  listImputedUserIdsForQuestion,
  userIdsWithScoreByQuestionId,
} from "@/lib/admin/enps-unanswered-imputation";
import {
  type PrivateUserOrgRow,
  companyAndBusinessUnitFromPrivateUserRow,
} from "@/lib/admin/private-user-org";
import { createServiceClient } from "@/lib/supabase/server";
import {
  fetchGlobalExcludedUserIds,
  filterUnansweredPrivateUsers,
} from "@/lib/survey/unanswered-candidates";
import { requireOwner } from "@/lib/utils/isOwner";
import { revalidatePath } from "next/cache";
import { getEnpsMonthlyTrendsForQuestion } from "../trends/actions";

export async function getSurveyDetail(surveyId: string) {
  await requireOwner();
  const supabase = await createServiceClient();

  const { data: survey, error } = await supabase
    .from("enps_surveys")
    .select("*")
    .eq("id", surveyId)
    .single();

  if (error || !survey) {
    return null;
  }

  return survey;
}

export async function getSurveyResponses(surveyId: string) {
  await requireOwner();
  const supabase = await createServiceClient();

  // 質問を取得
  const { data: questions } = await supabase
    .from("enps_questions")
    .select("id, question_text, question_type, display_order")
    .eq("is_active", true)
    .order("display_order", { ascending: true });

  // 回答を取得
  const { data: responses, error } = await supabase
    .from("enps_responses")
    .select(
      `
      id,
      question_id,
      score_value,
      text_value,
      created_at,
      user_id,
      is_late_submission
    `,
    )
    .eq("survey_id", surveyId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("回答の取得エラー:", error);
    return {
      questions: questions || [],
      responses: [],
      npsData: {},
      lateNpsData: {},
      uniqueRespondentCount: 0,
      npsByBusinessUnitOnTime: {},
      npsByBusinessUnitLate: {},
      imputedDrilldownRows: [] as EnpsOrgDrilldownSourceRow[],
    };
  }

  const { data: surveyRow } = await supabase
    .from("enps_surveys")
    .select("end_date")
    .eq("id", surveyId)
    .single();

  const surveyEnded =
    surveyRow?.end_date != null &&
    isEnpsSurveyEnded(surveyRow.end_date, new Date());

  const scoreByQuestionId = userIdsWithScoreByQuestionId(responses || []);

  let eligibleUserIds: Set<string> | null = null;
  let imputationUserOrgMap = new Map<
    string,
    { name: string; company_name: string; business_unit_name: string }
  >();

  if (surveyEnded) {
    const excludedUserIds = await fetchGlobalExcludedUserIds(supabase);
    const { data: allPrivateIds } = await supabase
      .from("private_users")
      .select("id");
    eligibleUserIds = new Set(
      (allPrivateIds ?? [])
        .map((r) => r.id)
        .filter((id) => !excludedUserIds.has(id)),
    );

    const scoreQuestionsForImpute = (questions || []).filter(
      (q) => q.question_type === "score_0_10",
    );
    const imputedUnion = new Set<string>();
    for (const q of scoreQuestionsForImpute) {
      const withScore = scoreByQuestionId.get(q.id) ?? new Set<string>();
      for (const uid of listImputedUserIdsForQuestion(
        eligibleUserIds,
        withScore,
      )) {
        imputedUnion.add(uid);
      }
    }

    if (imputedUnion.size > 0) {
      const { data: usersForImpute } = await supabase
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
        .in("id", Array.from(imputedUnion));

      imputationUserOrgMap = buildPrivateUserOrgMap(usersForImpute ?? []);
    }
  }

  // ユーザー情報を別途取得（RLSをバイパスするため）
  const userIds = Array.from(new Set((responses || []).map((r) => r.user_id)));
  const uniqueRespondentCount = userIds.length;

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

  // 回答データにユーザー名・所属を追加
  const responsesWithUsers = (responses || []).map((r) => {
    const u = userMap.get(r.user_id);
    return {
      ...r,
      user_name: u?.name ?? "不明",
      company_name: u?.company_name ?? "",
      business_unit_name: u?.business_unit_name ?? "",
    };
  });

  // NPS計算用のデータを準備（スコア質問のみ）
  const scoreQuestions = (questions || []).filter(
    (q) => q.question_type === "score_0_10",
  );

  type NpsBlock = {
    scores: number[];
    promoters: number;
    passives: number;
    detractors: number;
    nps: number;
  };

  const npsData: Record<string, NpsBlock> = {};
  const lateNpsData: Record<string, NpsBlock> = {};
  const imputedDrilldownRows: EnpsOrgDrilldownSourceRow[] = [];

  for (const question of scoreQuestions) {
    const onTime = responsesWithUsers.filter(
      (r) =>
        r.question_id === question.id &&
        r.score_value !== null &&
        !r.is_late_submission,
    );
    let scores = onTime.map((r) => r.score_value as number);
    if (surveyEnded && eligibleUserIds) {
      const withScore = scoreByQuestionId.get(question.id) ?? new Set<string>();
      const imputedIds = listImputedUserIdsForQuestion(
        eligibleUserIds,
        withScore,
      );
      scores = [...scores, ...Array(imputedIds.length).fill(0)];
      imputedDrilldownRows.push(
        ...buildImputedDrilldownRows(
          question.id,
          imputedIds,
          imputationUserOrgMap,
        ),
      );
    }
    const promoters = scores.filter((s) => s >= 9).length;
    const passives = scores.filter((s) => s >= 7 && s < 9).length;
    const detractors = scores.filter((s) => s < 7).length;
    const total = scores.length;
    const nps =
      total > 0 ? Math.round(((promoters - detractors) / total) * 100) : 0;
    npsData[question.id] = {
      scores,
      promoters,
      passives,
      detractors,
      nps,
    };
  }

  for (const question of scoreQuestions) {
    const late = responsesWithUsers.filter(
      (r) =>
        r.question_id === question.id &&
        r.score_value !== null &&
        r.is_late_submission,
    );
    const scores = late.map((r) => r.score_value as number);
    const promoters = scores.filter((s) => s >= 9).length;
    const passives = scores.filter((s) => s >= 7 && s < 9).length;
    const detractors = scores.filter((s) => s < 7).length;
    const total = scores.length;
    const nps =
      total > 0 ? Math.round(((promoters - detractors) / total) * 100) : 0;
    lateNpsData[question.id] = {
      scores,
      promoters,
      passives,
      detractors,
      nps,
    };
  }

  const orgSource: EnpsResponseForOrgAggregate[] = responsesWithUsers.map(
    (r) => ({
      question_id: r.question_id,
      user_id: r.user_id,
      score_value: r.score_value,
      is_late_submission: r.is_late_submission,
      created_at: r.created_at,
      company_name: r.company_name,
      business_unit_name: r.business_unit_name,
    }),
  );

  const orgOnlyForImpute = new Map<
    string,
    { company_name: string; business_unit_name: string }
  >();
  for (const [id, v] of Array.from(imputationUserOrgMap.entries())) {
    orgOnlyForImpute.set(id, {
      company_name: v.company_name,
      business_unit_name: v.business_unit_name,
    });
  }

  let orgSourceForOnTime: EnpsResponseForOrgAggregate[] = orgSource;
  if (surveyEnded && eligibleUserIds) {
    const extra: EnpsResponseForOrgAggregate[] = [];
    for (const q of scoreQuestions) {
      const withScore = scoreByQuestionId.get(q.id) ?? new Set<string>();
      const imputedIds = listImputedUserIdsForQuestion(
        eligibleUserIds,
        withScore,
      );
      extra.push(
        ...buildImputedOrgAggregateRows(q.id, imputedIds, orgOnlyForImpute),
      );
    }
    orgSourceForOnTime = [...orgSource, ...extra];
  }

  const scoreQuestionIds = scoreQuestions.map((q) => q.id);
  const npsByBusinessUnitOnTime = aggregateNpsByBusinessUnitForScoreQuestions(
    orgSourceForOnTime,
    scoreQuestionIds,
    "on_time",
  );
  const npsByBusinessUnitLate = aggregateNpsByBusinessUnitForScoreQuestions(
    orgSource,
    scoreQuestionIds,
    "late_only",
  );

  return {
    questions: questions || [],
    responses: responsesWithUsers || [],
    npsData,
    lateNpsData,
    uniqueRespondentCount,
    npsByBusinessUnitOnTime,
    npsByBusinessUnitLate,
    imputedDrilldownRows,
  };
}

export async function getUnansweredUsers(surveyId: string) {
  await requireOwner();
  const supabase = await createServiceClient();

  // 回答したユーザーIDを取得
  const { data: answeredUsers } = await supabase
    .from("enps_responses")
    .select("user_id")
    .eq("survey_id", surveyId);

  const answeredUserIds = new Set(answeredUsers?.map((u) => u.user_id) || []);

  const excludedUserIds = await fetchGlobalExcludedUserIds(supabase);

  // 全ユーザーを取得
  const { data: allUsers } = await supabase
    .from("private_users")
    .select("id, name");

  return filterUnansweredPrivateUsers(
    allUsers ?? [],
    answeredUserIds,
    excludedUserIds,
  );
}

export async function getAllSurveysNps() {
  await requireOwner();
  const supabase = await createServiceClient();

  const { data: firstScoreQuestion } = await supabase
    .from("enps_questions")
    .select("id")
    .eq("is_active", true)
    .eq("question_type", "score_0_10")
    .order("display_order", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!firstScoreQuestion) {
    return [];
  }

  const series = await getEnpsMonthlyTrendsForQuestion(firstScoreQuestion.id);
  return series.map((item) => ({
    survey_id: item.survey_id,
    year_month: item.year_month,
    title: item.title,
    nps: item.nps,
  }));
}
