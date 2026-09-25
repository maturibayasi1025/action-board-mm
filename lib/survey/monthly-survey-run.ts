export type ExistingMonthlySurvey = {
  id: string;
  slackNotifiedAt: string | null;
};

export type MonthlySurveyRunPlan =
  | { kind: "skip" }
  | { kind: "fail_missing_webhook" }
  | { kind: "create" }
  | { kind: "notify_existing"; surveyId: string };

export function planMonthlySurveyRun(input: {
  existing: ExistingMonthlySurvey | null;
  webhookConfigured: boolean;
}): MonthlySurveyRunPlan {
  if (input.existing) {
    return { kind: "skip" };
  }
  if (!input.webhookConfigured) {
    return { kind: "skip" };
  }
  return { kind: "create" };
}

type SlackWebhookResponse = {
  ok: boolean;
  status: number;
  text: () => Promise<string>;
};

type SlackWebhookFetch = (
  url: string,
  init: {
    method: string;
    headers: { "Content-Type": string };
    body: string;
  },
) => Promise<SlackWebhookResponse>;

export async function postSlackWebhook(
  webhookUrl: string,
  payload: unknown,
  fetchImpl: SlackWebhookFetch = fetch,
): Promise<void> {
  const response = await fetchImpl(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const responseText = await response.text();
    throw new Error(
      `Slack通知に失敗しました: ${response.status} ${responseText}`,
    );
  }
}
