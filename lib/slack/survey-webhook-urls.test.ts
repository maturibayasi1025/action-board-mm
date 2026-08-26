import {
  resolveOfficeCheckSlackWebhookUrl,
  resolveSlackWebhookUrlForType,
} from "./survey-webhook-urls";

describe("resolveSlackWebhookUrlForType", () => {
  const original = {
    defaultUrl: process.env.SLACK_WEBHOOK_URL,
    officeUrl: process.env.SLACK_WEBHOOK_URL_OFFICE_CHECK,
  };

  afterEach(() => {
    process.env.SLACK_WEBHOOK_URL = original.defaultUrl ?? "";
    process.env.SLACK_WEBHOOK_URL_OFFICE_CHECK = original.officeUrl ?? "";
  });

  it("最終チェックは専用URLを優先する", () => {
    process.env.SLACK_WEBHOOK_URL = "https://hooks.slack.com/services/DEFAULT";
    process.env.SLACK_WEBHOOK_URL_OFFICE_CHECK =
      "https://hooks.slack.com/services/OFFICE";
    expect(resolveSlackWebhookUrlForType("office_closing_check")).toBe(
      "https://hooks.slack.com/services/OFFICE",
    );
    expect(resolveOfficeCheckSlackWebhookUrl()).toBe(
      "https://hooks.slack.com/services/OFFICE",
    );
  });

  it("専用URLが無ければデフォルトにフォールバックする", () => {
    process.env.SLACK_WEBHOOK_URL = "https://hooks.slack.com/services/DEFAULT";
    process.env.SLACK_WEBHOOK_URL_OFFICE_CHECK = "";
    expect(resolveSlackWebhookUrlForType("office_closing_check")).toBe(
      "https://hooks.slack.com/services/DEFAULT",
    );
  });

  it("グッジョブ通知はデフォルトURLを使う", () => {
    process.env.SLACK_WEBHOOK_URL = "https://hooks.slack.com/services/DEFAULT";
    process.env.SLACK_WEBHOOK_URL_OFFICE_CHECK =
      "https://hooks.slack.com/services/OFFICE";
    expect(resolveSlackWebhookUrlForType("user_mission_created")).toBe(
      "https://hooks.slack.com/services/DEFAULT",
    );
  });
});
