/**
 * @jest-environment node
 */
import { sendSlackReminderToUnanswered } from "@/app/(protected)/admin/_actions/slack-unanswered-reminder";
import { getAwardSurveyResponses } from "@/app/(protected)/admin/award-surveys/[id]/actions";
import { getSurveyResponses } from "@/app/(protected)/admin/enps-surveys/[id]/actions";
import { getSurveys } from "@/app/(protected)/admin/enps-surveys/actions";
import { getEnpsMonthlyTrendsForQuestion } from "@/app/(protected)/admin/enps-surveys/trends/actions";
import { createServiceClient } from "@/lib/supabase/server";
import { createFakePostgrest } from "./fake-postgrest";

jest.mock("@/lib/supabase/server", () => ({
  createServiceClient: jest.fn(),
}));
jest.mock("@/lib/utils/isOwner", () => ({
  requireOwner: jest.fn(),
}));
jest.mock("next/cache", () => ({
  revalidatePath: jest.fn(),
}));
jest.mock("@/lib/slack/slack-users", () => ({
  ...jest.requireActual("@/lib/slack/slack-users"),
  getSlackUsersList: jest.fn(async () => []),
}));

const ENPS_SURVEY_ID = "survey-enps";
const AWARD_SURVEY_ID = "survey-award";
const DUMMY_WEBHOOK = "https://hooks.slack.com/services/TDUMMY/BDUMMY/dummy";

const tables = () => ({
  private_users: [
    { id: "user-a", name: "社員A", suspended_at: null },
    { id: "user-b", name: "社員B", suspended_at: null },
  ],
  unanswered_survey_global_exclusions: [],
  enps_surveys: [
    {
      id: ENPS_SURVEY_ID,
      title: "2026年10月 eNPS",
      year_month: "2026-10",
      is_active: true,
      created_at: "2026-10-01T00:00:00Z",
      end_date: "2026-10-31T14:59:59Z",
    },
  ],
  award_surveys: [{ id: AWARD_SURVEY_ID, title: "2026年 Q3 表彰" }],
  enps_questions: [
    {
      id: "q1",
      question_text: "推奨度",
      question_type: "score_0_10",
      display_order: 1,
      is_active: true,
    },
  ],
  award_questions: [
    {
      id: "a1",
      question_text: "推薦",
      question_type: "user_select",
      question_group: "passionate_execution",
      display_order: 1,
      is_active: true,
    },
  ],
  enps_responses: [
    {
      id: "enps-1",
      survey_id: ENPS_SURVEY_ID,
      user_id: "user-a",
      question_id: "q1",
      score_value: 9,
      text_value: null,
      created_at: "2026-10-02T00:00:00Z",
      is_late_submission: false,
    },
  ],
  award_responses: [
    {
      id: "award-1",
      survey_id: AWARD_SURVEY_ID,
      user_id: "user-a",
      question_id: "a1",
      text_value: null,
      nominee_user_id: "user-b",
      created_at: "2026-10-02T00:00:00Z",
      is_late_submission: false,
    },
  ],
});

function useClient(failingTables: string[] = []) {
  jest
    .mocked(createServiceClient)
    .mockResolvedValue(
      createFakePostgrest(tables(), { failingTables }) as Awaited<
        ReturnType<typeof createServiceClient>
      >,
    );
}

describe("Slack リマインドは未回答者の取得に失敗したら送らない", () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => "ok",
    }));
    global.fetch = fetchMock as unknown as typeof fetch;
    process.env.SLACK_WEBHOOK_URL_ENPS = DUMMY_WEBHOOK;
    process.env.SLACK_WEBHOOK_URL_AWARD = DUMMY_WEBHOOK;
    process.env.SLACK_BOT_TOKEN = "";
  });

  it.each([
    ["enps", ENPS_SURVEY_ID, "enps_responses"],
    ["award", AWARD_SURVEY_ID, "award_responses"],
  ] as const)("%s", async (kind, surveyId, responseTable) => {
    useClient([responseTable]);
    const result = await sendSlackReminderToUnanswered({
      kind,
      surveyId,
      message: "",
    });

    expect(result).toEqual({
      ok: false,
      error: "未回答者の取得に失敗しました",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("取得できれば送る（同じ構成で送信が観測できることの確認）", async () => {
    useClient();
    const result = await sendSlackReminderToUnanswered({
      kind: "enps",
      surveyId: ENPS_SURVEY_ID,
      message: "",
    });

    expect(result).toEqual({ ok: true, unmatchedNames: ["社員B"] });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("集計は取得に失敗したら空や 0 を返さず例外にする", () => {
  it("eNPS アンケート一覧のユニーク回答者数", async () => {
    useClient(["enps_responses"]);
    await expect(getSurveys()).rejects.toThrow();
  });

  it("eNPS 集計の回答取得", async () => {
    useClient(["enps_responses"]);
    await expect(getSurveyResponses(ENPS_SURVEY_ID)).rejects.toThrow();
  });

  it("eNPS 推移", async () => {
    useClient(["enps_responses"]);
    await expect(getEnpsMonthlyTrendsForQuestion("q1")).rejects.toThrow();
  });

  it("表彰 集計の回答取得", async () => {
    useClient(["award_responses"]);
    await expect(getAwardSurveyResponses(AWARD_SURVEY_ID)).rejects.toThrow();
  });

  it("取得できれば値を返す（同じ構成で成功が観測できることの確認）", async () => {
    useClient();
    const [survey] = await getSurveys();
    expect(survey.unique_response_count).toBe(1);
    const enps = await getSurveyResponses(ENPS_SURVEY_ID);
    expect(enps.uniqueRespondentCount).toBe(1);
    const [point] = await getEnpsMonthlyTrendsForQuestion("q1");
    expect(point.respondent_count).toBe(2);
    const award = await getAwardSurveyResponses(AWARD_SURVEY_ID);
    expect(award.responses).toHaveLength(1);
  });
});
