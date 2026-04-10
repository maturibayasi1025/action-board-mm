"use server";

import {
  computeNpsBreakdownFromScores,
  dedupeLatestScorePerUser,
} from "@/lib/admin/enps-monthly-series";
import {
  filterUserIdsByOrg,
  isEnpsSurveyEnded,
  listImputedUserIdsForQuestion,
} from "@/lib/admin/enps-unanswered-imputation";
import {
  type PrivateUserOrgRow,
  companyAndBusinessUnitFromPrivateUserRow,
} from "@/lib/admin/private-user-org";
import { createServiceClient } from "@/lib/supabase/server";
import { fetchGlobalExcludedUserIds } from "@/lib/survey/unanswered-candidates";
import { requireOwner } from "@/lib/utils/isOwner";

export type EnpsMonthlyPoint = {
  survey_id: string;
  year_month: string;
  title: string;
  respondent_count: number;
  promoters: number;
  passives: number;
  detractors: number;
  nps: number | null;
};

export type EnpsOrgFilter = {
  companyName: string;
  businessUnitName: string;
};

export async function getActiveScoreQuestions() {
  await requireOwner();
  const supabase = await createServiceClient();

  const { data } = await supabase
    .from("enps_questions")
    .select("id, question_text, display_order")
    .eq("is_active", true)
    .eq("question_type", "score_0_10")
    .order("display_order", { ascending: true });

  return data ?? [];
}

export async function getEnpsMonthlyTrendsForQuestion(
  questionId: string,
  orgFilter?: EnpsOrgFilter | null,
): Promise<EnpsMonthlyPoint[]> {
  await requireOwner();
  const supabase = await createServiceClient();

  const { data: surveys } = await supabase
    .from("enps_surveys")
    .select("id, title, year_month, created_at, end_date")
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  if (!surveys || surveys.length === 0) {
    return [];
  }

  const now = new Date();
  const excludedUserIds = await fetchGlobalExcludedUserIds(supabase);
  const { data: allPrivateIds } = await supabase
    .from("private_users")
    .select("id");
  const eligibleUserIds = new Set(
    (allPrivateIds ?? [])
      .map((r) => r.id)
      .filter((id) => !excludedUserIds.has(id)),
  );

  const surveyIds = surveys.map((s) => s.id);

  const { data: allResponses, error } = await supabase
    .from("enps_responses")
    .select("survey_id, user_id, score_value, is_late_submission, created_at")
    .in("survey_id", surveyIds)
    .eq("question_id", questionId)
    .not("score_value", "is", null);

  if (error) {
    console.error("getEnpsMonthlyTrendsForQuestion responses error:", error);
    return [];
  }

  const onTimeRows = (allResponses || []).flatMap((r) => {
    if (
      r.score_value === null ||
      r.user_id == null ||
      r.survey_id == null ||
      r.is_late_submission
    ) {
      return [];
    }
    return [
      {
        survey_id: r.survey_id,
        user_id: r.user_id,
        score_value: r.score_value,
        created_at: r.created_at,
      },
    ];
  });

  const userOrgMap = new Map<string, { company: string; bu: string }>();
  const eligibleOrgMap = new Map<
    string,
    { company_name: string; business_unit_name: string }
  >();
  if (orgFilter) {
    const userIds = Array.from(new Set(onTimeRows.map((r) => r.user_id)));
    if (userIds.length > 0) {
      const { data: users } = await supabase
        .from("private_users")
        .select(
          `
        id,
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

      for (const u of users || []) {
        const { company_name, business_unit_name } =
          companyAndBusinessUnitFromPrivateUserRow(u as PrivateUserOrgRow);
        userOrgMap.set(u.id, {
          company: company_name.trim(),
          bu: business_unit_name.trim(),
        });
      }
    }

    const eligibleIds = Array.from(eligibleUserIds);
    if (eligibleIds.length > 0) {
      const { data: eligibleUsers } = await supabase
        .from("private_users")
        .select(
          `
        id,
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
        .in("id", eligibleIds);

      for (const u of eligibleUsers || []) {
        const { company_name, business_unit_name } =
          companyAndBusinessUnitFromPrivateUserRow(u as PrivateUserOrgRow);
        eligibleOrgMap.set(u.id, {
          company_name: company_name.trim(),
          business_unit_name: business_unit_name.trim(),
        });
      }
    }
  }

  const targetCo = orgFilter?.companyName.trim() ?? "";
  const targetBu = orgFilter?.businessUnitName.trim() ?? "";

  const bySurvey = new Map<
    string,
    { user_id: string; score_value: number; created_at: string }[]
  >();

  for (const r of onTimeRows) {
    if (orgFilter) {
      const org = userOrgMap.get(r.user_id);
      if (!org) continue;
      if (org.company !== targetCo || org.bu !== targetBu) continue;
    }
    const list = bySurvey.get(r.survey_id) ?? [];
    list.push({
      user_id: r.user_id,
      score_value: r.score_value,
      created_at: r.created_at,
    });
    bySurvey.set(r.survey_id, list);
  }

  const out: EnpsMonthlyPoint[] = [];

  for (const survey of surveys) {
    const group = bySurvey.get(survey.id) ?? [];
    let scores = dedupeLatestScorePerUser(group);

    const surveyEnded =
      survey.end_date != null && isEnpsSurveyEnded(survey.end_date, now);

    if (surveyEnded) {
      const withScore = new Set<string>();
      for (const r of allResponses || []) {
        if (r.survey_id !== survey.id) continue;
        if (r.score_value !== null && r.user_id) {
          withScore.add(r.user_id);
        }
      }
      let imputedIds = listImputedUserIdsForQuestion(
        eligibleUserIds,
        withScore,
      );

      if (orgFilter && imputedIds.length > 0) {
        imputedIds = filterUserIdsByOrg(
          imputedIds,
          eligibleOrgMap,
          targetCo,
          targetBu,
        );
      }

      scores = [...scores, ...Array(imputedIds.length).fill(0)];
    }

    const m = computeNpsBreakdownFromScores(scores);
    out.push({
      survey_id: survey.id,
      year_month: survey.year_month,
      title: survey.title,
      respondent_count: m.respondent_count,
      promoters: m.promoters,
      passives: m.passives,
      detractors: m.detractors,
      nps: m.nps,
    });
  }

  return out;
}
