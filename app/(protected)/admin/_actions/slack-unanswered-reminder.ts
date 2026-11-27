"use server";

import { SLACK_MRKDWN_CHANNEL_MENTION } from "@/lib/slack/constants";
import {
  getSlackUsersList,
  resolvePrivateUserNamesToMentions,
} from "@/lib/slack/slack-users";
import {
  resolveAwardSurveySlackWebhookUrl,
  resolveEnpsSurveySlackWebhookUrl,
} from "@/lib/slack/survey-webhook-urls";
import { createServiceClient } from "@/lib/supabase/server";
import {
  type SurveyResponseTable,
  fetchUnansweredPrivateUsers,
} from "@/lib/survey/unanswered-candidates";
import { requireOwner } from "@/lib/utils/isOwner";

export type SurveyReminderKind = "enps" | "award";

export type SendSlackReminderResult =
  | { ok: true; unmatchedNames: string[] }
  | { ok: false; error: string };

const DEFAULT_REMINDER_BODY =
  "アンケートへのご回答がまだの方は、お手すきの際にご協力をお願いします。";

function escapeSlackMrkdwn(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** 取得に失敗したら null。一部だけの宛先で送らないよう、呼び出し側は送信せずに止める */
async function getUnansweredNames(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  table: SurveyResponseTable,
  surveyId: string,
): Promise<string[] | null> {
  try {
    const unanswered = await fetchUnansweredPrivateUsers(
      supabase,
      table,
      surveyId,
      { orderByName: true },
    );
    return unanswered.map((u) => u.name);
  } catch (error) {
    console.error("未回答者の取得エラー:", error);
    return null;
  }
}

const UNANSWERED_FETCH_FAILED: SendSlackReminderResult = {
  ok: false,
  error: "未回答者の取得に失敗しました",
};

async function postSlackWebhookReminder(params: {
  webhookUrl: string;
  fallbackText: string;
  headerMrkdwn: string;
  mentionText: string;
  bodyText: string;
  linkLine: string;
  unmatchedNames: string[];
}): Promise<SendSlackReminderResult> {
  const {
    webhookUrl,
    fallbackText,
    headerMrkdwn,
    mentionText,
    bodyText,
    linkLine,
    unmatchedNames,
  } = params;

  const mentionBlock =
    mentionText.trim().length > 0
      ? mentionText
      : "_（Slackユーザーに一致するメンションがありません）_";

  const blocks: Record<string, unknown>[] = [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `${SLACK_MRKDWN_CHANNEL_MENTION}\n${headerMrkdwn}`,
      },
    },
    {
      type: "section",
      text: { type: "mrkdwn", text: mentionBlock },
    },
    {
      type: "section",
      text: { type: "mrkdwn", text: escapeSlackMrkdwn(bodyText) },
    },
    {
      type: "section",
      text: { type: "mrkdwn", text: `*回答URL:*\n${linkLine}` },
    },
  ];

  if (unmatchedNames.length > 0) {
    const list = unmatchedNames
      .map((n) => `• ${escapeSlackMrkdwn(n)}`)
      .join("\n");
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*メンションに解決できなかった名前（${unmatchedNames.length}件）:*\n${list}`,
      },
    });
  }

  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: `${SLACK_MRKDWN_CHANNEL_MENTION} ${fallbackText}`,
      blocks,
    }),
  });

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    return {
      ok: false,
      error: `Slack への送信に失敗しました (${res.status}) ${t}`,
    };
  }

  return { ok: true, unmatchedNames };
}

export async function sendSlackReminderToUnanswered(params: {
  kind: SurveyReminderKind;
  surveyId: string;
  message: string;
}): Promise<SendSlackReminderResult> {
  await requireOwner();

  const { kind, surveyId, message } = params;
  const trimmedMessage = message.trim();
  const bodyText = trimmedMessage || DEFAULT_REMINDER_BODY;

  const webhookUrl =
    kind === "enps"
      ? resolveEnpsSurveySlackWebhookUrl()
      : resolveAwardSurveySlackWebhookUrl();
  if (!webhookUrl) {
    return {
      ok: false,
      error:
        kind === "enps"
          ? "SLACK_WEBHOOK_URL_ENPS が設定されていません"
          : "SLACK_WEBHOOK_URL_AWARD が設定されていません",
    };
  }
  if (!webhookUrl.startsWith("https://hooks.slack.com/")) {
    return {
      ok: false,
      error: "Slack Webhook URL の形式が無効です",
    };
  }

  const supabase = await createServiceClient();
  const origin = process.env.NEXT_PUBLIC_APP_ORIGIN || "http://localhost:3000";

  if (kind === "enps") {
    const { data: survey, error } = await supabase
      .from("enps_surveys")
      .select("id, title")
      .eq("id", surveyId)
      .single();

    if (error || !survey) {
      return { ok: false, error: "eNPSアンケートが見つかりません" };
    }

    const names = await getUnansweredNames(
      supabase,
      "enps_responses",
      surveyId,
    );
    if (names === null) {
      return UNANSWERED_FETCH_FAILED;
    }
    if (names.length === 0) {
      return { ok: false, error: "未回答者がいません" };
    }

    const slackUsers = await getSlackUsersList();
    const { mentionText, unmatchedNames } = resolvePrivateUserNamesToMentions(
      names,
      slackUsers,
    );

    const surveyUrl = `${origin}/surveys/${surveyId}`;
    const linkLine = `<${surveyUrl}|アンケートに回答する>`;
    const header = `:incoming_envelope: *eNPSアンケート未回答のお願い*\n*${escapeSlackMrkdwn(survey.title)}*`;

    return postSlackWebhookReminder({
      webhookUrl,
      fallbackText: `eNPSアンケート未回答のお願い: ${survey.title}`,
      headerMrkdwn: header,
      mentionText,
      bodyText,
      linkLine,
      unmatchedNames,
    });
  }

  const { data: survey, error } = await supabase
    .from("award_surveys")
    .select("id, title")
    .eq("id", surveyId)
    .single();

  if (error || !survey) {
    return { ok: false, error: "表彰アンケートが見つかりません" };
  }

  const names = await getUnansweredNames(supabase, "award_responses", surveyId);
  if (names === null) {
    return UNANSWERED_FETCH_FAILED;
  }
  if (names.length === 0) {
    return { ok: false, error: "未回答者がいません" };
  }

  const slackUsers = await getSlackUsersList();
  const { mentionText, unmatchedNames } = resolvePrivateUserNamesToMentions(
    names,
    slackUsers,
  );

  const surveyUrl = `${origin}/surveys/award/${surveyId}`;
  const linkLine = `<${surveyUrl}|アンケートに回答する>`;
  const header = `:incoming_envelope: *表彰アンケート未回答のお願い*\n*${escapeSlackMrkdwn(survey.title)}*`;

  return postSlackWebhookReminder({
    webhookUrl,
    fallbackText: `表彰アンケート未回答のお願い: ${survey.title}`,
    headerMrkdwn: header,
    mentionText,
    bodyText,
    linkLine,
    unmatchedNames,
  });
}
