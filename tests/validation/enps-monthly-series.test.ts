import {
  computeNpsBreakdownFromScores,
  dedupeLatestScorePerUser,
} from "@/lib/admin/enps-monthly-series";

describe("dedupeLatestScorePerUser", () => {
  it("同一ユーザーは created_at が最新のスコアのみ残す", () => {
    const scores = dedupeLatestScorePerUser([
      {
        user_id: "u1",
        score_value: 10,
        created_at: "2026-01-01T00:00:00Z",
      },
      {
        user_id: "u1",
        score_value: 4,
        created_at: "2026-01-02T00:00:00Z",
      },
      {
        user_id: "u2",
        score_value: 9,
        created_at: "2026-01-01T00:00:00Z",
      },
    ]);
    expect(scores.sort((a, b) => a - b)).toEqual([4, 9]);
  });
});

describe("computeNpsBreakdownFromScores", () => {
  it("空配列は nps null", () => {
    const m = computeNpsBreakdownFromScores([]);
    expect(m.nps).toBeNull();
    expect(m.respondent_count).toBe(0);
  });

  it("NPS を整数パーセントで返す", () => {
    const m = computeNpsBreakdownFromScores([10, 10, 4, 4]);
    expect(m.promoters).toBe(2);
    expect(m.detractors).toBe(2);
    expect(m.passives).toBe(0);
    expect(m.respondent_count).toBe(4);
    expect(m.nps).toBe(0);
  });
});
