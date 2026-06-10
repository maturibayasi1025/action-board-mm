import fs from "node:fs";
import path from "node:path";
import { parseMonthsArg } from "@/lib/admin/export-award-self-eval";
import { buildAwardSelfEvalCsv } from "@/lib/admin/export-award-self-eval-data";
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
  console.log("=== 表彰アンケート 自己評価CSV出力 ===");

  const monthsArg = parseMonthsArg(process.argv);
  const supabaseUrl = getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient<Database>(supabaseUrl, serviceRoleKey);

  const result = await buildAwardSelfEvalCsv(supabase, monthsArg);

  console.log(`対象アンケート: ${result.targetYearMonths.join(", ")}`);

  const outputDir = path.resolve(process.cwd(), "tmp");
  fs.mkdirSync(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, result.filename);

  fs.writeFileSync(outputPath, result.csvContent, "utf8");

  console.log(`回答者数: ${result.responderCount}人`);
  console.log(`自己評価回答件数: ${result.responseCount}件`);
  console.log(`出力先: ${outputPath}`);
  console.log("=== 完了 ===");
}

void main().catch((error) => {
  console.error("❌ CSV出力に失敗しました:", error);
  process.exit(1);
});
