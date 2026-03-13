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

async function sendSlackNotification(params: {
  webhookUrl: string;
  yearMonthDisplay: string;
  surveyUrl: string;
  endDate: Date;
}) {
  const { webhookUrl, yearMonthDisplay, surveyUrl, endDate } = params;
  const slackMessage = {
    text: "月次eNPSアンケートのお知らせ",
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*月次eNPSアンケートのお知らせ*\n\n${yearMonthDisplay}のeNPSアンケートを開始しました。\n5分程度で回答できますので、ご協力をお願いします。`,
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
            action_id: "answer_survey",
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
  console.log("=== eNPSアンケート自動生成バッチ処理を開始します ===");
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
    const yearMonth = `${year}-${String(month + 1).padStart(2, "0")}`;
    const yearMonthDisplay = `${year}年${month + 1}月度`;

    const { data: existingSurvey, error: existingSurveyError } = await supabase
      .from("enps_surveys")
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
      .from("enps_surveys")
      .insert({
        title: `月次NPSアンケート / ${yearMonthDisplay}`,
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
      throw new Error(`アンケート作成に失敗しました: ${surveyError?.message}`);
    }

    console.log(`アンケートを作成しました: ${survey.id} (${yearMonth})`);

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

    if (!webhookUrl) {
      console.warn(
        "SLACK_WEBHOOK_URL が未設定のため、Slack通知はスキップします。",
      );
      process.exit(0);
    }

    const surveyUrl = `${appOrigin}/surveys/${survey.id}`;
    await sendSlackNotification({
      webhookUrl,
      yearMonthDisplay,
      surveyUrl,
      endDate,
    });

    const { error: updatedError } = await supabase
      .from("enps_surveys")
      .update({ slack_notified_at: new Date().toISOString() })
      .eq("id", survey.id);

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
