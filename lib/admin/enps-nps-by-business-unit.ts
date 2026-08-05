/**
 * eNPS スコア質問を事業部（＋会社）別に集計する。
 * 同一ユーザー・同一質問に複数行ある場合は created_at が最新の1件のみを採用（回答一覧と同じ考え方）。
 */

import {
  computeNps,
  dedupeLatestByUser,
  scoreToSegment,
} from "@/lib/admin/enps-report/nps";

export type EnpsOrgNpsRow = {
  company_name: string;
  business_unit_name: string;
  respondent_count: number;
  promoters: number;
  passives: number;
  detractors: number;
  /** 回答者が 0 人のときは null（0 と区別する） */
  nps: number | null;
};

export type EnpsResponseForOrgAggregate = {
  question_id: string;
  user_id: string;
  score_value: number | null;
  is_late_submission: boolean | null | undefined;
  created_at: string;
  company_name: string;
  business_unit_name: string;
};

function computeNpsMetrics(
  scores: number[],
): Omit<EnpsOrgNpsRow, "company_name" | "business_unit_name"> {
  return computeNps(scores);
}

/**
 * 単一スコア質問について、会社×事業部バケットごとに NPS を算出する。
 */
export function aggregateNpsByBusinessUnitForQuestion(
  responses: EnpsResponseForOrgAggregate[],
  questionId: string,
  mode: "on_time" | "late_only",
): EnpsOrgNpsRow[] {
  const filtered = responses.filter((r) => {
    if (r.question_id !== questionId) return false;
    if (r.score_value === null) return false;
    const late = Boolean(r.is_late_submission);
    if (mode === "on_time") return !late;
    return late;
  });

  const deduped = dedupeLatestByUser(filtered);

  const byBucket = new Map<
    string,
    { company_name: string; business_unit_name: string; scores: number[] }
  >();

  for (const r of deduped) {
    const co = r.company_name.trim();
    const bu = r.business_unit_name.trim();
    const key = `${co}\0${bu}`;
    let bucket = byBucket.get(key);
    if (!bucket) {
      bucket = { company_name: co, business_unit_name: bu, scores: [] };
      byBucket.set(key, bucket);
    }
    bucket.scores.push(r.score_value as number);
  }

  const rows: EnpsOrgNpsRow[] = [];
  for (const bucket of Array.from(byBucket.values())) {
    const metrics = computeNpsMetrics(bucket.scores);
    rows.push({
      company_name: bucket.company_name,
      business_unit_name: bucket.business_unit_name,
      ...metrics,
    });
  }

  rows.sort((a, b) => {
    const unsetA = !a.company_name && !a.business_unit_name;
    const unsetB = !b.company_name && !b.business_unit_name;
    if (unsetA !== unsetB) return unsetA ? 1 : -1;
    const c = a.company_name.localeCompare(b.company_name, "ja");
    if (c !== 0) return c;
    return a.business_unit_name.localeCompare(b.business_unit_name, "ja");
  });

  return rows;
}

export function aggregateNpsByBusinessUnitForScoreQuestions(
  responses: EnpsResponseForOrgAggregate[],
  scoreQuestionIds: string[],
  mode: "on_time" | "late_only",
): Record<string, EnpsOrgNpsRow[]> {
  const out: Record<string, EnpsOrgNpsRow[]> = {};
  for (const qid of scoreQuestionIds) {
    out[qid] = aggregateNpsByBusinessUnitForQuestion(responses, qid, mode);
  }
  return out;
}

/** 事業部別ドリルダウン用（ユーザー名付き）。集計と同じ重複排除・期限内/期限後の扱いに合わせる */
export type EnpsOrgDrilldownSourceRow = {
  question_id: string;
  user_id: string;
  user_name: string;
  score_value: number;
  company_name: string;
  business_unit_name: string;
  is_late_submission: boolean | null | undefined;
  created_at: string;
};

export type EnpsOrgDrilldownSegment =
  | "promoter"
  | "passive"
  | "detractor"
  | "all";

/**
 * 会社×事業部バケット内の、指セグメントに該当する回答者（最新1件／ユーザー）を返す。
 */
export function listOrgBucketDrilldown(
  rows: EnpsOrgDrilldownSourceRow[],
  questionId: string,
  mode: "on_time" | "late_only",
  companyName: string,
  businessUnitName: string,
  segment: EnpsOrgDrilldownSegment,
): { user_id: string; user_name: string; score_value: number }[] {
  const co = companyName.trim();
  const bu = businessUnitName.trim();

  const filtered = rows.filter((r) => {
    if (r.question_id !== questionId) return false;
    const late = Boolean(r.is_late_submission);
    if (mode === "on_time") {
      if (late) return false;
    } else if (!late) {
      return false;
    }
    const rCo = r.company_name.trim();
    const rBu = r.business_unit_name.trim();
    return rCo === co && rBu === bu;
  });

  const deduped = dedupeLatestByUser(filtered);
  const withSegment =
    segment === "all"
      ? deduped
      : deduped.filter((r) => scoreToSegment(r.score_value) === segment);

  withSegment.sort((a, b) => {
    if (b.score_value !== a.score_value) return b.score_value - a.score_value;
    return a.user_name.localeCompare(b.user_name, "ja");
  });

  return withSegment.map((r) => ({
    user_id: r.user_id,
    user_name: r.user_name,
    score_value: r.score_value,
  }));
}
