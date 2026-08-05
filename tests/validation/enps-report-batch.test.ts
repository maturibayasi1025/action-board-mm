import {
  buildAiSummaryInputsByCompany,
  buildAiSummaryPrompt,
  parseAiSummaryPayload,
  resolveAiSummaryConfig,
} from "@/lib/admin/enps-report/ai-summary";
import {
  MIN_AI_SUMMARY_INPUTS,
  shouldGenerateAiSummary,
} from "@/lib/admin/enps-report/ai-summary-types";
import type { SurveyForSnapshot } from "@/lib/admin/enps-report/build-and-store";
import {
  parseReportCliOptions,
  selectTargetSurveys,
} from "@/lib/admin/enps-report/cli";

describe("parseReportCliOptions", () => {
  it("既定はどのオプションも無効", () => {
    expect(parseReportCliOptions([])).toEqual({
      yearMonth: null,
      force: false,
      all: false,
      skipAi: false,
    });
  });

  it("--year-month はスペース区切りと = 記法の両方を受け付ける", () => {
    expect(parseReportCliOptions(["--year-month", "2026-07"]).yearMonth).toBe(
      "2026-07",
    );
    expect(parseReportCliOptions(["--year-month=2026-07"]).yearMonth).toBe(
      "2026-07",
    );
  });

  it("フラグを解釈する", () => {
    const options = parseReportCliOptions(["--force", "--all", "--skip-ai"]);
    expect(options.force).toBe(true);
    expect(options.all).toBe(true);
    expect(options.skipAi).toBe(true);
  });

  it("年月の形式が不正なら例外を投げる", () => {
    expect(() => parseReportCliOptions(["--year-month", "2026/07"])).toThrow();
    expect(() => parseReportCliOptions(["--year-month", "202607"])).toThrow();
  });
});

describe("selectTargetSurveys", () => {
  const survey = (yearMonth: string, endDate: string): SurveyForSnapshot => ({
    id: `s-${yearMonth}`,
    year_month: yearMonth,
    title: `${yearMonth}のアンケート`,
    end_date: endDate,
  });

  const surveys = [
    survey("2026-05", "2026-05-31T23:59:59Z"),
    survey("2026-06", "2026-06-30T23:59:59Z"),
    survey("2026-07", "2026-07-31T23:59:59Z"),
  ];
  const now = new Date("2026-07-15T00:00:00Z");

  it("指定がなければ締切済みで最も新しい1件を選ぶ", () => {
    const targets = selectTargetSurveys(
      surveys,
      { all: false, yearMonth: null },
      now,
    );
    expect(targets.map((s) => s.year_month)).toEqual(["2026-06"]);
  });

  it("--all は全件を返す", () => {
    const targets = selectTargetSurveys(
      surveys,
      { all: true, yearMonth: null },
      now,
    );
    expect(targets).toHaveLength(3);
  });

  it("年月を指定するとその月だけを返す", () => {
    const targets = selectTargetSurveys(
      surveys,
      { all: false, yearMonth: "2026-05" },
      now,
    );
    expect(targets.map((s) => s.year_month)).toEqual(["2026-05"]);
  });

  it("締切済みが無ければ空になる", () => {
    const targets = selectTargetSurveys(
      [survey("2026-07", "2026-07-31T23:59:59Z")],
      { all: false, yearMonth: null },
      now,
    );
    expect(targets).toEqual([]);
  });
});

describe("shouldGenerateAiSummary", () => {
  it("自由記述が少ない会社では生成しない", () => {
    expect(shouldGenerateAiSummary(MIN_AI_SUMMARY_INPUTS - 1)).toBe(false);
    expect(shouldGenerateAiSummary(MIN_AI_SUMMARY_INPUTS)).toBe(true);
  });
});

describe("buildAiSummaryInputsByCompany", () => {
  const questions = [
    {
      id: "score-q",
      question_text: "推奨度",
      question_type: "score_0_10",
      parent_question_id: null,
    },
    {
      id: "text-q",
      question_text: "その理由",
      question_type: "text",
      parent_question_id: "score-q",
    },
    {
      id: "standalone-text-q",
      question_text: "自由記述",
      question_type: "text",
      parent_question_id: null,
    },
  ];

  const userCompanies = [
    { user_id: "u1", company_name: "A社" },
    { user_id: "u2", company_name: "B社" },
  ];

  it("会社ごとに自由記述をまとめる", () => {
    const result = buildAiSummaryInputsByCompany({
      questions,
      textResponses: [
        { question_id: "text-q", user_id: "u1", text_value: "働きやすい" },
        { question_id: "text-q", user_id: "u2", text_value: "評価が不透明" },
      ],
      scoreResponses: [],
      userCompanies,
    });

    expect(Array.from(result.keys()).sort()).toEqual(["A社", "B社"]);
    expect(result.get("A社")?.[0].text).toBe("働きやすい");
  });

  it("親のスコア設問の点数からセグメントを付ける", () => {
    const result = buildAiSummaryInputsByCompany({
      questions,
      textResponses: [
        { question_id: "text-q", user_id: "u1", text_value: "とても良い" },
      ],
      scoreResponses: [
        { question_id: "score-q", user_id: "u1", score_value: 10 },
      ],
      userCompanies,
    });

    expect(result.get("A社")?.[0].score).toBe(10);
    expect(result.get("A社")?.[0].segment).toBe("promoter");
  });

  it("親を持たないテキスト設問はスコアなしになる", () => {
    const result = buildAiSummaryInputsByCompany({
      questions,
      textResponses: [
        {
          question_id: "standalone-text-q",
          user_id: "u1",
          text_value: "意見です",
        },
      ],
      scoreResponses: [
        { question_id: "score-q", user_id: "u1", score_value: 10 },
      ],
      userCompanies,
    });

    expect(result.get("A社")?.[0].score).toBeNull();
    expect(result.get("A社")?.[0].segment).toBeNull();
  });

  it("空文字や所属不明のユーザーの記述は除外する", () => {
    const result = buildAiSummaryInputsByCompany({
      questions,
      textResponses: [
        { question_id: "text-q", user_id: "u1", text_value: "   " },
        { question_id: "text-q", user_id: "unknown", text_value: "所属不明" },
      ],
      scoreResponses: [],
      userCompanies,
    });

    expect(result.size).toBe(0);
  });

  it("スコア設問への回答をテキストとして拾わない", () => {
    const result = buildAiSummaryInputsByCompany({
      questions,
      textResponses: [
        { question_id: "score-q", user_id: "u1", text_value: "混入" },
      ],
      scoreResponses: [],
      userCompanies,
    });

    expect(result.size).toBe(0);
  });
});

describe("buildAiSummaryPrompt", () => {
  it("氏名やユーザーIDを含めず、スコアとテキストだけを渡す", () => {
    const { user } = buildAiSummaryPrompt({
      companyName: "A社",
      yearMonth: "2026-07",
      inputs: [
        {
          score: 10,
          segment: "promoter",
          question_text: "その理由",
          text: "裁量が大きい",
        },
      ],
    });

    expect(user).toContain("裁量が大きい");
    expect(user).toContain("推奨者・10点");
    expect(user).not.toMatch(/user_id|ユーザーID/);
  });

  it("スコアが無い記述はスコア不明として渡す", () => {
    const { user } = buildAiSummaryPrompt({
      companyName: "A社",
      yearMonth: "2026-07",
      inputs: [
        {
          score: null,
          segment: null,
          question_text: "自由記述",
          text: "意見です",
        },
      ],
    });

    expect(user).toContain("スコア不明");
  });
});

describe("parseAiSummaryPayload", () => {
  const valid = {
    overview: "全体として安定している",
    promoter_highlights: ["裁量の大きさ"],
    detractor_highlights: ["評価の不透明さ"],
    themes: [
      {
        name: "評価・処遇",
        mention_count: 3,
        sentiment: "negative",
        summary: "評価基準が不明との声",
        representative_comments: ["評価基準が分からない"],
      },
    ],
    action_suggestions: [
      {
        title: "評価基準の明文化",
        rationale: "評価の不透明さへの言及が3件",
        related_theme: "評価・処遇",
      },
    ],
  };

  it("スキーマに合う応答を受け入れる", () => {
    expect(parseAiSummaryPayload(valid)?.overview).toBe(
      "全体として安定している",
    );
  });

  it("必須項目が欠けた応答は拒否する", () => {
    const { themes, ...withoutThemes } = valid;
    expect(parseAiSummaryPayload(withoutThemes)).toBeNull();
  });

  it("想定外の sentiment は拒否する", () => {
    expect(
      parseAiSummaryPayload({
        ...valid,
        themes: [{ ...valid.themes[0], sentiment: "unknown" }],
      }),
    ).toBeNull();
  });
});

describe("resolveAiSummaryConfig", () => {
  it("APIキーが無ければ null（AI分析はスキップされる）", () => {
    expect(resolveAiSummaryConfig({})).toBeNull();
  });

  it("モデルとベースURLは既定値を持ち、末尾のスラッシュを落とす", () => {
    const config = resolveAiSummaryConfig({
      ENPS_REPORT_AI_API_KEY: "key",
      ENPS_REPORT_AI_BASE_URL: "https://example.com/v1/",
    });

    expect(config?.baseUrl).toBe("https://example.com/v1");
    expect(config?.model).toBeTruthy();
  });
});
