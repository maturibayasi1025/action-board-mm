/**
 * eNPS スコア質問を事業部（＋会社）別に集計する。
 * 同一ユーザー・同一質問に複数行ある場合は created_at が最新の1件のみを採用（回答一覧と同じ考え方）。
 */

export type EnpsOrgNpsRow = {
  company_name: string;
  business_unit_name: string;
  respondent_count: number;
  promoters: number;
  passives: number;
  detractors: number;
  nps: number;
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

function isNewer(a: string, b: string): boolean {
  return new Date(a).getTime() > new Date(b).getTime();
}

function dedupeLatestPerUser(
  rows: EnpsResponseForOrgAggregate[],
): EnpsResponseForOrgAggregate[] {
  const byUser = new Map<string, EnpsResponseForOrgAggregate>();
  for (const r of rows) {
    const prev = byUser.get(r.user_id);
    if (!prev || isNewer(r.created_at, prev.created_at)) {
      byUser.set(r.user_id, r);
    }
  }
  return Array.from(byUser.values());
}

function computeNpsMetrics(
  scores: number[],
): Omit<EnpsOrgNpsRow, "company_name" | "business_unit_name"> {
  const promoters = scores.filter((s) => s >= 9).length;
  const passives = scores.filter((s) => s >= 7 && s < 9).length;
  const detractors = scores.filter((s) => s < 7).length;
  const respondent_count = scores.length;
  const nps =
    respondent_count > 0
      ? Math.round(((promoters - detractors) / respondent_count) * 100)
      : 0;
  return { respondent_count, promoters, passives, detractors, nps };
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

  const deduped = dedupeLatestPerUser(filtered);

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
