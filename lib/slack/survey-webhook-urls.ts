/**
 * eNPS / 表彰アンケート用 Slack Incoming Webhook URL。
 * 種別専用の変数が未設定のときは `SLACK_WEBHOOK_URL` にフォールバックする。
 */

function trimOrUndefined(value: string | undefined): string | undefined {
  const t = value?.trim();
  return t ? t : undefined;
}

export function resolveEnpsSurveySlackWebhookUrl(): string | undefined {
  return (
    trimOrUndefined(process.env.SLACK_WEBHOOK_URL_ENPS) ??
    trimOrUndefined(process.env.SLACK_WEBHOOK_URL)
  );
}

export function resolveAwardSurveySlackWebhookUrl(): string | undefined {
  return (
    trimOrUndefined(process.env.SLACK_WEBHOOK_URL_AWARD) ??
    trimOrUndefined(process.env.SLACK_WEBHOOK_URL)
  );
}

export function isEnpsSurveySlackWebhookConfigured(): boolean {
  return !!resolveEnpsSurveySlackWebhookUrl();
}

export function isAwardSurveySlackWebhookConfigured(): boolean {
  return !!resolveAwardSurveySlackWebhookUrl();
}
