import {
  listAwardResponsesTool,
  listEnpsResponsesTool,
} from "@/lib/mcp/tools/survey-responses";

const listEnpsResponses = jest.fn();
const listAwardResponses = jest.fn();
const listSlackIdsByUserIds = jest.fn();

jest.mock("@/lib/mcp/privileged-client", () => ({
  listEnpsResponses: (...args: unknown[]) => listEnpsResponses(...args),
  listAwardResponses: (...args: unknown[]) => listAwardResponses(...args),
  getEnpsResponse: jest.fn(),
  getAwardResponse: jest.fn(),
  listSlackIdsByUserIds: (...args: unknown[]) => listSlackIdsByUserIds(...args),
}));

const googleRaw = {
  keyId: "google:owner@maisonmarc.com",
  scopes: ["survey_raw"] as const,
  label: "owner@maisonmarc.com",
  email: "owner@maisonmarc.com",
};

const googleRawAndSlack = {
  ...googleRaw,
  scopes: ["survey_raw", "slack_directory"] as const,
};

const surveyId = "11111111-1111-1111-1111-111111111111";

describe("list_enps_responses", () => {
  beforeEach(() => {
    listEnpsResponses.mockReset();
    listSlackIdsByUserIds.mockReset();
    listEnpsResponses.mockResolvedValue({
      items: [
        {
          id: "r1",
          survey_id: surveyId,
          question_id: "q1",
          user_id: "u1",
          score_value: 9,
          text_value: "良い",
        },
      ],
      survey_id: surveyId,
      limit: 50,
      offset: 0,
    });
    listSlackIdsByUserIds.mockResolvedValue(new Map([["u1", "U123"]]));
  });

  it("requires survey_id", () => {
    expect(listEnpsResponsesTool.input.safeParse({}).success).toBe(false);
    expect(
      listEnpsResponsesTool.input.safeParse({ survey_id: surveyId }).success,
    ).toBe(true);
  });

  it("clamps limit to 200 and does not attach slack without slack_directory", async () => {
    const result = (await listEnpsResponsesTool.execute(
      { survey_id: surveyId, limit: 500 },
      { db: {} as never, principal: googleRaw },
    )) as { limit: number; items: Array<{ slack_user_id?: string }> };
    expect(listEnpsResponses).toHaveBeenCalledWith(
      expect.objectContaining({ survey_id: surveyId, limit: 200 }),
    );
    expect(listSlackIdsByUserIds).not.toHaveBeenCalled();
    expect(result.items[0]?.slack_user_id).toBeUndefined();
  });

  it("attaches slack_user_id when the same principal has slack_directory", async () => {
    const result = (await listEnpsResponsesTool.execute(
      { survey_id: surveyId },
      { db: {} as never, principal: googleRawAndSlack },
    )) as { items: Array<{ slack_user_id?: string | null }> };
    expect(listSlackIdsByUserIds).toHaveBeenCalled();
    expect(result.items[0]?.slack_user_id).toBe("U123");
  });
});

describe("list_award_responses", () => {
  it("requires survey_id", () => {
    expect(listAwardResponsesTool.input.safeParse({}).success).toBe(false);
  });
});
