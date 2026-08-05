"use server";

import {
  computeNpsBreakdownFromScores,
  dedupeLatestScorePerUser,
} from "@/lib/admin/enps-monthly-series";
import {
  fetchAllPrivateUserIds,
  fetchOrgMapForUserIds,
} from "@/lib/admin/enps-report/data-access";
import { fetchAllRows } from "@/lib/admin/enps-report/fetch-all";
import {
  filterUserIdsByOrg,
  isEnpsSurveyEnded,
  listImputedUserIdsForQuestion,
} from "@/lib/admin/enps-unanswered-imputation";
import { createServiceClient } from "@/lib/supabase/server";
import { fetchGlobalExcludedUserIds } from "@/lib/survey/unanswered-candidates";
import { requireOwner } from "@/lib/utils/isOwner";

type MonthlyResponseRow = {
  survey_id: string;
  user_id: string;
  score_value: number | null;
  is_late_submission: boolean | null;
  created_at: string;
};

type SingleSurveyResponseRow = {
  user_id: string;
  score_value: number | null;
  is_late_submission: boolean | null;
  created_at: string;
};

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

/** `businessUnitName` 省略時は当該会社の全事業部を対象とする */
export type EnpsOrgFilter = {
  companyName: string;
  businessUnitName?: string;
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
  const allPrivateIds = await fetchAllPrivateUserIds(supabase);
  const eligibleUserIds = new Set(
    allPrivateIds.filter((id) => !excludedUserIds.has(id)),
  );

  const surveyIds = surveys.map((s) => s.id);

  let allResponses: MonthlyResponseRow[];
  try {
    allResponses = await fetchAllRows<MonthlyResponseRow>((from, to) =>
      supabase
        .from("enps_responses")
        .select(
          "survey_id, user_id, score_value, is_late_submission, created_at",
        )
        .in("survey_id", surveyIds)
        .eq("question_id", questionId)
        .not("score_value", "is", null)
        .range(from, to),
    );
  } catch (error) {
    console.error("getEnpsMonthlyTrendsForQuestion responses error:", error);
    return [];
  }

  const onTimeRows = allResponses.flatMap((r) => {
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
    const respondentOrgs = await fetchOrgMapForUserIds(supabase, userIds);
    for (const [id, org] of Array.from(respondentOrgs.entries())) {
      userOrgMap.set(id, {
        company: org.company_name.trim(),
        bu: org.business_unit_name.trim(),
      });
    }

    const eligibleOrgs = await fetchOrgMapForUserIds(
      supabase,
      Array.from(eligibleUserIds),
    );
    for (const [id, org] of Array.from(eligibleOrgs.entries())) {
      eligibleOrgMap.set(id, {
        company_name: org.company_name.trim(),
        business_unit_name: org.business_unit_name.trim(),
      });
    }
  }

  const targetCo = orgFilter?.companyName.trim() ?? "";
  const targetBu = orgFilter?.businessUnitName?.trim() ?? "";
  const companyOnlyFilter = Boolean(orgFilter && targetBu.length === 0);

  const bySurvey = new Map<
    string,
    { user_id: string; score_value: number; created_at: string }[]
  >();

  for (const r of onTimeRows) {
    if (orgFilter) {
      const org = userOrgMap.get(r.user_id);
      if (!org) continue;
      if (org.company !== targetCo) continue;
      if (!companyOnlyFilter && org.bu !== targetBu) continue;
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
          companyOnlyFilter ? null : targetBu,
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

export type EnpsMonthlyScoreExportRow = {
  user_id: string;
  user_name: string;
  company_name: string;
  business_unit_name: string;
  score_0_10: number;
  row_kind: "on_time" | "imputed_zero";
  responded_at: string | null;
};

export type EnpsMonthlyScoreExportResult =
  | {
      ok: true;
      survey: { year_month: string; title: string };
      rows: EnpsMonthlyScoreExportRow[];
    }
  | { ok: false; error: string };

/**
 * 1ヶ月分のスコア明細CSV用。推移画面と同一の集計前提（期限内の最新1件／終了済みのみ未回答を0として補完）。
 */
export async function getEnpsMonthlyScoreExportRows(
  questionId: string,
  surveyId: string,
  orgFilter?: EnpsOrgFilter | null,
): Promise<EnpsMonthlyScoreExportResult> {
  await requireOwner();
  const supabase = await createServiceClient();

  const { data: survey, error: surveyError } = await supabase
    .from("enps_surveys")
    .select("id, title, year_month, end_date")
    .eq("id", surveyId)
    .eq("is_active", true)
    .maybeSingle();

  if (surveyError || !survey) {
    return { ok: false, error: "アンケートが見つからないか、無効です。" };
  }

  let allResponses: SingleSurveyResponseRow[];
  try {
    allResponses = await fetchAllRows<SingleSurveyResponseRow>((from, to) =>
      supabase
        .from("enps_responses")
        .select("user_id, score_value, is_late_submission, created_at")
        .eq("survey_id", surveyId)
        .eq("question_id", questionId)
        .not("score_value", "is", null)
        .range(from, to),
    );
  } catch (error) {
    console.error("getEnpsMonthlyScoreExportRows:", error);
    return { ok: false, error: "回答の取得に失敗しました。" };
  }

  const now = new Date();
  const onTimeRows = allResponses.flatMap((r) => {
    if (r.score_value === null || r.user_id == null || r.is_late_submission) {
      return [];
    }
    return [
      {
        user_id: r.user_id,
        score_value: r.score_value,
        created_at: r.created_at,
      },
    ];
  });

  const targetCo = orgFilter?.companyName.trim() ?? "";
  const targetBu = orgFilter?.businessUnitName?.trim() ?? "";
  const companyOnlyFilter = Boolean(orgFilter && targetBu.length === 0);

  const userOrgMap = new Map<string, { company: string; bu: string }>();
  const eligibleOrgMap = new Map<
    string,
    { company_name: string; business_unit_name: string }
  >();

  const excludedUserIds = await fetchGlobalExcludedUserIds(supabase);
  const allPrivateIds = await fetchAllPrivateUserIds(supabase);
  const eligibleUserIds = new Set(
    allPrivateIds.filter((id) => !excludedUserIds.has(id)),
  );

  if (orgFilter) {
    const userIds = Array.from(new Set(onTimeRows.map((r) => r.user_id)));
    const respondentOrgs = await fetchOrgMapForUserIds(supabase, userIds);
    for (const [id, org] of Array.from(respondentOrgs.entries())) {
      userOrgMap.set(id, {
        company: org.company_name.trim(),
        bu: org.business_unit_name.trim(),
      });
    }

    const eligibleOrgs = await fetchOrgMapForUserIds(
      supabase,
      Array.from(eligibleUserIds),
    );
    for (const [id, org] of Array.from(eligibleOrgs.entries())) {
      eligibleOrgMap.set(id, {
        company_name: org.company_name.trim(),
        business_unit_name: org.business_unit_name.trim(),
      });
    }
  }

  let scopedOnTime = onTimeRows;
  if (orgFilter) {
    scopedOnTime = onTimeRows.filter((r) => {
      const org = userOrgMap.get(r.user_id);
      if (!org) return false;
      if (org.company !== targetCo) return false;
      if (!companyOnlyFilter && org.bu !== targetBu) return false;
      return true;
    });
  }

  const latestOnTimeByUser = new Map<
    string,
    { score_value: number; created_at: string }
  >();
  for (const r of scopedOnTime) {
    const prev = latestOnTimeByUser.get(r.user_id);
    if (
      !prev ||
      new Date(r.created_at).getTime() > new Date(prev.created_at).getTime()
    ) {
      latestOnTimeByUser.set(r.user_id, {
        score_value: r.score_value,
        created_at: r.created_at,
      });
    }
  }

  const onTimeExports: Omit<EnpsMonthlyScoreExportRow, "user_name">[] =
    Array.from(latestOnTimeByUser.entries()).map(([user_id, row]) => ({
      user_id,
      company_name: "",
      business_unit_name: "",
      score_0_10: row.score_value,
      row_kind: "on_time" as const,
      responded_at: row.created_at,
    }));

  const surveyEnded =
    survey.end_date != null && isEnpsSurveyEnded(survey.end_date, now);

  let imputedIds: string[] = [];
  if (surveyEnded) {
    const withScore = new Set<string>();
    for (const r of allResponses || []) {
      if (r.score_value !== null && r.user_id) {
        withScore.add(r.user_id);
      }
    }
    imputedIds = listImputedUserIdsForQuestion(eligibleUserIds, withScore);

    if (orgFilter && imputedIds.length > 0) {
      imputedIds = filterUserIdsByOrg(
        imputedIds,
        eligibleOrgMap,
        targetCo,
        companyOnlyFilter ? null : targetBu,
      );
    }
  }

  const imputedExports: Omit<EnpsMonthlyScoreExportRow, "user_name">[] =
    imputedIds.map((user_id) => ({
      user_id,
      company_name: "",
      business_unit_name: "",
      score_0_10: 0,
      row_kind: "imputed_zero" as const,
      responded_at: null,
    }));

  const merged = [...onTimeExports, ...imputedExports];
  const allIds = Array.from(new Set(merged.map((r) => r.user_id)));

  const nameOrgByUser = new Map<
    string,
    { user_name: string; company_name: string; business_unit_name: string }
  >();

  const exportOrgs = await fetchOrgMapForUserIds(supabase, allIds);
  for (const [id, org] of Array.from(exportOrgs.entries())) {
    nameOrgByUser.set(id, {
      user_name: org.name,
      company_name: org.company_name.trim(),
      business_unit_name: org.business_unit_name.trim(),
    });
  }

  const rows: EnpsMonthlyScoreExportRow[] = merged.map((r) => {
    const meta = nameOrgByUser.get(r.user_id);
    return {
      user_id: r.user_id,
      user_name: meta?.user_name ?? "",
      company_name: meta?.company_name ?? r.company_name,
      business_unit_name: meta?.business_unit_name ?? r.business_unit_name,
      score_0_10: r.score_0_10,
      row_kind: r.row_kind,
      responded_at: r.responded_at,
    };
  });

  rows.sort((a, b) => {
    const kindDiff =
      (a.row_kind === "on_time" ? 0 : 1) - (b.row_kind === "on_time" ? 0 : 1);
    if (kindDiff !== 0) return kindDiff;
    return a.user_id.localeCompare(b.user_id);
  });

  return {
    ok: true,
    survey: { year_month: survey.year_month, title: survey.title },
    rows,
  };
}
