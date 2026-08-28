/**
 * eNPS / 表彰アンケート用 Slack Incoming Webhook URL。
 * 種別ごとのチャンネルへ送るため、専用変数のみを使う。
 * グッジョブ等の `SLACK_WEBHOOK_URL` にはフォールバックしない。
 */

function trimOrUndefined(value: string | undefined): string | undefined {
  const t = value?.trim();
  return t ? t : undefined;
}

export function resolveEnpsSurveySlackWebhookUrl(): string | undefined {
  return trimOrUndefined(process.env.SLACK_WEBHOOK_URL_ENPS);
}

export function resolveAwardSurveySlackWebhookUrl(): string | undefined {
  return trimOrUndefined(process.env.SLACK_WEBHOOK_URL_AWARD);
}

export function isEnpsSurveySlackWebhookConfigured(): boolean {
  return !!resolveEnpsSurveySlackWebhookUrl();
}

export function isAwardSurveySlackWebhookConfigured(): boolean {
  return !!resolveAwardSurveySlackWebhookUrl();
}
