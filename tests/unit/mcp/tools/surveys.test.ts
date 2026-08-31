import {
  getAwardNominationRankingTool,
  listEnpsSurveysTool,
} from "@/lib/mcp/tools/surveys";

jest.mock("@/lib/mcp/privileged-client", () => ({
  listEnpsSurveys: jest.fn(async (input: { limit: number; year?: number }) => ({
    items: [{ id: "s1", title: "2026-01", year_month: "2026-01" }],
    questions: [{ id: "q1", question_text: "eNPS" }],
    limit: input.limit,
    offset: 0,
  })),
  listEnpsMonthlySnapshots: jest.fn(),
  getAwardNominationRanking: jest.fn(async (input: { survey_id?: string }) => ({
    survey_id: input.survey_id ?? null,
    survey_count: 1,
    groups: [],
  })),
}));

const principal = {
  keyId: "google:owner@maisonmarc.com",
  scopes: ["survey_agg"] as const,
  label: "owner@maisonmarc.com",
  email: "owner@maisonmarc.com",
};

describe("list_enps_surveys", () => {
  it("clamps limit and calls the privileged helper", async () => {
    const result = (await listEnpsSurveysTool.execute(
      { year: 2026, limit: 500 },
      { db: {} as never, principal },
    )) as { limit: number; items: unknown[] };
    expect(result.limit).toBe(100);
    expect(result.items).toHaveLength(1);
  });
});

describe("get_award_nomination_ranking", () => {
  it("requires survey_id or year+quarter", () => {
    const parsed = getAwardNominationRankingTool.input.safeParse({});
    expect(parsed.success).toBe(false);
  });

  it("accepts survey_id", () => {
    const parsed = getAwardNominationRankingTool.input.safeParse({
      survey_id: "11111111-1111-1111-1111-111111111111",
    });
    expect(parsed.success).toBe(true);
  });
});
