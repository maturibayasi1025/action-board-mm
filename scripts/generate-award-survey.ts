import path from "node:path";
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

function calculatePeriodNumber(year: number, month: number): number {
  const periodBaseNumber = 12;
  const periodBaseFiscalYear = 2026; // 2026/03 - 2027/02 が 12期
  const fiscalYear = month >= 3 ? year : year - 1;
  return periodBaseNumber + (fiscalYear - periodBaseFiscalYear);
}

async function sendSlackNotification(params: {
  webhookUrl: string;
  title: string;
  yearMonthDisplay: string;
  surveyUrl: string;
  endDate: Date;
}) {
  const { webhookUrl, title, yearMonthDisplay, surveyUrl, endDate } = params;
  const slackMessage = {
    text: `${title} のお知らせ`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*${title}*\n\n${yearMonthDisplay}の表彰アンケートを開始しました。\nMVV表彰に関して、バリューを体現出来たエピソードをご回答ください。`,
        },
      },
      {
        type: "section",
        fields: [
          {
            type: "mrkdwn",
            text: `*回答URL:*\n<${surveyUrl}|アンケートに回答する>`,
          },
          {
            type: "mrkdwn",
            text: `*回答期限:*\n${endDate.toLocaleDateString("ja-JP")}`,
          },
        ],
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "回答する",
              emoji: true,
            },
            url: surveyUrl,
            action_id: "answer_award_survey",
          },
        ],
      },
    ],
  };

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(slackMessage),
  });

  if (!response.ok) {
    const responseText = await response.text();
    throw new Error(
      `Slack通知に失敗しました: ${response.status} ${responseText}`,
    );
  }
}

async function main() {
  console.log("=== 表彰アンケート自動生成バッチ処理を開始します ===");
  console.log(`Execution time: ${new Date().toISOString()}`);

  try {
    const supabaseUrl = getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL");
    const serviceRoleKey = getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");
    const appOrigin =
      process.env.NEXT_PUBLIC_APP_ORIGIN || "http://localhost:3000";
    const webhookUrl = process.env.SLACK_WEBHOOK_URL;

    const supabase = createClient<Database>(supabaseUrl, serviceRoleKey);

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const monthNumber = month + 1;
    const yearMonth = `${year}-${String(monthNumber).padStart(2, "0")}`;
    const yearMonthDisplay = `${year}年${String(monthNumber).padStart(2, "0")}月度`;
    const periodNumber = calculatePeriodNumber(year, monthNumber);
    const title = `【表彰アンケート】${periodNumber}期／${year}年${String(monthNumber).padStart(2, "0")}月度`;

    const { data: existingSurvey, error: existingSurveyError } = await supabase
      .from("award_surveys")
      .select("id")
      .eq("year_month", yearMonth)
      .maybeSingle();

    if (existingSurveyError) {
      throw new Error(
        `既存アンケート確認に失敗しました: ${existingSurveyError.message}`,
      );
    }

    if (existingSurvey) {
      console.log(`当月分のアンケート（${yearMonth}）は既に存在します`);
      process.exit(0);
    }

    const startDate = new Date(year, month, 25);
    const endDate = new Date(year, month + 1, 0, 23, 59, 59);

    const { data: survey, error: surveyError } = await supabase
      .from("award_surveys")
      .insert({
        title,
        description:
          "MVV表彰に関して、皆さん自身の取り組みについて教えてください。\nそれぞれで下記バリューを体現出来たエピソードを記入し、ご提出をお願いします。",
        year_month: yearMonth,
        period_number: periodNumber,
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        is_active: true,
      })
      .select("id")
      .single();

    if (surveyError || !survey) {
      throw new Error(`アンケート作成に失敗しました: ${surveyError?.message}`);
    }

    console.log(`アンケートを作成しました: ${survey.id} (${yearMonth})`);

    const { data: activeQuestions, error: questionsError } = await supabase
      .from("award_questions")
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

    if (!webhookUrl) {
      console.warn(
        "SLACK_WEBHOOK_URL が未設定のため、Slack通知はスキップします。",
      );
      process.exit(0);
    }

    const surveyUrl = `${appOrigin}/surveys/award/${survey.id}`;
    await sendSlackNotification({
      webhookUrl,
      title,
      yearMonthDisplay,
      surveyUrl,
      endDate,
    });

    const { error: updatedError } = await supabase
      .from("award_surveys")
      .update({ slack_notified_at: new Date().toISOString() })
      .eq("id", survey.id);

    if (updatedError) {
      throw new Error(`通知日時更新に失敗しました: ${updatedError.message}`);
    }

    console.log("=== 表彰アンケート自動生成バッチ処理が完了しました ===");
    process.exit(0);
  } catch (error) {
    console.error("❌ 表彰アンケート自動生成に失敗しました:", error);
    process.exit(1);
  }
}

void main();
