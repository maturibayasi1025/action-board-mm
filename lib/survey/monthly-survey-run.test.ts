import { planMonthlySurveyRun, postSlackWebhook } from "./monthly-survey-run";

const notifiedAt = "2026-08-25T02:17:41.000Z";

describe("planMonthlySurveyRun", () => {
  it("当月が無ければ作成する", () => {
    expect(
      planMonthlySurveyRun({ existing: null, webhookConfigured: true }),
    ).toEqual({ kind: "create" });
  });

  it("投稿済みなら何もしない", () => {
    expect(
      planMonthlySurveyRun({
        existing: { id: "survey-1", slackNotifiedAt: notifiedAt },
        webhookConfigured: true,
      }),
    ).toEqual({ kind: "skip" });
  });

  it("作成済みで未投稿なら投稿だけ行う", () => {
    expect(
      planMonthlySurveyRun({
        existing: { id: "survey-1", slackNotifiedAt: null },
        webhookConfigured: true,
      }),
    ).toEqual({ kind: "notify_existing", surveyId: "survey-1" });
  });

  it("未投稿で Webhook が無いときは失敗する", () => {
    expect(
      planMonthlySurveyRun({ existing: null, webhookConfigured: false }),
    ).toEqual({ kind: "fail_missing_webhook" });
    expect(
      planMonthlySurveyRun({
        existing: { id: "survey-1", slackNotifiedAt: null },
        webhookConfigured: false,
      }),
    ).toEqual({ kind: "fail_missing_webhook" });
  });

  it("投稿済みなら Webhook が無くても何もしない", () => {
    expect(
      planMonthlySurveyRun({
        existing: { id: "survey-1", slackNotifiedAt: notifiedAt },
        webhookConfigured: false,
      }),
    ).toEqual({ kind: "skip" });
  });
});

describe("postSlackWebhook", () => {
  it("HTTP エラーなら失敗する", async () => {
    const fetchImpl = async () => {
      return {
        ok: false,
        status: 400,
        text: async () => "invalid_payload",
      };
    };

    await expect(
      postSlackWebhook(
        "https://hooks.slack.com/services/TEST",
        { text: "hello" },
        fetchImpl,
      ),
    ).rejects.toThrow("Slack通知に失敗しました: 400 invalid_payload");
  });

  it("HTTP 成功なら解決する", async () => {
    const fetchImpl = async () => {
      return {
        ok: true,
        status: 200,
        text: async () => "ok",
      };
    };

    await expect(
      postSlackWebhook(
        "https://hooks.slack.com/services/TEST",
        { text: "hello" },
        fetchImpl,
      ),
    ).resolves.toBeUndefined();
  });
});
