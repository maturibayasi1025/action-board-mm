import { SLACK_MRKDWN_CHANNEL_MENTION } from "@/lib/slack/constants";
import {
  isAwardSurveySlackWebhookConfigured,
  resolveAwardSurveySlackWebhookUrl,
} from "@/lib/slack/survey-webhook-urls";
import { createServiceClient } from "@/lib/supabase/server";
import { type NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

/**
 * 3月始まりの年度で期数を計算する（3月〜翌2月で同一期）
 */
function calculatePeriodNumber(year: number, month: number): number {
  const PERIOD_BASE_NUMBER = 12;
  const PERIOD_BASE_FISCAL_YEAR = 2026; // 2026/03 - 2027/02 が 12期
  const fiscalYear = month >= 3 ? year : year - 1;
  return PERIOD_BASE_NUMBER + (fiscalYear - PERIOD_BASE_FISCAL_YEAR);
}

/**
 * 月次表彰アンケートを自動生成するバッチ処理
 *
 * 本APIはGitHub Actions Cronから呼び出される想定で、以下の処理を行います：
 * 1. 当月分のアンケートを自動生成
 * 2. 既存の有効な質問を確認
 * 3. Slack Webhook で通知（回答用URL付き）
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServiceClient();

    // リクエストボディから認証情報を確認
    const body = await request.json();
    const { adminKey } = body;

    if (adminKey !== process.env.BATCH_ADMIN_KEY) {
      return NextResponse.json(
        { error: "認証に失敗しました" },
        { status: 401 },
      );
    }

    console.log("=== 表彰アンケート自動生成バッチ処理を開始します ===");

    // 当月の年月を計算
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const monthNumber = month + 1;
    const yearMonth = `${year}-${String(monthNumber).padStart(2, "0")}`;
    const yearMonthDisplay = `${year}年${String(monthNumber).padStart(2, "0")}月度`;
    const periodNumber = calculatePeriodNumber(year, monthNumber);
    const title = `【表彰アンケート】${periodNumber}期／${year}年${String(monthNumber).padStart(2, "0")}月度`;

    // 既に当月分のアンケートが存在するかチェック
    const { data: existingSurvey } = await supabase
      .from("award_surveys")
      .select("id")
      .eq("year_month", yearMonth)
      .single();

    if (existingSurvey) {
      console.log(`当月分のアンケート（${yearMonth}）は既に存在します`);
      return NextResponse.json({
        success: true,
        message: `当月分のアンケート（${yearMonth}）は既に存在します`,
        survey_id: existingSurvey.id,
      });
    }

    // 回答開始日時: 当月25日 00:00 JST
    const startDate = new Date(year, month, 25);
    // 回答終了日時: 当月末日 23:59 JST
    const endDate = new Date(year, month + 1, 0, 23, 59, 59);

    // アンケートを作成
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
      .select()
      .single();

    if (surveyError || !survey) {
      console.error("アンケート作成エラー:", surveyError);
      return NextResponse.json(
        {
          error: "アンケートの作成に失敗しました",
          details: surveyError?.message,
        },
        { status: 500 },
      );
    }

    console.log(`アンケートを作成しました: ${survey.id} (${yearMonth})`);

    // 有効な質問が存在するか確認
    const { data: activeQuestions, error: questionsError } = await supabase
      .from("award_questions")
      .select("id")
      .eq("is_active", true);

    if (questionsError) {
      console.error("質問取得エラー:", questionsError);
    }

    if (!activeQuestions || activeQuestions.length === 0) {
      console.warn("有効な質問が存在しません。Slack通知はスキップします。");
      return NextResponse.json({
        success: true,
        message:
          "アンケートを作成しましたが、有効な質問が存在しないためSlack通知をスキップしました",
        survey_id: survey.id,
        warning: "有効な質問が存在しません",
      });
    }

    // Slack通知を送信
    const webhookUrl = resolveAwardSurveySlackWebhookUrl();
    if (!webhookUrl) {
      console.warn(
        "SLACK_WEBHOOK_URL_AWARD または SLACK_WEBHOOK_URL が設定されていません。Slack通知をスキップします。",
      );
      return NextResponse.json({
        success: true,
        message:
          "アンケートを作成しましたが、Slack通知の設定がないため通知をスキップしました",
        survey_id: survey.id,
        warning: "Slack通知の設定がありません",
      });
    }

    const appOrigin =
      process.env.NEXT_PUBLIC_APP_ORIGIN || "http://localhost:3000";
    const surveyUrl = `${appOrigin}/surveys/award/${survey.id}`;

    const slackMessage = {
      text: `${SLACK_MRKDWN_CHANNEL_MENTION} ${title} のお知らせ`,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `${SLACK_MRKDWN_CHANNEL_MENTION}\n\n*${title}*\n\n${yearMonthDisplay}の表彰アンケートを開始しました。\nMVV表彰に関して、バリューを体現出来たエピソードをご回答ください。`,
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

    const slackResponse = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(slackMessage),
    });

    if (!slackResponse.ok) {
      console.error(
        "Slack通知の送信に失敗しました:",
        await slackResponse.text(),
      );
      return NextResponse.json({
        success: true,
        message: "アンケートを作成しましたが、Slack通知の送信に失敗しました",
        survey_id: survey.id,
        warning: "Slack通知の送信に失敗しました",
      });
    }

    // Slack通知日時を更新
    await supabase
      .from("award_surveys")
      .update({ slack_notified_at: new Date().toISOString() })
      .eq("id", survey.id);

    console.log("=== 表彰アンケート自動生成バッチ処理が完了しました ===");

    return NextResponse.json({
      success: true,
      message: `${yearMonthDisplay}のアンケート（${periodNumber}期）を作成し、Slack通知を送信しました`,
      survey_id: survey.id,
      year_month: yearMonth,
      period_number: periodNumber,
      survey_url: surveyUrl,
    });
  } catch (error) {
    console.error("バッチ処理でエラーが発生しました:", error);
    const errorMessage =
      error instanceof Error ? error.message : "予期しないエラーが発生しました";

    return NextResponse.json(
      {
        error: "バッチ処理でエラーが発生しました",
        details: errorMessage,
      },
      { status: 500 },
    );
  }
}

/**
 * バッチ処理の状況確認用GETエンドポイント
 */
export async function GET() {
  try {
    const supabase = await createServiceClient();

    const now = new Date();
    const year = now.getFullYear();
    const monthNumber = now.getMonth() + 1;
    const yearMonth = `${year}-${String(monthNumber).padStart(2, "0")}`;
    const periodNumber = calculatePeriodNumber(year, monthNumber);

    const { data: existingSurvey } = await supabase
      .from("award_surveys")
      .select("id, title, created_at, slack_notified_at")
      .eq("year_month", yearMonth)
      .single();

    const { count: activeQuestionsCount } = await supabase
      .from("award_questions")
      .select("*", { count: "exact", head: true })
      .eq("is_active", true);

    return NextResponse.json({
      next_month: yearMonth,
      period_number: periodNumber,
      survey_exists: !!existingSurvey,
      survey: existingSurvey || null,
      active_questions_count: activeQuestionsCount || 0,
      slack_webhook_configured: isAwardSurveySlackWebhookConfigured(),
    });
  } catch (error) {
    console.error("統計取得でエラーが発生しました:", error);
    const errorMessage =
      error instanceof Error ? error.message : "予期しないエラーが発生しました";

    return NextResponse.json(
      {
        error: "統計取得でエラーが発生しました",
        details: errorMessage,
      },
      { status: 500 },
    );
  }
}
