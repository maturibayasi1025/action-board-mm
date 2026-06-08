import fs from "node:fs";
import path from "node:path";
import {
  SELF_EVAL_QUESTION_IDS,
  type SurveyRow,
  VALUE_LABELS,
  VALUE_ORDER,
  buildCsvContent,
  buildMonthRangeLabel,
  buildValueCell,
  parseMonthsArg,
} from "@/lib/admin/export-award-self-eval";
import {
  type PrivateUserOrgRow,
  companyAndBusinessUnitFromPrivateUserRow,
} from "@/lib/admin/private-user-org";
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

type ResponseRow = {
  user_id: string;
  survey_id: string;
  question_id: string;
  text_value: string | null;
};

type UserRow = {
  id: string;
  name: string;
  company_name: string;
  business_unit_name: string;
};

async function fetchSurveys(
  supabase: ReturnType<typeof createClient<Database>>,
  months: string[] | null,
): Promise<SurveyRow[]> {
  let query = supabase
    .from("award_surveys")
    .select("id, year_month, title")
    .order("year_month", { ascending: true });

  if (months) {
    query = query.in("year_month", months);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`アンケート取得に失敗しました: ${error.message}`);
  }

  const surveys = data ?? [];
  if (surveys.length === 0) {
    throw new Error("対象アンケートが見つかりません");
  }

  if (months) {
    const found = new Set(surveys.map((s) => s.year_month));
    const missing = months.filter((m) => !found.has(m));
    if (missing.length > 0) {
      throw new Error(
        `以下の年月のアンケートが見つかりません: ${missing.join(", ")}`,
      );
    }
  }

  return surveys;
}

async function fetchSelfEvalResponses(
  supabase: ReturnType<typeof createClient<Database>>,
  surveyIds: string[],
): Promise<ResponseRow[]> {
  const questionIds = Object.values(SELF_EVAL_QUESTION_IDS);
  const { data, error } = await supabase
    .from("award_responses")
    .select("user_id, survey_id, question_id, text_value")
    .in("survey_id", surveyIds)
    .in("question_id", questionIds);

  if (error) {
    throw new Error(`回答取得に失敗しました: ${error.message}`);
  }

  return (data ?? []).filter((r) => r.text_value?.trim());
}

async function fetchUsers(
  supabase: ReturnType<typeof createClient<Database>>,
  userIds: string[],
): Promise<Map<string, UserRow>> {
  if (userIds.length === 0) return new Map();

  const { data, error } = await supabase
    .from("private_users")
    .select(
      `
      id,
      name,
      business_units (
        name,
        companies (
          name
        )
      )
    `,
    )
    .in("id", userIds);

  if (error) {
    throw new Error(`ユーザー取得に失敗しました: ${error.message}`);
  }

  return new Map(
    (data ?? []).map((u) => {
      const { company_name, business_unit_name } =
        companyAndBusinessUnitFromPrivateUserRow(u as PrivateUserOrgRow);
      return [
        u.id,
        {
          id: u.id,
          name: u.name,
          company_name,
          business_unit_name,
        },
      ] as const;
    }),
  );
}

async function main() {
  console.log("=== 表彰アンケート 自己評価CSV出力 ===");

  const monthsArg = parseMonthsArg(process.argv);
  const supabaseUrl = getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient<Database>(supabaseUrl, serviceRoleKey);

  const surveys = await fetchSurveys(supabase, monthsArg);
  const surveyIds = surveys.map((s) => s.id);
  const surveyIdToYearMonth = new Map(surveys.map((s) => [s.id, s.year_month]));

  console.log(`対象アンケート: ${surveys.map((s) => s.year_month).join(", ")}`);

  const responses = await fetchSelfEvalResponses(supabase, surveyIds);
  const userIds = Array.from(new Set(responses.map((r) => r.user_id)));
  const userMap = await fetchUsers(supabase, userIds);

  const responseIndex = new Map<string, string>();
  for (const r of responses) {
    const text = r.text_value?.trim();
    if (!text) continue;
    responseIndex.set(`${r.user_id}:${r.survey_id}:${r.question_id}`, text);
  }

  const sortedUserIds = [...userIds].sort((a, b) => {
    const nameA = userMap.get(a)?.name ?? "";
    const nameB = userMap.get(b)?.name ?? "";
    return nameA.localeCompare(nameB, "ja");
  });

  const headers = [
    "氏名",
    "会社",
    "部署",
    ...VALUE_ORDER.map((key) => VALUE_LABELS[key]),
  ];

  const dataRows = sortedUserIds.map((userId) => {
    const user = userMap.get(userId);
    return [
      user?.name ?? "不明",
      user?.company_name ?? "",
      user?.business_unit_name ?? "",
      ...VALUE_ORDER.map((valueKey) =>
        buildValueCell(
          userId,
          valueKey,
          surveys,
          surveyIdToYearMonth,
          responseIndex,
        ),
      ),
    ];
  });

  const monthRange = buildMonthRangeLabel(surveys);
  const outputDir = path.resolve(process.cwd(), "tmp");
  fs.mkdirSync(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, `award-self-eval-${monthRange}.csv`);

  fs.writeFileSync(outputPath, buildCsvContent(headers, dataRows), "utf8");

  console.log(`回答者数: ${sortedUserIds.length}人`);
  console.log(`自己評価回答件数: ${responses.length}件`);
  console.log(`出力先: ${outputPath}`);
  console.log("=== 完了 ===");
}

void main().catch((error) => {
  console.error("❌ CSV出力に失敗しました:", error);
  process.exit(1);
});
