/**
 * @jest-environment node
 */
import { sendSlackNotificationForMissionCreation } from "@/app/(protected)/user-missions/_actions/_helpers";
import { createFakePostgrest, pad } from "../survey/fake-postgrest";

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(),
  createServiceClient: jest.fn(),
}));

const CREATOR_ID = "user-creator";
const PRAISED = 600;

const range = (n: number) => Array.from({ length: n }, (_, i) => i);
const userId = (i: number) => `user-${pad(i)}`;

beforeEach(() => {
  jest.spyOn(console, "log").mockImplementation(() => {});
  jest.spyOn(console, "warn").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("グッジョブ投稿の Slack 通知", () => {
  it(`称賛対象が ${PRAISED} 人でも、全員の名前を選んだ順に送る`, async () => {
    const praisedIds = range(PRAISED).map(userId).reverse();
    const supabase = createFakePostgrest({
      private_users: [
        { id: CREATOR_ID, name: "投稿者", slack_user_id: null },
        ...range(PRAISED).map((i) => ({
          id: userId(i),
          name: `社員${pad(i)}`,
          slack_user_id: null,
        })),
      ],
    });
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ success: true })));

    await sendSlackNotificationForMissionCreation(
      "mission-0001",
      "タイトル",
      "本文",
      CREATOR_ID,
      praisedIds,
      [],
      [],
      supabase as never,
    );

    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(
      body.data.praisedInternalUsers.map((u: { name: string }) => u.name),
    ).toEqual(
      range(PRAISED)
        .reverse()
        .map((i) => `社員${pad(i)}`),
    );
  });
});
