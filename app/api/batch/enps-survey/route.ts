import { SLACK_MRKDWN_CHANNEL_MENTION } from "@/lib/slack/constants";
import {
  isEnpsSurveySlackWebhookConfigured,
  resolveEnpsSurveySlackWebhookUrl,
} from "@/lib/slack/survey-webhook-urls";
import { createServiceClient } from "@/lib/supabase/server";
import { type NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

/**
 * 月次eNPSアンケートを自動生成するバッチ処理
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

    // 環境変数で設定した管理者キーで認証
    if (adminKey !== process.env.BATCH_ADMIN_KEY) {
      return NextResponse.json(
        { error: "認証に失敗しました" },
        { status: 401 },
      );
    }

    console.log("=== eNPSアンケート自動生成バッチ処理を開始します ===");

    // 当月の年月を計算
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const yearMonth = `${year}-${String(month + 1).padStart(2, "0")}`;
    const yearMonthDisplay = `${year}年${month + 1}月度`;

    // 既に当月分のアンケートが存在するかチェック
    const { data: existingSurvey } = await supabase
      .from("enps_surveys")
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

    // 回答開始日時と終了日時を設定
    // 開始日時: 当月25日の00:00 JST
    const startDate = new Date(year, month, 25);
    // 終了日時: 当月末日の23:59 JST
    const endDate = new Date(year, month + 1, 0, 23, 59, 59);

    // アンケートを作成
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
      .from("enps_questions")
      .select("id")
      .eq("is_active", true);

    if (questionsError) {
      console.error("質問取得エラー:", questionsError);
      // 質問がなくてもアンケートは作成済みなので続行
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
    const webhookUrl = resolveEnpsSurveySlackWebhookUrl();
    if (!webhookUrl) {
      console.warn(
        "SLACK_WEBHOOK_URL_ENPS または SLACK_WEBHOOK_URL が設定されていません。Slack通知をスキップします。",
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
    const surveyUrl = `${appOrigin}/surveys/${survey.id}`;

    const slackMessage = {
      text: `${SLACK_MRKDWN_CHANNEL_MENTION} 月次eNPSアンケートのお知らせ`,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `${SLACK_MRKDWN_CHANNEL_MENTION}\n\n*月次eNPSアンケートのお知らせ*\n\n${yearMonthDisplay}のeNPSアンケートを開始しました。\n5分程度で回答できますので、ご協力をお願いします。`,
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

    const slackResponse = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(slackMessage),
    });

    if (!slackResponse.ok) {
      console.error(
        "Slack通知の送信に失敗しました:",
        await slackResponse.text(),
      );
      // Slack通知の失敗は警告として扱う（アンケートは作成済み）
      return NextResponse.json({
        success: true,
        message: "アンケートを作成しましたが、Slack通知の送信に失敗しました",
        survey_id: survey.id,
        warning: "Slack通知の送信に失敗しました",
      });
    }

    // Slack通知日時を更新
    await supabase
      .from("enps_surveys")
      .update({ slack_notified_at: new Date().toISOString() })
      .eq("id", survey.id);

    console.log("=== eNPSアンケート自動生成バッチ処理が完了しました ===");

    return NextResponse.json({
      success: true,
      message: `${yearMonthDisplay}のアンケートを作成し、Slack通知を送信しました`,
      survey_id: survey.id,
      year_month: yearMonth,
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

    // 当月の年月を計算
    const now = new Date();
    const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    // 当月分のアンケートが既に存在するか確認
    const { data: existingSurvey } = await supabase
      .from("enps_surveys")
      .select("id, title, created_at, slack_notified_at")
      .eq("year_month", yearMonth)
      .single();

    // 有効な質問数を取得
    const { count: activeQuestionsCount } = await supabase
      .from("enps_questions")
      .select("*", { count: "exact", head: true })
      .eq("is_active", true);

    return NextResponse.json({
      next_month: yearMonth,
      survey_exists: !!existingSurvey,
      survey: existingSurvey || null,
      active_questions_count: activeQuestionsCount || 0,
      slack_webhook_configured: isEnpsSurveySlackWebhookConfigured(),
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
