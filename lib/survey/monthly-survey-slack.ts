import { SLACK_MRKDWN_CHANNEL_MENTION } from "@/lib/slack/constants";
import { formatSurveyDateTimeJst } from "@/lib/survey/monthly-survey-deadline";

export function buildEnpsSurveySlackMessage(params: {
  yearMonthDisplay: string;
  surveyUrl: string;
  endDate: Date;
}) {
  const { yearMonthDisplay, surveyUrl, endDate } = params;
  return {
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
            text: `*回答期限:*\n${formatSurveyDateTimeJst(endDate)}`,
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
}

export function buildAwardSurveySlackMessage(params: {
  title: string;
  yearMonthDisplay: string;
  surveyUrl: string;
  endDate: Date;
}) {
  const { title, yearMonthDisplay, surveyUrl, endDate } = params;
  return {
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
            text: `*回答期限:*\n${formatSurveyDateTimeJst(endDate)}`,
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
}
