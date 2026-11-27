/**
 * @jest-environment node
 */
import {
  listAwardResponses,
  listEnpsMonthlySnapshots,
  listEnpsResponses,
  listSlackDirectory,
} from "@/lib/mcp/privileged-client";
import { createClient } from "@supabase/supabase-js";
import { createFakePostgrest, pad } from "../survey/fake-postgrest";

jest.mock("@supabase/supabase-js", () => ({
  ...jest.requireActual("@supabase/supabase-js"),
  createClient: jest.fn(),
}));

const ROWS = 1200;
const PAGE = 100;
const SURVEY_ID = "survey-1";
const SAME_INSTANT = "2026-11-01T00:00:00.000Z";
const range = (n: number) => Array.from({ length: n }, (_, i) => i);

const response = (i: number) => ({
  id: `response-${pad(i)}`,
  survey_id: SURVEY_ID,
  question_id: "question-1",
  user_id: `user-${pad(i)}`,
  score_value: 8,
  nominee_user_id: null,
  text_value: null,
  is_late_submission: false,
  created_at: SAME_INSTANT,
});

async function collectPages(
  fetchPage: (offset: number) => Promise<{ items: { id: string }[] }>,
): Promise<string[]> {
  const seen: string[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const { items } = await fetchPage(offset);
    if (items.length === 0) return seen;
    seen.push(...items.map((item) => item.id));
  }
}

describe("MCP の limit/offset ページングは同時刻の行でも欠けも重複もない", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "dummy";
    jest.mocked(createClient).mockReturnValue(
      createFakePostgrest({
        enps_responses: range(ROWS).map(response),
        award_responses: range(ROWS).map(response),
        enps_questions: [{ id: "question-1", question_text: "設問" }],
        award_questions: [{ id: "question-1", question_text: "設問" }],
        public_user_profiles: range(ROWS).map((i) => ({
          id: `user-${pad(i)}`,
          name: `社員${pad(i)}`,
        })),
        private_users: range(ROWS).map((i) => ({
          id: `user-${pad(i)}`,
          slack_user_id: `U${pad(i)}`,
          suspended_at: null,
        })),
        enps_monthly_snapshots: range(ROWS).map((i) => ({
          id: `snapshot-${pad(i)}`,
          survey_id: SURVEY_ID,
          question_id: "question-1",
          computed_at: SAME_INSTANT,
        })),
        enps_surveys: [{ id: SURVEY_ID, year_month: "2026-11" }],
      }) as unknown as ReturnType<typeof createClient>,
    );
  });

  it.each([
    ["eNPS 個別回答", listEnpsResponses],
    ["表彰 個別回答", listAwardResponses],
  ] as const)("%s", async (_label, list) => {
    const seen = await collectPages((offset) =>
      list({ survey_id: SURVEY_ID, limit: PAGE, offset }),
    );
    expect([...seen].sort()).toEqual(
      range(ROWS).map((i) => `response-${pad(i)}`),
    );
  });

  it("eNPS 月次スナップショット", async () => {
    const seen = await collectPages((offset) =>
      listEnpsMonthlySnapshots({ limit: PAGE, offset }),
    );
    expect([...seen].sort()).toEqual(
      range(ROWS).map((i) => `snapshot-${pad(i)}`),
    );
  });

  it("Slack 対応表の名前検索（一致が 500 人を超える）", async () => {
    const seen = await collectPages(async (offset) => {
      const page = await listSlackDirectory({
        query: "社員",
        include_missing: false,
        limit: PAGE,
        offset,
      });
      return { items: page.items.map((item) => ({ id: item.user_id })) };
    });
    expect(seen).toEqual(range(ROWS).map((i) => `user-${pad(i)}`));
  });
});
