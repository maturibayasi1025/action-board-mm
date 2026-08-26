/**
 * Slack Incoming Webhook URL の解決。
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

export function resolveOfficeCheckSlackWebhookUrl(): string | undefined {
  return (
    trimOrUndefined(process.env.SLACK_WEBHOOK_URL_OFFICE_CHECK) ??
    trimOrUndefined(process.env.SLACK_WEBHOOK_URL)
  );
}

export function resolveSlackWebhookUrlForType(
  type: string | undefined,
): string | undefined {
  if (type === "office_closing_check") {
    return resolveOfficeCheckSlackWebhookUrl();
  }
  return trimOrUndefined(process.env.SLACK_WEBHOOK_URL);
}

export function isEnpsSurveySlackWebhookConfigured(): boolean {
  return !!resolveEnpsSurveySlackWebhookUrl();
}

export function isAwardSurveySlackWebhookConfigured(): boolean {
  return !!resolveAwardSurveySlackWebhookUrl();
}
