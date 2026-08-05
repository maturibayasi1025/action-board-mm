/**
 * eNPS 会社別レポート用の月次スナップショットを確定保存するバッチ。
 *
 * 集計時点の所属を凍結して保存するため、あとから異動が起きても過去月の数値は変化しない。
 * 既定では「締切済みで最も新しいサーベイ」を対象にするので、月初に実行すると前月分が確定する。
 *
 *   npm run build-enps-report
 *   npm run build-enps-report -- --year-month 2026-07
 *   npm run build-enps-report -- --all --force
 */

import path from "node:path";
import {
  buildAndStoreSnapshotForSurvey,
  listSurveysForSnapshot,
} from "@/lib/admin/enps-report/build-and-store";
import {
  parseReportCliOptions,
  selectTargetSurveys,
} from "@/lib/admin/enps-report/cli";
import type { Database } from "@/lib/types/supabase";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} が設定されていません`);
  }
  return value;
}

async function main() {
  console.log("=== eNPSレポート用スナップショット生成を開始します ===");
  console.log(`Execution time: ${new Date().toISOString()}`);

  try {
    const options = parseReportCliOptions(process.argv.slice(2));
    const supabaseUrl = getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL");
    const serviceRoleKey = getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");
    const supabase = createClient<Database>(supabaseUrl, serviceRoleKey);

    const now = new Date();
    const surveys = await listSurveysForSnapshot(supabase);
    const targets = selectTargetSurveys(surveys, options, now);

    if (targets.length === 0) {
      console.log(
        "対象のアンケートがありません（締切済みのアンケートが無い、または指定した年月が見つかりません）。",
      );
      process.exit(0);
    }

    if (options.all) {
      console.warn(
        "⚠ --all は過去分を現在の所属で埋め直します。異動があった場合、過去月の会社別内訳は当時と異なります。",
      );
    }

    for (const survey of targets) {
      const result = await buildAndStoreSnapshotForSurvey(supabase, survey, {
        force: options.force,
        now,
      });

      if (result.skipped) {
        console.log(`- ${survey.year_month}: スキップ（${result.reason}）`);
        continue;
      }

      const imputedNote = result.surveyEnded
        ? "未回答0点補完あり"
        : "受付中のため未回答補完なし";
      console.log(
        `- ${survey.year_month}: ${result.rowCount} 行を保存しました（${imputedNote}）`,
      );
    }

    console.log("=== eNPSレポート用スナップショット生成が完了しました ===");
    process.exit(0);
  } catch (error) {
    console.error(
      "❌ eNPSレポート用スナップショット生成に失敗しました:",
      error,
    );
    process.exit(1);
  }
}

void main();
