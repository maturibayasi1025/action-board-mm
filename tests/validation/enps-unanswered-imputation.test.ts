import { computeNpsBreakdownFromScores } from "@/lib/admin/enps-monthly-series";
import {
  filterUserIdsByOrg,
  isEnpsSurveyEnded,
  listImputedUserIdsForQuestion,
  userIdsWithScoreByQuestionId,
} from "@/lib/admin/enps-unanswered-imputation";

describe("isEnpsSurveyEnded", () => {
  it("end_date と同じ瞬間から終了とみなす", () => {
    const end = "2026-06-01T12:00:00.000Z";
    expect(isEnpsSurveyEnded(end, new Date("2026-06-01T12:00:00.000Z"))).toBe(
      true,
    );
    expect(isEnpsSurveyEnded(end, new Date("2026-06-01T11:59:59.999Z"))).toBe(
      false,
    );
  });
});

describe("userIdsWithScoreByQuestionId", () => {
  it("スコアがある質問ごとにユーザーIDを集める", () => {
    const m = userIdsWithScoreByQuestionId([
      { question_id: "q1", user_id: "a", score_value: 10 },
      { question_id: "q1", user_id: "b", score_value: 5 },
      { question_id: "q2", user_id: "a", score_value: null },
    ]);
    expect(m.get("q1")?.has("a")).toBe(true);
    expect(m.get("q1")?.has("b")).toBe(true);
    expect(m.has("q2")).toBe(false);
  });
});

describe("listImputedUserIdsForQuestion", () => {
  it("eligible からスコア済みを除いたユーザーが未回答インプット対象", () => {
    const eligible = new Set(["u1", "u2", "u3"]);
    const withScore = new Set(["u1"]);
    expect(listImputedUserIdsForQuestion(eligible, withScore).sort()).toEqual([
      "u2",
      "u3",
    ]);
  });
});

describe("filterUserIdsByOrg", () => {
  it("会社・事業部が一致するユーザーだけ残す", () => {
    const map = new Map([
      ["a", { company_name: "A", business_unit_name: "営業" }],
      ["b", { company_name: "B", business_unit_name: "開発" }],
    ]);
    expect(filterUserIdsByOrg(["a", "b"], map, "A", "営業")).toEqual(["a"]);
  });

  it("事業部名を省略すると会社単位ですべて残す", () => {
    const map = new Map([
      ["a", { company_name: "A", business_unit_name: "営業" }],
      ["b", { company_name: "A", business_unit_name: "開発" }],
      ["c", { company_name: "B", business_unit_name: "開発" }],
    ]);
    expect(filterUserIdsByOrg(["a", "b", "c"], map, "A")).toEqual(["a", "b"]);
    expect(filterUserIdsByOrg(["a", "b", "c"], map, "A", null)).toEqual([
      "a",
      "b",
    ]);
    expect(filterUserIdsByOrg(["a", "b", "c"], map, "A", "")).toEqual([
      "a",
      "b",
    ]);
  });
});

describe("NPS with imputed zeros", () => {
  it("期限内2件＋未回答1人分の0で母数3・批判者に含まれる", () => {
    const scores = [10, 8, 0];
    const m = computeNpsBreakdownFromScores(scores);
    expect(m.respondent_count).toBe(3);
    expect(m.promoters).toBe(1);
    expect(m.passives).toBe(1);
    expect(m.detractors).toBe(1);
    expect(m.nps).toBe(0);
  });
});
