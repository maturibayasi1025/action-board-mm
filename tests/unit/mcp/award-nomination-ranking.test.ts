import {
  aggregateTopFiveForQuestion,
  buildAwardNominationGroups,
  fiscalPeriodFromYearMonth,
} from "@/lib/mcp/award-nomination-ranking";

const question = {
  id: "q1",
  question_text: "誰を指名しますか",
  question_type: "user_select",
  question_group: "passionate_execution",
  display_order: 1,
  is_active: true,
};

describe("award nomination ranking", () => {
  it("parses fiscal period from year_month", () => {
    expect(fiscalPeriodFromYearMonth("2026-05")).toEqual({
      year: 2026,
      quarter: 1,
      label: expect.any(String),
    });
  });

  it("uses public profile names and skips unknown nominees", () => {
    const rows = aggregateTopFiveForQuestion(
      [
        { question_id: "q1", text_value: null, nominee_user_id: "u1" },
        { question_id: "q1", text_value: null, nominee_user_id: "u1" },
        { question_id: "q1", text_value: null, nominee_user_id: "missing" },
        { question_id: "q1", text_value: "手入力", nominee_user_id: null },
      ],
      question,
      new Map([["u1", "公開名A"]]),
    );
    expect(rows[0]).toEqual({
      name: "公開名A",
      votes: 2,
      nominee_user_id: "u1",
    });
    expect(rows.some((row) => row.name === "手入力")).toBe(true);
    expect(rows.some((row) => row.nominee_user_id === "missing")).toBe(false);
  });

  it("builds empty groups when no nomination question exists", () => {
    const groups = buildAwardNominationGroups([], [], new Map());
    expect(groups).toHaveLength(4);
    expect(groups.every((group) => group.rows.length === 0)).toBe(true);
  });
});
