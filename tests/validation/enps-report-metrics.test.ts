import {
  MIN_DISCLOSURE_RESPONDENTS,
  UNASSIGNED_ORG_LABEL,
  buildEnpsSnapshotRows,
  shouldMaskForPrivacy,
} from "@/lib/admin/enps-report/build-snapshot";
import {
  fetchAllRows,
  fetchByIdChunks,
} from "@/lib/admin/enps-report/fetch-all";
import {
  computeNps,
  computeResponseRate,
  dedupeLatestByUser,
  scoreToSegment,
} from "@/lib/admin/enps-report/nps";

describe("scoreToSegment", () => {
  it("9点以上を推奨者、7〜8点を中立者、6点以下を批判者とする", () => {
    expect(scoreToSegment(10)).toBe("promoter");
    expect(scoreToSegment(9)).toBe("promoter");
    expect(scoreToSegment(8)).toBe("passive");
    expect(scoreToSegment(7)).toBe("passive");
    expect(scoreToSegment(6)).toBe("detractor");
    expect(scoreToSegment(0)).toBe("detractor");
  });
});

describe("computeNps", () => {
  it("回答者が0人なら nps は null（0 と区別する）", () => {
    const result = computeNps([]);
    expect(result.nps).toBeNull();
    expect(result.respondent_count).toBe(0);
    expect(result.promoters).toBe(0);
  });

  it("推奨者と批判者の割合差を整数パーセントで返す", () => {
    const result = computeNps([10, 9, 8, 5]);
    expect(result.promoters).toBe(2);
    expect(result.passives).toBe(1);
    expect(result.detractors).toBe(1);
    expect(result.nps).toBe(25);
  });

  it("全員が批判者なら -100", () => {
    expect(computeNps([0, 3, 6]).nps).toBe(-100);
  });

  it("全員が推奨者なら +100", () => {
    expect(computeNps([9, 10]).nps).toBe(100);
  });
});

describe("dedupeLatestByUser", () => {
  it("同一ユーザーは created_at が最新の行のみ残す", () => {
    const rows = dedupeLatestByUser([
      { user_id: "u1", created_at: "2026-01-01T00:00:00Z", score: 10 },
      { user_id: "u1", created_at: "2026-01-05T00:00:00Z", score: 3 },
      { user_id: "u2", created_at: "2026-01-02T00:00:00Z", score: 8 },
    ]);
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.user_id === "u1")?.score).toBe(3);
  });
});

describe("computeResponseRate", () => {
  it("対象者が0人なら null", () => {
    expect(computeResponseRate(0, 0)).toBeNull();
  });

  it("小数第1位まで返す", () => {
    expect(computeResponseRate(1, 3)).toBe(33.3);
    expect(computeResponseRate(5, 10)).toBe(50);
  });
});

describe("shouldMaskForPrivacy", () => {
  it("回答者が1人以上5人未満のときに伏せる", () => {
    expect(shouldMaskForPrivacy(1)).toBe(true);
    expect(shouldMaskForPrivacy(MIN_DISCLOSURE_RESPONDENTS - 1)).toBe(true);
    expect(shouldMaskForPrivacy(MIN_DISCLOSURE_RESPONDENTS)).toBe(false);
  });

  it("回答者0人は伏せる対象ではなく「データなし」として扱う", () => {
    expect(shouldMaskForPrivacy(0)).toBe(false);
  });
});

describe("buildEnpsSnapshotRows", () => {
  const questionId = "q1";

  const targets = [
    { user_id: "u1", company_name: "A社", business_unit_name: "営業" },
    { user_id: "u2", company_name: "A社", business_unit_name: "営業" },
    { user_id: "u3", company_name: "A社", business_unit_name: "開発" },
    { user_id: "u4", company_name: "B社", business_unit_name: "管理" },
  ];

  const response = (
    user_id: string,
    score_value: number,
    extra?: { is_late_submission?: boolean; created_at?: string },
  ) => ({
    question_id: questionId,
    user_id,
    score_value,
    is_late_submission: extra?.is_late_submission ?? false,
    created_at: extra?.created_at ?? "2026-01-10T00:00:00Z",
  });

  it("グループ・会社・事業部の3スコープを作る", () => {
    const rows = buildEnpsSnapshotRows({
      scoreQuestionIds: [questionId],
      targets,
      responses: [response("u1", 10), response("u4", 0)],
      includeImputed: false,
    });

    const group = rows.filter((r) => r.scope === "group");
    expect(group).toHaveLength(1);
    expect(group[0].target_count).toBe(4);
    expect(group[0].respondent_count).toBe(2);
    expect(group[0].nps_respondent_base).toBe(0);

    const companies = rows.filter((r) => r.scope === "company");
    expect(companies.map((r) => r.company_name).sort()).toEqual(["A社", "B社"]);

    const units = rows.filter((r) => r.scope === "business_unit");
    expect(units).toHaveLength(3);
  });

  it("会社行の対象者数は所属する全員、回答者数は回答した人数になる", () => {
    const rows = buildEnpsSnapshotRows({
      scoreQuestionIds: [questionId],
      targets,
      responses: [response("u1", 10)],
      includeImputed: false,
    });

    const companyA = rows.find(
      (r) => r.scope === "company" && r.company_name === "A社",
    );
    expect(companyA?.target_count).toBe(3);
    expect(companyA?.respondent_count).toBe(1);
    expect(companyA?.nps_respondent_base).toBe(100);
  });

  it("受付中は未回答補完を行わず nps_imputed_base を null にする", () => {
    const rows = buildEnpsSnapshotRows({
      scoreQuestionIds: [questionId],
      targets,
      responses: [response("u1", 10)],
      includeImputed: false,
    });

    const group = rows.find((r) => r.scope === "group");
    expect(group?.nps_imputed_base).toBeNull();
    expect(group?.nps_respondent_base).toBe(100);
  });

  it("締切後は未回答を0点として補完した指標も持つ", () => {
    const rows = buildEnpsSnapshotRows({
      scoreQuestionIds: [questionId],
      targets,
      responses: [response("u1", 10)],
      includeImputed: true,
    });

    const group = rows.find((r) => r.scope === "group");
    // 回答者ベースは1人が推奨者なので +100、補完すると推奨1・批判3 で -50
    expect(group?.nps_respondent_base).toBe(100);
    expect(group?.nps_imputed_base).toBe(-50);
  });

  it("期限後回答は集計に含めない", () => {
    const rows = buildEnpsSnapshotRows({
      scoreQuestionIds: [questionId],
      targets,
      responses: [response("u1", 10, { is_late_submission: true })],
      includeImputed: false,
    });

    const group = rows.find((r) => r.scope === "group");
    expect(group?.respondent_count).toBe(0);
    expect(group?.nps_respondent_base).toBeNull();
  });

  it("同一ユーザーの複数回答は最新のみ採用する", () => {
    const rows = buildEnpsSnapshotRows({
      scoreQuestionIds: [questionId],
      targets,
      responses: [
        response("u1", 10, { created_at: "2026-01-10T00:00:00Z" }),
        response("u1", 0, { created_at: "2026-01-20T00:00:00Z" }),
      ],
      includeImputed: false,
    });

    const group = rows.find((r) => r.scope === "group");
    expect(group?.respondent_count).toBe(1);
    expect(group?.detractors).toBe(1);
  });

  it("対象者に含まれないユーザーの回答は集計しない", () => {
    const rows = buildEnpsSnapshotRows({
      scoreQuestionIds: [questionId],
      targets,
      responses: [response("excluded-user", 10)],
      includeImputed: false,
    });

    const group = rows.find((r) => r.scope === "group");
    expect(group?.respondent_count).toBe(0);
  });

  it("所属が空のユーザーは未設定としてまとめる", () => {
    const rows = buildEnpsSnapshotRows({
      scoreQuestionIds: [questionId],
      targets: [{ user_id: "u1", company_name: "", business_unit_name: "" }],
      responses: [response("u1", 9)],
      includeImputed: false,
    });

    const company = rows.find((r) => r.scope === "company");
    expect(company?.company_name).toBe(UNASSIGNED_ORG_LABEL);
  });
});

describe("fetchAllRows", () => {
  it("1ページに満たなくなるまで range を進めて全件集める", async () => {
    const total = Array.from({ length: 5 }, (_, i) => ({ id: i }));
    const calls: [number, number][] = [];

    const rows = await fetchAllRows<{ id: number }>(
      (from, to) => {
        calls.push([from, to]);
        return Promise.resolve({
          data: total.slice(from, to + 1),
          error: null,
        });
      },
      { pageSize: 2 },
    );

    expect(rows).toHaveLength(5);
    expect(calls).toEqual([
      [0, 1],
      [2, 3],
      [4, 5],
    ]);
  });

  it("ちょうど1ページ分のときも次ページを確認して終了する", async () => {
    const total = [{ id: 1 }, { id: 2 }];
    const rows = await fetchAllRows<{ id: number }>(
      (from, to) =>
        Promise.resolve({ data: total.slice(from, to + 1), error: null }),
      { pageSize: 2 },
    );
    expect(rows).toHaveLength(2);
  });

  it("エラーはそのまま投げる", async () => {
    await expect(
      fetchAllRows(() =>
        Promise.resolve({ data: null, error: { message: "boom" } }),
      ),
    ).rejects.toThrow("boom");
  });
});

describe("fetchByIdChunks", () => {
  it("IDを分割して呼び出し、結果を連結する", async () => {
    const chunks: string[][] = [];
    const rows = await fetchByIdChunks<{ id: string }>(
      ["a", "b", "c", "d", "e"],
      (chunk) => {
        chunks.push(chunk);
        return Promise.resolve({
          data: chunk.map((id) => ({ id })),
          error: null,
        });
      },
      { chunkSize: 2 },
    );

    expect(chunks).toEqual([["a", "b"], ["c", "d"], ["e"]]);
    expect(rows).toHaveLength(5);
  });

  it("IDが空なら呼び出さない", async () => {
    const fetchChunk = jest.fn();
    const rows = await fetchByIdChunks<{ id: string }>([], fetchChunk);
    expect(rows).toEqual([]);
    expect(fetchChunk).not.toHaveBeenCalled();
  });
});
