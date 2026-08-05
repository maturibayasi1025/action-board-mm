/**
 * 保存済みスナップショットから、会社横断比較と会社別レポートの表示データを組み立てる。
 * DB アクセスを含まない純関数なので、集計の意味づけはここだけを読めば追える。
 */

import {
  type SnapshotScope,
  shouldMaskForPrivacy,
} from "@/lib/admin/enps-report/build-snapshot";
import { computeResponseRate } from "@/lib/admin/enps-report/nps";

export type SnapshotRecord = {
  survey_id: string;
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

export type QuestionMetric = {
  question_id: string;
  target_count: number;
  respondent_count: number;
  response_rate: number | null;
  promoters: number;
  passives: number;
  detractors: number;
  nps_respondent_base: number | null;
  nps_imputed_base: number | null;
  /** 前月からの変化（回答者ベース）。前月データが無ければ null */
  delta_from_previous: number | null;
  /** グループ全体との差（回答者ベース） */
  delta_from_group: number | null;
  masked: boolean;
};

export type CompanyComparisonRow = {
  company_name: string;
  /** グループ全体の集計行かどうか */
  is_group: boolean;
  metrics: Record<string, QuestionMetric>;
};

function keyOf(record: {
  question_id: string;
  scope: SnapshotScope;
  company_name: string;
  business_unit_name: string;
}): string {
  return `${record.question_id}\u0000${record.scope}\u0000${record.company_name}\u0000${record.business_unit_name}`;
}

function indexByKey(records: SnapshotRecord[]): Map<string, SnapshotRecord> {
  return new Map(records.map((r) => [keyOf(r), r]));
}

function diff(current: number | null, base: number | null): number | null {
  if (current === null || base === null) return null;
  return current - base;
}

function toMetric(params: {
  record: SnapshotRecord;
  previous: SnapshotRecord | undefined;
  groupCurrent: SnapshotRecord | undefined;
}): QuestionMetric {
  const { record, previous, groupCurrent } = params;
  const masked = shouldMaskForPrivacy(record.respondent_count);

  return {
    question_id: record.question_id,
    target_count: record.target_count,
    respondent_count: record.respondent_count,
    response_rate: computeResponseRate(
      record.respondent_count,
      record.target_count,
    ),
    promoters: record.promoters,
    passives: record.passives,
    detractors: record.detractors,
    nps_respondent_base: record.nps_respondent_base,
    nps_imputed_base: record.nps_imputed_base,
    delta_from_previous: diff(
      record.nps_respondent_base,
      previous?.nps_respondent_base ?? null,
    ),
    delta_from_group: groupCurrent
      ? diff(record.nps_respondent_base, groupCurrent.nps_respondent_base)
      : null,
    masked,
  };
}

/**
 * 会社を横並びで比較する行を作る。先頭にグループ全体の行を置く。
 */
export function buildCompanyComparison(params: {
  current: SnapshotRecord[];
  previous: SnapshotRecord[];
  scoreQuestionIds: string[];
}): CompanyComparisonRow[] {
  const { current, previous, scoreQuestionIds } = params;
  const previousByKey = indexByKey(previous);
  const currentByKey = indexByKey(current);

  const groupByQuestion = new Map<string, SnapshotRecord>();
  for (const record of current) {
    if (record.scope === "group") {
      groupByQuestion.set(record.question_id, record);
    }
  }

  const buildMetrics = (
    scope: SnapshotScope,
    companyName: string,
  ): Record<string, QuestionMetric> => {
    const metrics: Record<string, QuestionMetric> = {};
    for (const questionId of scoreQuestionIds) {
      const key = keyOf({
        question_id: questionId,
        scope,
        company_name: companyName,
        business_unit_name: "",
      });
      const record = currentByKey.get(key);
      if (!record) continue;
      metrics[questionId] = toMetric({
        record,
        previous: previousByKey.get(key),
        groupCurrent:
          scope === "group" ? undefined : groupByQuestion.get(questionId),
      });
    }
    return metrics;
  };

  const rows: CompanyComparisonRow[] = [];

  const groupMetrics = buildMetrics("group", "");
  if (Object.keys(groupMetrics).length > 0) {
    rows.push({
      company_name: "グループ全体",
      is_group: true,
      metrics: groupMetrics,
    });
  }

  const companyNames = Array.from(
    new Set(
      current.filter((r) => r.scope === "company").map((r) => r.company_name),
    ),
  ).sort((a, b) => a.localeCompare(b, "ja"));

  for (const companyName of companyNames) {
    rows.push({
      company_name: companyName,
      is_group: false,
      metrics: buildMetrics("company", companyName),
    });
  }

  return rows;
}

export type BusinessUnitRow = {
  business_unit_name: string;
  metric: QuestionMetric;
};

/**
 * 会社内の事業部を、指定したスコア質問の eNPS 降順に並べる。
 * 回答者が少なく伏せる対象の行は末尾にまとめ、上位・下位の判断材料に混ぜない。
 */
export function buildBusinessUnitBreakdown(params: {
  current: SnapshotRecord[];
  previous: SnapshotRecord[];
  companyName: string;
  questionId: string;
}): BusinessUnitRow[] {
  const { current, previous, companyName, questionId } = params;
  const previousByKey = indexByKey(previous);

  const groupCurrent = current.find(
    (r) => r.scope === "group" && r.question_id === questionId,
  );

  const rows = current
    .filter(
      (r) =>
        r.scope === "business_unit" &&
        r.company_name === companyName &&
        r.question_id === questionId,
    )
    .map((record) => ({
      business_unit_name: record.business_unit_name,
      metric: toMetric({
        record,
        previous: previousByKey.get(keyOf(record)),
        groupCurrent,
      }),
    }));

  return rows.sort((a, b) => {
    if (a.metric.masked !== b.metric.masked) {
      return a.metric.masked ? 1 : -1;
    }
    const aNps = a.metric.nps_respondent_base;
    const bNps = b.metric.nps_respondent_base;
    if (aNps === null && bNps === null) {
      return a.business_unit_name.localeCompare(b.business_unit_name, "ja");
    }
    if (aNps === null) return 1;
    if (bNps === null) return -1;
    if (aNps !== bNps) return bNps - aNps;
    return a.business_unit_name.localeCompare(b.business_unit_name, "ja");
  });
}

export type BusinessUnitChange = {
  business_unit_name: string;
  delta: number;
  current_nps: number;
  respondent_count: number;
};

/**
 * 前月比の変化が大きい事業部を、改善側と悪化側に分けて返す。
 * 伏せる対象の事業部は個人が推測されうるため含めない。
 */
export function buildChangeHighlights(
  rows: BusinessUnitRow[],
  limit = 3,
): { improved: BusinessUnitChange[]; declined: BusinessUnitChange[] } {
  const changes: BusinessUnitChange[] = [];

  for (const row of rows) {
    const { metric } = row;
    if (metric.masked) continue;
    if (
      metric.delta_from_previous === null ||
      metric.nps_respondent_base === null
    ) {
      continue;
    }
    changes.push({
      business_unit_name: row.business_unit_name,
      delta: metric.delta_from_previous,
      current_nps: metric.nps_respondent_base,
      respondent_count: metric.respondent_count,
    });
  }

  const improved = changes
    .filter((c) => c.delta > 0)
    .sort((a, b) => b.delta - a.delta)
    .slice(0, limit);

  const declined = changes
    .filter((c) => c.delta < 0)
    .sort((a, b) => a.delta - b.delta)
    .slice(0, limit);

  return { improved, declined };
}

export type CompanyTrendPoint = {
  survey_id: string;
  year_month: string;
  nps_respondent_base: number | null;
  nps_imputed_base: number | null;
  response_rate: number | null;
  respondent_count: number;
  target_count: number;
  promoters: number;
  passives: number;
  detractors: number;
};

/**
 * 会社（または `null` でグループ全体）の月次推移。
 * 回答者ベースと未回答0点補完を並べて、回答率の変動と意識の変化を切り分けられるようにする。
 */
export function buildCompanyTrend(params: {
  snapshotsByMonth: {
    survey_id: string;
    year_month: string;
    records: SnapshotRecord[];
  }[];
  companyName: string | null;
  questionId: string;
}): CompanyTrendPoint[] {
  const { snapshotsByMonth, companyName, questionId } = params;
  const scope: SnapshotScope = companyName === null ? "group" : "company";

  return snapshotsByMonth.map(({ survey_id, year_month, records }) => {
    const record = records.find(
      (r) =>
        r.question_id === questionId &&
        r.scope === scope &&
        r.company_name === (companyName ?? "") &&
        r.business_unit_name === "",
    );

    if (!record) {
      return {
        survey_id,
        year_month,
        nps_respondent_base: null,
        nps_imputed_base: null,
        response_rate: null,
        respondent_count: 0,
        target_count: 0,
        promoters: 0,
        passives: 0,
        detractors: 0,
      };
    }

    return {
      survey_id,
      year_month,
      nps_respondent_base: record.nps_respondent_base,
      nps_imputed_base: record.nps_imputed_base,
      response_rate: computeResponseRate(
        record.respondent_count,
        record.target_count,
      ),
      respondent_count: record.respondent_count,
      target_count: record.target_count,
      promoters: record.promoters,
      passives: record.passives,
      detractors: record.detractors,
    };
  });
}
