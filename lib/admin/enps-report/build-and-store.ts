/**
 * 1 サーベイぶんのスナップショットを計算して保存する。
 * 月次バッチから呼ぶことを想定し、Supabase クライアントは引数で受け取る。
 */

import {
  type EnpsSnapshotRow,
  buildEnpsSnapshotRows,
} from "@/lib/admin/enps-report/build-snapshot";
import {
  fetchScoreResponsesForSurvey,
  fetchSnapshotTargets,
} from "@/lib/admin/enps-report/data-access";
import { fetchAllRows } from "@/lib/admin/enps-report/fetch-all";
import { isEnpsSurveyEnded } from "@/lib/admin/enps-unanswered-imputation";
import type { Database } from "@/lib/types/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

export type SurveyForSnapshot = {
  id: string;
  year_month: string;
  title: string;
  end_date: string;
};

export type BuildSnapshotResult = {
  survey: SurveyForSnapshot;
  rowCount: number;
  surveyEnded: boolean;
  skipped: boolean;
  reason?: string;
};

export async function fetchActiveScoreQuestionIds(
  supabase: SupabaseClient<Database>,
): Promise<string[]> {
  const rows = await fetchAllRows<{ id: string; display_order: number }>(
    (from, to) =>
      supabase
        .from("enps_questions")
        .select("id, display_order")
        .eq("is_active", true)
        .eq("question_type", "score_0_10")
        .order("display_order", { ascending: true })
        .range(from, to),
  );
  return rows.map((r) => r.id);
}

export async function listSurveysForSnapshot(
  supabase: SupabaseClient<Database>,
): Promise<SurveyForSnapshot[]> {
  return fetchAllRows<SurveyForSnapshot>((from, to) =>
    supabase
      .from("enps_surveys")
      .select("id, year_month, title, end_date")
      .eq("is_active", true)
      .order("year_month", { ascending: true })
      .range(from, to),
  );
}

async function fetchLatestComputedAt(
  supabase: SupabaseClient<Database>,
  surveyId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("enps_monthly_snapshots")
    .select("computed_at")
    .eq("survey_id", surveyId)
    .order("computed_at", { ascending: false })
    .limit(1);
  return data?.[0]?.computed_at ?? null;
}

/**
 * 締切前に作られたスナップショットは未回答補完を含まない暫定値なので、締切後に作り直す。
 * これがないと、受付中に一度作ったサーベイが「既存あり」と判定されて確定されないままになる。
 */
export function isSnapshotFinalized(params: {
  computedAt: string | null;
  endDate: string;
  surveyEnded: boolean;
}): boolean {
  const { computedAt, endDate, surveyEnded } = params;
  if (computedAt === null) return false;
  if (!surveyEnded) return true;
  return new Date(computedAt).getTime() >= new Date(endDate).getTime();
}

/**
 * 締切後のサーベイのみ未回答を 0 点として補完した指標も保存する。
 * 受付中のサーベイでも回答者ベースの指標は保存するので、途中経過は確認できる。
 */
export async function buildAndStoreSnapshotForSurvey(
  supabase: SupabaseClient<Database>,
  survey: SurveyForSnapshot,
  options?: { force?: boolean; now?: Date },
): Promise<BuildSnapshotResult> {
  const now = options?.now ?? new Date();
  const surveyEnded = isEnpsSurveyEnded(survey.end_date, now);

  if (!options?.force) {
    const computedAt = await fetchLatestComputedAt(supabase, survey.id);
    if (
      isSnapshotFinalized({ computedAt, endDate: survey.end_date, surveyEnded })
    ) {
      return {
        survey,
        rowCount: 0,
        surveyEnded,
        skipped: true,
        reason:
          "既に確定済みのスナップショットがあります（--force で再計算できます）",
      };
    }
  }

  const scoreQuestionIds = await fetchActiveScoreQuestionIds(supabase);
  if (scoreQuestionIds.length === 0) {
    return {
      survey,
      rowCount: 0,
      surveyEnded,
      skipped: true,
      reason: "有効なスコア質問がありません",
    };
  }

  const [targets, responses] = await Promise.all([
    fetchSnapshotTargets(supabase),
    fetchScoreResponsesForSurvey(supabase, survey.id),
  ]);

  const rows = buildEnpsSnapshotRows({
    scoreQuestionIds,
    targets,
    responses,
    includeImputed: surveyEnded,
  });

  await storeSnapshotRows(supabase, survey.id, rows);

  return {
    survey,
    rowCount: rows.length,
    surveyEnded,
    skipped: false,
  };
}

const INSERT_CHUNK_SIZE = 500;

export async function storeSnapshotRows(
  supabase: SupabaseClient<Database>,
  surveyId: string,
  rows: EnpsSnapshotRow[],
): Promise<void> {
  const computedAt = new Date().toISOString();
  const dbRows = rows.map((row) => ({
    survey_id: surveyId,
    question_id: row.question_id,
    scope: row.scope,
    company_name: row.company_name,
    business_unit_name: row.business_unit_name,
    target_count: row.target_count,
    respondent_count: row.respondent_count,
    promoters: row.promoters,
    passives: row.passives,
    detractors: row.detractors,
    nps_respondent_base: row.nps_respondent_base,
    nps_imputed_base: row.nps_imputed_base,
    computed_at: computedAt,
  }));

  for (let i = 0; i < dbRows.length; i += INSERT_CHUNK_SIZE) {
    const chunk = dbRows.slice(i, i + INSERT_CHUNK_SIZE);

    const { error } = await supabase
      .from("enps_monthly_snapshots")
      .upsert(chunk, {
        onConflict:
          "survey_id,question_id,scope,company_name,business_unit_name",
      });

    if (error) {
      throw new Error(`スナップショットの保存に失敗しました: ${error.message}`);
    }
  }
}
