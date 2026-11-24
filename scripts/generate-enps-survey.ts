import path from "node:path";
import { resolveEnpsSurveySlackWebhookUrl } from "@/lib/slack/survey-webhook-urls";
import {
  monthlySurveyEndAt,
  slackDeadlineForMonthlySurvey,
} from "@/lib/survey/monthly-survey-deadline";
import {
  planMonthlySurveyRun,
  postSlackWebhook,
} from "@/lib/survey/monthly-survey-run";
import { buildEnpsSurveySlackMessage } from "@/lib/survey/monthly-survey-slack";
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
  console.log("=== eNPSアンケート自動生成バッチ処理を開始します ===");
  console.log(`Execution time: ${new Date().toISOString()}`);

  try {
    const supabaseUrl = getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL");
    const serviceRoleKey = getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");
    const appOrigin =
      process.env.NEXT_PUBLIC_APP_ORIGIN || "http://localhost:3000";
    const webhookUrl = resolveEnpsSurveySlackWebhookUrl();

    const supabase = createClient<Database>(supabaseUrl, serviceRoleKey);

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const yearMonth = `${year}-${String(month + 1).padStart(2, "0")}`;
    const yearMonthDisplay = `${year}年${month + 1}月度`;

    const startDate = new Date(year, month, 25);
    const endDate = monthlySurveyEndAt(year, month);

    const { data: existingSurvey, error: existingSurveyError } = await supabase
      .from("enps_surveys")
      .select("id, slack_notified_at, end_date")
      .eq("year_month", yearMonth)
      .maybeSingle();

    if (existingSurveyError) {
      throw new Error(
        `既存アンケート確認に失敗しました: ${existingSurveyError.message}`,
      );
    }

    const slackDeadline = slackDeadlineForMonthlySurvey({
      calculatedEnd: endDate,
      existingEndIso: existingSurvey?.end_date ?? null,
    });
    if (slackDeadline.warning) {
      console.warn(slackDeadline.warning);
    }

    const plan = planMonthlySurveyRun({
      existing: existingSurvey
        ? {
            id: existingSurvey.id,
            slackNotifiedAt: existingSurvey.slack_notified_at,
          }
        : null,
      webhookConfigured: webhookUrl != null,
    });

    if (plan.kind === "skip") {
      console.log(
        `当月分のアンケート（${yearMonth}）は既に存在し、Slack投稿済みです`,
      );
      process.exit(0);
    }

    if (plan.kind === "fail_missing_webhook" || webhookUrl == null) {
      throw new Error("SLACK_WEBHOOK_URL_ENPS が未設定です");
    }

    let surveyId: string;
    if (plan.kind === "create") {
      const { data: survey, error: surveyError } = await supabase
        .from("enps_surveys")
        .insert({
          title: `月次eNPSアンケート / ${yearMonthDisplay}`,
          description:
            "月次のeNPSについてのアンケートです！\n詳細は社内報をご確認ください！\n5分程度で済むかと思いますので、忌憚なきご意見をお願いいたします！",
          year_month: yearMonth,
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString(),
          is_active: true,
        })
        .select("id")
        .single();

      if (surveyError || !survey) {
        throw new Error(
          `アンケート作成に失敗しました: ${surveyError?.message}`,
        );
      }

      console.log(`アンケートを作成しました: ${survey.id} (${yearMonth})`);
      surveyId = survey.id;
    } else if (plan.kind === "notify_existing") {
      surveyId = plan.surveyId;
      console.log(
        `当月分のアンケート（${yearMonth}）は作成済みで未投稿のため、Slack投稿のみ行います`,
      );
    } else {
      const unreachable: never = plan;
      throw new Error(`未処理の実行計画です: ${String(unreachable)}`);
    }

    const { data: activeQuestions, error: questionsError } = await supabase
      .from("enps_questions")
      .select("id")
      .eq("is_active", true);

    if (questionsError) {
      throw new Error(
        `有効な質問の取得に失敗しました: ${questionsError.message}`,
      );
    }

    if (!activeQuestions || activeQuestions.length === 0) {
      console.warn("有効な質問が存在しないため、Slack通知はスキップします。");
      process.exit(0);
    }

    const surveyUrl = `${appOrigin}/surveys/${surveyId}`;
    await postSlackWebhook(
      webhookUrl,
      buildEnpsSurveySlackMessage({
        yearMonthDisplay,
        surveyUrl,
        endDate: slackDeadline.deadline,
      }),
    );

    const { error: updatedError } = await supabase
      .from("enps_surveys")
      .update({ slack_notified_at: new Date().toISOString() })
      .eq("id", surveyId);

    if (updatedError) {
      throw new Error(`通知日時更新に失敗しました: ${updatedError.message}`);
    }

    console.log("=== eNPSアンケート自動生成バッチ処理が完了しました ===");
    process.exit(0);
  } catch (error) {
    console.error("❌ eNPSアンケート自動生成に失敗しました:", error);
    process.exit(1);
  }
}

void main();
