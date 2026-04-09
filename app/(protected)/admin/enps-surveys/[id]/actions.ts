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
import { requireOwner } from "@/lib/utils/isOwner";
import { revalidatePath } from "next/cache";

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
    };
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

  for (const question of scoreQuestions) {
    const onTime = responsesWithUsers.filter(
      (r) =>
        r.question_id === question.id &&
        r.score_value !== null &&
        !r.is_late_submission,
    );
    const scores = onTime.map((r) => r.score_value as number);
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

  return {
    questions: questions || [],
    responses: responsesWithUsers || [],
    npsData,
    lateNpsData,
    uniqueRespondentCount,
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

  // 全アンケートを取得
  const { data: surveys } = await supabase
    .from("enps_surveys")
    .select("id, title, year_month, created_at")
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  if (!surveys || surveys.length === 0) {
    return [];
  }

  // 各アンケートのNPSを計算（最初のスコア質問のみ）
  const surveysNps = await Promise.all(
    surveys.map(async (survey) => {
      const { data: firstScoreQuestion } = await supabase
        .from("enps_questions")
        .select("id")
        .eq("is_active", true)
        .eq("question_type", "score_0_10")
        .order("display_order", { ascending: true })
        .limit(1)
        .single();

      if (!firstScoreQuestion) {
        return {
          survey_id: survey.id,
          year_month: survey.year_month,
          title: survey.title,
          nps: null,
        };
      }

      const { data: responses } = await supabase
        .from("enps_responses")
        .select("score_value")
        .eq("survey_id", survey.id)
        .eq("question_id", firstScoreQuestion.id)
        .eq("is_late_submission", false)
        .not("score_value", "is", null);

      if (!responses || responses.length === 0) {
        return {
          survey_id: survey.id,
          year_month: survey.year_month,
          title: survey.title,
          nps: null,
        };
      }

      const scores = responses
        .filter(
          (r): r is typeof r & { score_value: number } =>
            r.score_value !== null,
        )
        .map((r) => r.score_value);
      const promoters = scores.filter((s) => s >= 9).length;
      const detractors = scores.filter((s) => s < 7).length;
      const total = scores.length;
      const nps =
        total > 0 ? Math.round(((promoters - detractors) / total) * 100) : 0;

      return {
        survey_id: survey.id,
        year_month: survey.year_month,
        title: survey.title,
        nps,
      };
    }),
  );

  return surveysNps;
}
