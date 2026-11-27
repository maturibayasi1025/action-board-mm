/**
 * @jest-environment node
 */
import { sendSlackReminderToUnanswered } from "@/app/(protected)/admin/_actions/slack-unanswered-reminder";
import { getAwardUnansweredUsers } from "@/app/(protected)/admin/award-surveys/[id]/actions";
import {
  getSurveyResponses,
  getUnansweredUsers,
} from "@/app/(protected)/admin/enps-surveys/[id]/actions";
import { getSurveys } from "@/app/(protected)/admin/enps-surveys/actions";
import {
  getEnpsMonthlyScoreExportRows,
  getEnpsMonthlyTrendsForQuestion,
} from "@/app/(protected)/admin/enps-surveys/trends/actions";
import {
  fetchScoreResponsesForSurvey,
  fetchSnapshotTargets,
} from "@/lib/admin/enps-report/data-access";
import { createServiceClient } from "@/lib/supabase/server";
import { fetchGlobalExcludedUserIds } from "@/lib/survey/unanswered-candidates";
import { createFakePostgrest, pad } from "./fake-postgrest";

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

const ACTIVE_USERS = 1200;
const ANSWERED_USERS = 1150;
const EXCLUDED_UNANSWERED = ACTIVE_USERS - 1;

const userId = (i: number) => `user-${pad(i)}`;
const userName = (i: number) => `社員${pad(i)}`;
const range = (from: number, to: number) =>
  Array.from({ length: to - from }, (_, k) => from + k);

const expectedUnansweredIds = range(ANSWERED_USERS, ACTIVE_USERS)
  .filter((i) => i !== EXCLUDED_UNANSWERED)
  .map(userId);

function buildTables() {
  const privateUsers = [
    ...range(0, ACTIVE_USERS).map((i) => ({
      id: userId(i),
      name: userName(i),
      suspended_at: null,
    })),
    ...range(0, 3).map((i) => ({
      id: `suspended-${i}`,
      name: `休止${i}`,
      suspended_at: "2026-01-01T00:00:00Z",
    })),
  ];

  const exclusions = [
    ...range(0, 1000).map((i) => ({ user_id: userId(i) })),
    { user_id: userId(EXCLUDED_UNANSWERED) },
  ];

  const enpsResponses = range(0, ANSWERED_USERS).flatMap((i) => {
    const createdAt = new Date(Date.UTC(2026, 9, 1, 0, 0, i)).toISOString();
    const base = {
      survey_id: ENPS_SURVEY_ID,
      user_id: userId(i),
      created_at: createdAt,
      is_late_submission: false,
    };
    return [
      {
        ...base,
        id: `enps-${pad(i)}-1`,
        question_id: "q1",
        score_value: i % 11,
        text_value: null,
      },
      {
        ...base,
        id: `enps-${pad(i)}-2`,
        question_id: "q2",
        score_value: 9,
        text_value: null,
      },
      {
        ...base,
        id: `enps-${pad(i)}-3`,
        question_id: "q3",
        score_value: null,
        text_value: "コメント",
      },
    ];
  });

  const awardResponses = range(0, ANSWERED_USERS).flatMap((i) => [
    {
      id: `award-${pad(i)}-1`,
      survey_id: AWARD_SURVEY_ID,
      user_id: userId(i),
      question_id: "a1",
    },
    {
      id: `award-${pad(i)}-2`,
      survey_id: AWARD_SURVEY_ID,
      user_id: userId(i),
      question_id: "a2",
    },
  ]);

  return {
    private_users: privateUsers,
    unanswered_survey_global_exclusions: exclusions,
    enps_responses: enpsResponses,
    award_responses: awardResponses,
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
      {
        id: "q2",
        question_text: "満足度",
        question_type: "score_0_10",
        display_order: 2,
        is_active: true,
      },
      {
        id: "q3",
        question_text: "自由記述",
        question_type: "text",
        display_order: 3,
        is_active: true,
      },
    ],
  };
}

const sortedIds = (rows: { id: string }[]) => rows.map((r) => r.id).sort();

describe("1000 行を超えるアンケートでも回答済みの人を未回答にしない", () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    jest
      .mocked(createServiceClient)
      .mockResolvedValue(
        createFakePostgrest(buildTables()) as Awaited<
          ReturnType<typeof createServiceClient>
        >,
      );
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

  it("eNPS 管理画面の未回答一覧", async () => {
    const unanswered = await getUnansweredUsers(ENPS_SURVEY_ID);
    expect(sortedIds(unanswered)).toEqual(expectedUnansweredIds);
  });

  it("表彰 管理画面の未回答一覧", async () => {
    const unanswered = await getAwardUnansweredUsers(AWARD_SURVEY_ID);
    expect(sortedIds(unanswered)).toEqual(expectedUnansweredIds);
  });

  it.each([
    ["enps", ENPS_SURVEY_ID],
    ["award", AWARD_SURVEY_ID],
  ] as const)("Slack リマインド（%s）の宛先", async (kind, surveyId) => {
    const result = await sendSlackReminderToUnanswered({
      kind,
      surveyId,
      message: "",
    });

    const expectedNames = range(ANSWERED_USERS, ACTIVE_USERS)
      .filter((i) => i !== EXCLUDED_UNANSWERED)
      .map(userName);
    expect(result).toEqual({ ok: true, unmatchedNames: expectedNames });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(DUMMY_WEBHOOK);
    const body = String(init.body);
    expect(body).toContain(userName(ANSWERED_USERS));
    expect(body).not.toContain(userName(ANSWERED_USERS - 1));
    expect(body).not.toContain(userName(0));
  });

  it("グローバル除外は 1000 件を超えても全件返す", async () => {
    const excluded = await fetchGlobalExcludedUserIds(
      await createServiceClient(),
    );
    expect(excluded.size).toBe(1001);
    expect(excluded.has(userId(EXCLUDED_UNANSWERED))).toBe(true);
  });

  it("eNPS 集計の回答者数・回答者名・終了後の未回答補完", async () => {
    const result = await getSurveyResponses(ENPS_SURVEY_ID);

    expect(result.uniqueRespondentCount).toBe(ANSWERED_USERS);
    expect(result.responses).toHaveLength(ANSWERED_USERS * 3);
    expect(result.responses.filter((r) => r.user_name === "不明")).toEqual([]);

    const imputedQ1 = result.imputedDrilldownRows
      .filter((r) => r.question_id === "q1")
      .map((r) => r.user_id)
      .sort();
    expect(imputedQ1).toEqual(expectedUnansweredIds);
    expect(
      result.imputedDrilldownRows.every((r) => r.user_name !== "不明"),
    ).toBe(true);
    expect(result.npsData.q1.scores).toHaveLength(
      ANSWERED_USERS + expectedUnansweredIds.length,
    );
  });

  it("eNPS アンケート一覧のユニーク回答者数", async () => {
    const [survey] = await getSurveys();
    expect(survey.unique_response_count).toBe(ANSWERED_USERS);
  });

  it("eNPS 推移の回答者数（終了後の未回答補完込み）", async () => {
    const [point] = await getEnpsMonthlyTrendsForQuestion("q1");
    expect(point.respondent_count).toBe(
      ANSWERED_USERS + expectedUnansweredIds.length,
    );
  });

  it("eNPS 月次スコア CSV の回答行と未回答補完行", async () => {
    const result = await getEnpsMonthlyScoreExportRows("q1", ENPS_SURVEY_ID);
    if (!result.ok) throw new Error(result.error);

    const onTime = result.rows.filter((r) => r.row_kind === "on_time");
    const imputed = result.rows
      .filter((r) => r.row_kind === "imputed_zero")
      .map((r) => r.user_id)
      .sort();
    expect(onTime).toHaveLength(ANSWERED_USERS);
    expect(imputed).toEqual(expectedUnansweredIds);
  });

  it("スナップショットの母数とスコア回答を欠けも重複もなく返す", async () => {
    const supabase = await createServiceClient();

    const targets = await fetchSnapshotTargets(supabase);
    expect(targets.map((t) => t.user_id).sort()).toEqual(
      range(1000, ACTIVE_USERS - 1).map(userId),
    );

    const scores = await fetchScoreResponsesForSurvey(supabase, ENPS_SURVEY_ID);
    expect(scores).toHaveLength(ANSWERED_USERS * 2);
    expect(
      new Set(scores.map((r) => `${r.user_id}:${r.question_id}`)).size,
    ).toBe(ANSWERED_USERS * 2);
  });
});
