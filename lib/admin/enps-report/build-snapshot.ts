/**
 * 1 サーベイぶんの回答と所属から、確定保存用のスナップショット行を組み立てる純関数。
 *
 * 所属は呼び出し側が解決した「集計時点の値」を受け取り、そのまま文字列として凍結する。
 * これにより、あとから異動が起きても保存済みの過去月の数値は変化しない。
 */

import { computeNps, dedupeLatestByUser } from "@/lib/admin/enps-report/nps";

export type SnapshotScope = "group" | "company" | "business_unit";

export const UNASSIGNED_ORG_LABEL = "未設定";

export type EnpsSnapshotTarget = {
  user_id: string;
  company_name: string;
  business_unit_name: string;
};

export type EnpsSnapshotResponse = {
  question_id: string;
  user_id: string;
  score_value: number | null;
  is_late_submission: boolean | null | undefined;
  created_at: string;
};

export type EnpsSnapshotRow = {
  question_id: string;
  scope: SnapshotScope;
  company_name: string;
  business_unit_name: string;
  target_count: number;
  respondent_count: number;
  promoters: number;
  passives: number;
  detractors: number;
  nps_respondent_base: number | null;
  nps_imputed_base: number | null;
};

function normalizeOrgName(value: string): string {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : UNASSIGNED_ORG_LABEL;
}

type Bucket = {
  scope: SnapshotScope;
  company_name: string;
  business_unit_name: string;
  target_count: number;
  scores: number[];
};

function bucketKey(
  scope: SnapshotScope,
  companyName: string,
  businessUnitName: string,
): string {
  return `${scope}\u0000${companyName}\u0000${businessUnitName}`;
}

/**
 * 対象者（グローバル除外を引いた母数）を基準に集計する。
 * 除外設定のユーザーは母数からも回答からも外れるため、対象者数・回答者数・未回答補完が常に整合する。
 */
export function buildEnpsSnapshotRows(params: {
  scoreQuestionIds: string[];
  targets: EnpsSnapshotTarget[];
  responses: EnpsSnapshotResponse[];
  /** 締切後のみ true。回答受付中に未回答を批判者として数えると途中経過が実態より低く出る */
  includeImputed: boolean;
}): EnpsSnapshotRow[] {
  const { scoreQuestionIds, targets, responses, includeImputed } = params;
  const rows: EnpsSnapshotRow[] = [];

  for (const questionId of scoreQuestionIds) {
    const onTime = responses.filter(
      (r) =>
        r.question_id === questionId &&
        r.score_value !== null &&
        !r.is_late_submission,
    );
    const scoreByUser = new Map<string, number>();
    for (const row of dedupeLatestByUser(onTime)) {
      scoreByUser.set(row.user_id, row.score_value as number);
    }

    const buckets = new Map<string, Bucket>();
    const addToBucket = (
      scope: SnapshotScope,
      companyName: string,
      businessUnitName: string,
      score: number | undefined,
    ) => {
      const key = bucketKey(scope, companyName, businessUnitName);
      let bucket = buckets.get(key);
      if (!bucket) {
        bucket = {
          scope,
          company_name: companyName,
          business_unit_name: businessUnitName,
          target_count: 0,
          scores: [],
        };
        buckets.set(key, bucket);
      }
      bucket.target_count += 1;
      if (score !== undefined) {
        bucket.scores.push(score);
      }
    };

    for (const target of targets) {
      const company = normalizeOrgName(target.company_name);
      const unit = normalizeOrgName(target.business_unit_name);
      const score = scoreByUser.get(target.user_id);

      addToBucket("group", "", "", score);
      addToBucket("company", company, "", score);
      addToBucket("business_unit", company, unit, score);
    }

    for (const bucket of Array.from(buckets.values())) {
      const respondentBase = computeNps(bucket.scores);
      const unanswered = Math.max(
        0,
        bucket.target_count - bucket.scores.length,
      );
      const imputedBase = includeImputed
        ? computeNps([...bucket.scores, ...Array(unanswered).fill(0)])
        : null;

      rows.push({
        question_id: questionId,
        scope: bucket.scope,
        company_name: bucket.company_name,
        business_unit_name: bucket.business_unit_name,
        target_count: bucket.target_count,
        respondent_count: respondentBase.respondent_count,
        promoters: respondentBase.promoters,
        passives: respondentBase.passives,
        detractors: respondentBase.detractors,
        nps_respondent_base: respondentBase.nps,
        nps_imputed_base: imputedBase ? imputedBase.nps : null,
      });
    }
  }

  return sortSnapshotRows(rows);
}

const SCOPE_ORDER: Record<SnapshotScope, number> = {
  group: 0,
  company: 1,
  business_unit: 2,
};

export function sortSnapshotRows(rows: EnpsSnapshotRow[]): EnpsSnapshotRow[] {
  return [...rows].sort((a, b) => {
    if (a.question_id !== b.question_id) {
      return a.question_id.localeCompare(b.question_id);
    }
    if (a.scope !== b.scope) {
      return SCOPE_ORDER[a.scope] - SCOPE_ORDER[b.scope];
    }
    const company = a.company_name.localeCompare(b.company_name, "ja");
    if (company !== 0) return company;
    return a.business_unit_name.localeCompare(b.business_unit_name, "ja");
  });
}

/**
 * 回答者が少ないバケットは個人が特定されうるため、レポート表示前に伏せる。
 */
export const MIN_DISCLOSURE_RESPONDENTS = 5;

export function shouldMaskForPrivacy(
  respondentCount: number,
  threshold: number = MIN_DISCLOSURE_RESPONDENTS,
): boolean {
  return respondentCount > 0 && respondentCount < threshold;
}
