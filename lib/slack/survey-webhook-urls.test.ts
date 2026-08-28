import {
  isAwardSurveySlackWebhookConfigured,
  isEnpsSurveySlackWebhookConfigured,
  resolveAwardSurveySlackWebhookUrl,
  resolveEnpsSurveySlackWebhookUrl,
} from "./survey-webhook-urls";

describe("survey Slack webhook URL の解決", () => {
  const original = {
    defaultUrl: process.env.SLACK_WEBHOOK_URL,
    enpsUrl: process.env.SLACK_WEBHOOK_URL_ENPS,
    awardUrl: process.env.SLACK_WEBHOOK_URL_AWARD,
  };

  afterEach(() => {
    if (original.defaultUrl === undefined) {
      // biome-ignore lint/performance/noDelete: env cleanup requires delete in Node.js
      delete process.env.SLACK_WEBHOOK_URL;
    } else {
      process.env.SLACK_WEBHOOK_URL = original.defaultUrl;
    }
    if (original.enpsUrl === undefined) {
      // biome-ignore lint/performance/noDelete: env cleanup requires delete in Node.js
      delete process.env.SLACK_WEBHOOK_URL_ENPS;
    } else {
      process.env.SLACK_WEBHOOK_URL_ENPS = original.enpsUrl;
    }
    if (original.awardUrl === undefined) {
      // biome-ignore lint/performance/noDelete: env cleanup requires delete in Node.js
      delete process.env.SLACK_WEBHOOK_URL_AWARD;
    } else {
      process.env.SLACK_WEBHOOK_URL_AWARD = original.awardUrl;
    }
  });

  it("eNPS は専用URLだけを使い、共通Webhookへフォールバックしない", () => {
    process.env.SLACK_WEBHOOK_URL = "https://hooks.slack.com/services/DEFAULT";
    process.env.SLACK_WEBHOOK_URL_ENPS =
      "https://hooks.slack.com/services/ENPS";
    process.env.SLACK_WEBHOOK_URL_AWARD =
      "https://hooks.slack.com/services/AWARD";

    expect(resolveEnpsSurveySlackWebhookUrl()).toBe(
      "https://hooks.slack.com/services/ENPS",
    );
    expect(isEnpsSurveySlackWebhookConfigured()).toBe(true);
  });

  it("表彰は専用URLだけを使い、共通Webhookへフォールバックしない", () => {
    process.env.SLACK_WEBHOOK_URL = "https://hooks.slack.com/services/DEFAULT";
    process.env.SLACK_WEBHOOK_URL_ENPS = "";
    process.env.SLACK_WEBHOOK_URL_AWARD =
      "https://hooks.slack.com/services/AWARD";

    expect(resolveAwardSurveySlackWebhookUrl()).toBe(
      "https://hooks.slack.com/services/AWARD",
    );
    expect(isAwardSurveySlackWebhookConfigured()).toBe(true);
  });

  it("専用URLが未設定なら共通Webhookがあっても未設定扱いになる", () => {
    process.env.SLACK_WEBHOOK_URL = "https://hooks.slack.com/services/DEFAULT";
    process.env.SLACK_WEBHOOK_URL_ENPS = "  ";
    process.env.SLACK_WEBHOOK_URL_AWARD = "";

    expect(resolveEnpsSurveySlackWebhookUrl()).toBeUndefined();
    expect(resolveAwardSurveySlackWebhookUrl()).toBeUndefined();
    expect(isEnpsSurveySlackWebhookConfigured()).toBe(false);
    expect(isAwardSurveySlackWebhookConfigured()).toBe(false);
  });
});
