import type { SnapshotRecord } from "@/lib/admin/enps-report/comparison";
import {
  GROUP_REPORT_LABEL,
  buildBusinessUnitBreakdown,
  buildChangeHighlights,
  buildCompanyBreakdown,
  buildCompanyComparison,
  buildCompanyTrend,
  companyBreakdownAsBusinessUnitRows,
} from "@/lib/admin/enps-report/comparison";
import {
  buildCompanyComparisonCsv,
  buildCompanyReportCsv,
  escapeCsvCell,
  sanitizeFilenameSegment,
} from "@/lib/admin/enps-report/csv";

const QUESTION = "q1";

function snapshot(overrides: Partial<SnapshotRecord>): SnapshotRecord {
  return {
    survey_id: "s1",
    question_id: QUESTION,
    scope: "company",
    company_name: "A社",
    business_unit_name: "",
    target_count: 10,
    respondent_count: 10,
    promoters: 5,
    passives: 3,
    detractors: 2,
    nps_respondent_base: 30,
    nps_imputed_base: 10,
    ...overrides,
  };
}

describe("buildCompanyComparison", () => {
  it("グループ全体を先頭に置き、会社を五十音順に並べる", () => {
    const rows = buildCompanyComparison({
      current: [
        snapshot({ scope: "group", company_name: "" }),
        snapshot({ company_name: "B社" }),
        snapshot({ company_name: "A社" }),
      ],
      previous: [],
      scoreQuestionIds: [QUESTION],
    });

    expect(rows.map((r) => r.company_name)).toEqual([
      GROUP_REPORT_LABEL,
      "A社",
      "B社",
    ]);
    expect(rows[0].is_group).toBe(true);
  });

  it("前月がある場合は前月差を、無い場合は null を返す", () => {
    const withPrevious = buildCompanyComparison({
      current: [snapshot({ nps_respondent_base: 30 })],
      previous: [snapshot({ survey_id: "s0", nps_respondent_base: 12 })],
      scoreQuestionIds: [QUESTION],
    });
    expect(withPrevious[0].metrics[QUESTION].delta_from_previous).toBe(18);

    const withoutPrevious = buildCompanyComparison({
      current: [snapshot({})],
      previous: [],
      scoreQuestionIds: [QUESTION],
    });
    expect(withoutPrevious[0].metrics[QUESTION].delta_from_previous).toBeNull();
  });

  it("会社行にはグループ全体との差を持たせる", () => {
    const rows = buildCompanyComparison({
      current: [
        snapshot({ scope: "group", company_name: "", nps_respondent_base: 10 }),
        snapshot({ company_name: "A社", nps_respondent_base: -5 }),
      ],
      previous: [],
      scoreQuestionIds: [QUESTION],
    });

    const companyA = rows.find((r) => r.company_name === "A社");
    expect(companyA?.metrics[QUESTION].delta_from_group).toBe(-15);
    // グループ行自身は比較対象にならない
    expect(rows[0].metrics[QUESTION].delta_from_group).toBeNull();
  });

  it("回答者が5人未満の会社は伏せる対象として印を付ける", () => {
    const rows = buildCompanyComparison({
      current: [snapshot({ respondent_count: 3 })],
      previous: [],
      scoreQuestionIds: [QUESTION],
    });
    expect(rows[0].metrics[QUESTION].masked).toBe(true);
  });
});

describe("buildBusinessUnitBreakdown", () => {
  const current: SnapshotRecord[] = [
    snapshot({
      scope: "business_unit",
      business_unit_name: "営業",
      nps_respondent_base: 10,
      respondent_count: 8,
    }),
    snapshot({
      scope: "business_unit",
      business_unit_name: "開発",
      nps_respondent_base: 50,
      respondent_count: 6,
    }),
    snapshot({
      scope: "business_unit",
      business_unit_name: "少人数",
      nps_respondent_base: 100,
      respondent_count: 2,
    }),
    snapshot({
      scope: "business_unit",
      company_name: "B社",
      business_unit_name: "他社の部署",
      respondent_count: 9,
    }),
  ];

  it("指定した会社の事業部だけを eNPS 降順で返す", () => {
    const rows = buildBusinessUnitBreakdown({
      current,
      previous: [],
      companyName: "A社",
      questionId: QUESTION,
    });

    expect(rows.map((r) => r.business_unit_name)).toEqual([
      "開発",
      "営業",
      "少人数",
    ]);
  });

  it("伏せる対象の事業部は末尾に置く", () => {
    const rows = buildBusinessUnitBreakdown({
      current,
      previous: [],
      companyName: "A社",
      questionId: QUESTION,
    });

    expect(rows[rows.length - 1].business_unit_name).toBe("少人数");
    expect(rows[rows.length - 1].metric.masked).toBe(true);
  });
});

describe("buildCompanyBreakdown", () => {
  const current: SnapshotRecord[] = [
    snapshot({
      scope: "group",
      company_name: "",
      nps_respondent_base: 0,
      respondent_count: 20,
    }),
    snapshot({
      company_name: "B社",
      nps_respondent_base: 10,
      respondent_count: 8,
    }),
    snapshot({
      company_name: "A社",
      nps_respondent_base: 40,
      respondent_count: 6,
    }),
    snapshot({
      company_name: "少人数社",
      nps_respondent_base: 100,
      respondent_count: 2,
    }),
  ];

  it("会社を eNPS 降順で返し、伏せる対象は末尾に置く", () => {
    const rows = buildCompanyBreakdown({
      current,
      previous: [],
      questionId: QUESTION,
    });

    expect(rows.map((r) => r.company_name)).toEqual(["A社", "B社", "少人数社"]);
    expect(rows[rows.length - 1].metric.masked).toBe(true);
  });

  it("グループ全体との差を会社行に載せる", () => {
    const rows = buildCompanyBreakdown({
      current,
      previous: [],
      questionId: QUESTION,
    });

    const companyA = rows.find((r) => r.company_name === "A社");
    expect(companyA?.metric.delta_from_group).toBe(40);
  });

  it("事業部ハイライト部品用に名前を載せ替えられる", () => {
    const rows = companyBreakdownAsBusinessUnitRows(
      buildCompanyBreakdown({
        current,
        previous: [],
        questionId: QUESTION,
      }),
    );
    expect(rows[0].business_unit_name).toBe("A社");
  });
});

describe("buildChangeHighlights", () => {
  const row = (
    name: string,
    delta: number | null,
    masked: boolean,
    nps: number | null = 10,
  ) => ({
    business_unit_name: name,
    metric: {
      question_id: QUESTION,
      target_count: 10,
      respondent_count: masked ? 2 : 10,
      response_rate: 100,
      promoters: 5,
      passives: 3,
      detractors: 2,
      nps_respondent_base: nps,
      nps_imputed_base: null,
      delta_from_previous: delta,
      delta_from_group: null,
      masked,
    },
  });

  it("改善と悪化を分け、変化量の大きい順に返す", () => {
    const { improved, declined } = buildChangeHighlights([
      row("大きく改善", 20, false),
      row("少し改善", 5, false),
      row("大きく悪化", -30, false),
      row("横ばい", 0, false),
    ]);

    expect(improved.map((c) => c.business_unit_name)).toEqual([
      "大きく改善",
      "少し改善",
    ]);
    expect(declined.map((c) => c.business_unit_name)).toEqual(["大きく悪化"]);
  });

  it("伏せる対象の事業部は含めない", () => {
    const { improved } = buildChangeHighlights([row("少人数", 50, true)]);
    expect(improved).toHaveLength(0);
  });

  it("前月差が無い事業部は含めない", () => {
    const { improved, declined } = buildChangeHighlights([
      row("前月データなし", null, false),
    ]);
    expect(improved).toHaveLength(0);
    expect(declined).toHaveLength(0);
  });

  it("上位は指定件数までに絞る", () => {
    const { improved } = buildChangeHighlights(
      [
        row("a", 10, false),
        row("b", 20, false),
        row("c", 30, false),
        row("d", 40, false),
      ],
      2,
    );
    expect(improved.map((c) => c.business_unit_name)).toEqual(["d", "c"]);
  });
});

describe("buildCompanyTrend", () => {
  it("スナップショットが無い月は空の点として並べる", () => {
    const trend = buildCompanyTrend({
      snapshotsByMonth: [
        {
          survey_id: "s1",
          year_month: "2026-01",
          records: [snapshot({ survey_id: "s1", nps_respondent_base: 20 })],
        },
        { survey_id: "s2", year_month: "2026-02", records: [] },
      ],
      companyName: "A社",
      questionId: QUESTION,
    });

    expect(trend).toHaveLength(2);
    expect(trend[0].nps_respondent_base).toBe(20);
    expect(trend[1].nps_respondent_base).toBeNull();
    expect(trend[1].respondent_count).toBe(0);
  });

  it("会社名に null を渡すとグループ全体の推移になる", () => {
    const trend = buildCompanyTrend({
      snapshotsByMonth: [
        {
          survey_id: "s1",
          year_month: "2026-01",
          records: [
            snapshot({
              scope: "group",
              company_name: "",
              nps_respondent_base: 5,
            }),
            snapshot({ company_name: "A社", nps_respondent_base: 40 }),
          ],
        },
      ],
      companyName: null,
      questionId: QUESTION,
    });

    expect(trend[0].nps_respondent_base).toBe(5);
  });

  it("回答率を対象者数から算出する", () => {
    const trend = buildCompanyTrend({
      snapshotsByMonth: [
        {
          survey_id: "s1",
          year_month: "2026-01",
          records: [snapshot({ respondent_count: 5, target_count: 10 })],
        },
      ],
      companyName: "A社",
      questionId: QUESTION,
    });

    expect(trend[0].response_rate).toBe(50);
  });
});

describe("CSV出力", () => {
  const questions = [{ id: QUESTION, question_text: "推奨度" }];

  it("カンマや引用符を含む値をエスケープする", () => {
    expect(escapeCsvCell("A社, B事業部")).toBe('"A社, B事業部"');
    expect(escapeCsvCell('引用"あり')).toBe('"引用""あり"');
    expect(escapeCsvCell(null)).toBe("");
  });

  it("ファイル名に使えない文字を置き換える", () => {
    expect(sanitizeFilenameSegment("A社/営業部")).toBe("A社_営業部");
    expect(sanitizeFilenameSegment("   ")).toBe("export");
  });

  it("会社別サマリーCSVでも伏せる対象は数値を出さない", () => {
    const rows = buildCompanyComparison({
      current: [snapshot({ respondent_count: 2, nps_respondent_base: 100 })],
      previous: [],
      scoreQuestionIds: [QUESTION],
    });

    const lines = buildCompanyComparisonCsv({
      yearMonth: "2026-01",
      previousYearMonth: null,
      questions,
      rows,
    });

    const dataLine = lines[lines.length - 1];
    expect(dataLine).toContain("n<5");
    expect(dataLine).not.toContain("+100");
  });

  it("会社別レポートCSVは事業部別と月次推移の両方を含む", () => {
    const businessUnits = buildBusinessUnitBreakdown({
      current: [
        snapshot({ scope: "business_unit", business_unit_name: "営業" }),
      ],
      previous: [],
      companyName: "A社",
      questionId: QUESTION,
    });

    const trend = buildCompanyTrend({
      snapshotsByMonth: [
        { survey_id: "s1", year_month: "2026-01", records: [snapshot({})] },
      ],
      companyName: "A社",
      questionId: QUESTION,
    });

    const lines = buildCompanyReportCsv({
      companyName: "A社",
      yearMonth: "2026-01",
      questionText: "推奨度",
      businessUnits,
      trend,
    });

    const joined = lines.join("\n");
    expect(joined).toContain("【事業部別】");
    expect(joined).toContain("【月次推移】");
    expect(joined).toContain("営業");
    expect(joined).toContain("2026-01");
  });

  it("グループ全体レポートCSVは会社別内訳を出力する", () => {
    const companies = companyBreakdownAsBusinessUnitRows(
      buildCompanyBreakdown({
        current: [snapshot({ company_name: "A社" })],
        previous: [],
        questionId: QUESTION,
      }),
    );

    const trend = buildCompanyTrend({
      snapshotsByMonth: [
        {
          survey_id: "s1",
          year_month: "2026-01",
          records: [
            snapshot({
              scope: "group",
              company_name: "",
              nps_respondent_base: 5,
            }),
          ],
        },
      ],
      companyName: null,
      questionId: QUESTION,
    });

    const lines = buildCompanyReportCsv({
      companyName: GROUP_REPORT_LABEL,
      yearMonth: "2026-01",
      questionText: "推奨度",
      businessUnits: companies,
      trend,
      segmentLabel: "会社",
      scopeLabel: "対象",
    });

    const joined = lines.join("\n");
    expect(joined).toContain(`対象,${GROUP_REPORT_LABEL}`);
    expect(joined).toContain("【会社別】");
    expect(joined).toContain("A社");
    expect(joined).toContain("【月次推移】");
  });
});
