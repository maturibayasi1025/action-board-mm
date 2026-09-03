import {
  exportAwardResponsesCsvTool,
  exportEnpsResponsesCsvTool,
  listAwardResponsesTool,
  listEnpsResponsesTool,
} from "@/lib/mcp/tools/survey-responses";

const listEnpsResponses = jest.fn();
const listAwardResponses = jest.fn();
const listSlackIdsByUserIds = jest.fn();
const exportEnpsResponsesCsv = jest.fn();
const exportAwardResponsesCsv = jest.fn();

jest.mock("@/lib/mcp/privileged-client", () => ({
  listEnpsResponses: (...args: unknown[]) => listEnpsResponses(...args),
  listAwardResponses: (...args: unknown[]) => listAwardResponses(...args),
  getEnpsResponse: jest.fn(),
  getAwardResponse: jest.fn(),
  listSlackIdsByUserIds: (...args: unknown[]) => listSlackIdsByUserIds(...args),
  exportEnpsResponsesCsv: (...args: unknown[]) =>
    exportEnpsResponsesCsv(...args),
  exportAwardResponsesCsv: (...args: unknown[]) =>
    exportAwardResponsesCsv(...args),
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
  beforeEach(() => {
    listAwardResponses.mockReset();
    listSlackIdsByUserIds.mockReset();
    listAwardResponses.mockResolvedValue({
      items: [
        {
          id: "r1",
          survey_id: surveyId,
          question_id: "q1",
          user_id: "u1",
          nominee_user_id: "u2",
          text_value: "推薦",
        },
      ],
      survey_id: surveyId,
      limit: 50,
      offset: 0,
    });
    listSlackIdsByUserIds.mockResolvedValue(
      new Map([
        ["u1", "U123"],
        ["u2", "U456"],
      ]),
    );
  });

  it("requires survey_id", () => {
    expect(listAwardResponsesTool.input.safeParse({}).success).toBe(false);
  });

  it("attaches respondent and nominee slack ids when the principal has slack_directory", async () => {
    const result = (await listAwardResponsesTool.execute(
      { survey_id: surveyId },
      { db: {} as never, principal: googleRawAndSlack },
    )) as {
      items: Array<{
        slack_user_id?: string | null;
        nominee_slack_user_id?: string | null;
      }>;
    };
    expect(listSlackIdsByUserIds).toHaveBeenCalledWith(["u1", "u2"]);
    expect(result.items[0]?.slack_user_id).toBe("U123");
    expect(result.items[0]?.nominee_slack_user_id).toBe("U456");
  });
});

describe("export_enps_responses_csv", () => {
  beforeEach(() => {
    exportEnpsResponsesCsv.mockReset();
    exportEnpsResponsesCsv.mockResolvedValue({
      survey_id: surveyId,
      year_month: "2026-08",
      filename: "eNPS回答_2026-08.csv",
      csv: "氏名,会社,事業部,期限後,推奨度\n山田,Maison,企画,,9\n",
      row_count: 1,
      question_count: 1,
    });
  });

  it("requires survey_id or year_month", () => {
    expect(exportEnpsResponsesCsvTool.input.safeParse({}).success).toBe(false);
    expect(
      exportEnpsResponsesCsvTool.input.safeParse({ year_month: "2026-08" })
        .success,
    ).toBe(true);
    expect(
      exportEnpsResponsesCsvTool.input.safeParse({ survey_id: surveyId })
        .success,
    ).toBe(true);
  });

  it("exports the monthly csv without pagination", async () => {
    const result = (await exportEnpsResponsesCsvTool.execute(
      { year_month: "2026-08" },
      { db: {} as never, principal: googleRaw },
    )) as { filename: string; row_count: number };
    expect(exportEnpsResponsesCsv).toHaveBeenCalledWith({
      survey_id: undefined,
      year_month: "2026-08",
    });
    expect(result.filename).toBe("eNPS回答_2026-08.csv");
    expect(result.row_count).toBe(1);
  });
});

describe("export_award_responses_csv", () => {
  it("requires survey_id or year_month", () => {
    expect(exportAwardResponsesCsvTool.input.safeParse({}).success).toBe(false);
  });
});
