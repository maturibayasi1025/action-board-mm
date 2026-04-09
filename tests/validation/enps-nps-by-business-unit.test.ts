import {
  aggregateNpsByBusinessUnitForQuestion,
  type EnpsResponseForOrgAggregate,
} from "@/lib/admin/enps-nps-by-business-unit";

describe("aggregateNpsByBusinessUnitForQuestion", () => {
  const qid = "q1";

  it("集計を会社・事業部バケットに分け、NPSを算出する", () => {
    const responses: EnpsResponseForOrgAggregate[] = [
      {
        question_id: qid,
        user_id: "u1",
        score_value: 10,
        is_late_submission: false,
        created_at: "2026-01-01T00:00:00Z",
        company_name: "A社",
        business_unit_name: "営業",
      },
      {
        question_id: qid,
        user_id: "u2",
        score_value: 6,
        is_late_submission: false,
        created_at: "2026-01-01T00:00:00Z",
        company_name: "A社",
        business_unit_name: "営業",
      },
      {
        question_id: qid,
        user_id: "u3",
        score_value: 6,
        is_late_submission: false,
        created_at: "2026-01-01T00:00:00Z",
        company_name: "B社",
        business_unit_name: "開発",
      },
    ];

    const rows = aggregateNpsByBusinessUnitForQuestion(
      responses,
      qid,
      "on_time",
    );
    expect(rows).toHaveLength(2);

    const buA = rows.find(
      (r) => r.company_name === "A社" && r.business_unit_name === "営業",
    );
    expect(buA?.respondent_count).toBe(2);
    expect(buA?.promoters).toBe(1);
    expect(buA?.detractors).toBe(1);
    expect(buA?.nps).toBe(0);

    const buB = rows.find(
      (r) => r.company_name === "B社" && r.business_unit_name === "開発",
    );
    expect(buB?.respondent_count).toBe(1);
    expect(buB?.nps).toBe(-100);
  });

  it("同一ユーザーの複数行は最新のみ採用する", () => {
    const responses: EnpsResponseForOrgAggregate[] = [
      {
        question_id: qid,
        user_id: "u1",
        score_value: 10,
        is_late_submission: false,
        created_at: "2026-01-01T00:00:00Z",
        company_name: "A社",
        business_unit_name: "営業",
      },
      {
        question_id: qid,
        user_id: "u1",
        score_value: 0,
        is_late_submission: false,
        created_at: "2026-01-02T00:00:00Z",
        company_name: "A社",
        business_unit_name: "営業",
      },
    ];

    const rows = aggregateNpsByBusinessUnitForQuestion(
      responses,
      qid,
      "on_time",
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.respondent_count).toBe(1);
    expect(rows[0]?.detractors).toBe(1);
    expect(rows[0]?.nps).toBe(-100);
  });

  it("期限後は on_time から除外し、late_only でのみ含める", () => {
    const responses: EnpsResponseForOrgAggregate[] = [
      {
        question_id: qid,
        user_id: "u1",
        score_value: 10,
        is_late_submission: true,
        created_at: "2026-01-01T00:00:00Z",
        company_name: "A社",
        business_unit_name: "営業",
      },
    ];

    expect(
      aggregateNpsByBusinessUnitForQuestion(responses, qid, "on_time"),
    ).toHaveLength(0);
    expect(
      aggregateNpsByBusinessUnitForQuestion(responses, qid, "late_only"),
    ).toHaveLength(1);
  });
});
