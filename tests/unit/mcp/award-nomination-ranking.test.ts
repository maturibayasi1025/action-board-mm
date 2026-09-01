import {
  aggregateNominationsForQuestion,
  buildAwardQuarterlyRanking,
  normalizeNomineeName,
  takeTopNWithTies,
} from "@/lib/award/nomination-ranking";
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

  it("uses public profile names and skips unknown nominees for MCP", () => {
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

describe("normalizeNomineeName", () => {
  it("空白と全角スペースを除去して NFKC する", () => {
    expect(normalizeNomineeName("高橋　聖")).toBe(
      normalizeNomineeName("高橋 聖"),
    );
    expect(normalizeNomineeName("高橋聖")).toBe("高橋聖");
  });
});

describe("admin nomination aggregation", () => {
  it("unknown の user_id でも票を捨てず未突合として数える", () => {
    const result = aggregateNominationsForQuestion(
      [
        { question_id: "q1", text_value: null, nominee_user_id: "missing" },
        { question_id: "q1", text_value: null, nominee_user_id: "u1" },
      ],
      question,
      new Map([["u1", "公開名A"]]),
    );
    expect(result.totalVotes).toBe(2);
    expect(result.unmatchedVotes).toBe(1);
    expect(result.rows.some((row) => row.nominee_user_id === "missing")).toBe(
      true,
    );
  });

  it("正規化した氏名が1人にだけ当たる手入力票を user_id にマージする", () => {
    const result = aggregateNominationsForQuestion(
      [
        { question_id: "q1", text_value: null, nominee_user_id: "u1" },
        { question_id: "q1", text_value: "高橋 聖", nominee_user_id: null },
      ],
      question,
      new Map([["u1", "高橋聖"]]),
    );
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      name: "高橋聖",
      votes: 2,
      nominee_user_id: "u1",
      unmatched: false,
    });
  });

  it("期限内と期限後、月次内訳を分けて集計する", () => {
    const result = aggregateNominationsForQuestion(
      [
        {
          question_id: "q1",
          text_value: null,
          nominee_user_id: "u1",
          year_month: "2026-06",
          is_late_submission: false,
        },
        {
          question_id: "q1",
          text_value: null,
          nominee_user_id: "u1",
          year_month: "2026-07",
          is_late_submission: true,
        },
        {
          question_id: "q1",
          text_value: null,
          nominee_user_id: "u1",
          year_month: "2026-08",
          is_late_submission: false,
        },
      ],
      question,
      new Map([["u1", "高橋聖"]]),
    );
    expect(result.rows[0]).toMatchObject({
      votes: 3,
      onTimeVotes: 2,
      lateVotes: 1,
      votesByMonth: { "2026-06": 1, "2026-07": 1, "2026-08": 1 },
    });
  });
});

describe("takeTopNWithTies", () => {
  it("5位と同票の人を切り捨てない", () => {
    const rows = takeTopNWithTies(
      [
        { votes: 10 },
        { votes: 8 },
        { votes: 7 },
        { votes: 7 },
        { votes: 6 },
        { votes: 6 },
        { votes: 4 },
      ],
      5,
    );
    expect(rows.map((row) => row.votes)).toEqual([10, 8, 7, 7, 6, 6]);
  });
});

describe("buildAwardQuarterlyRanking checksum", () => {
  const questions = [
    question,
    {
      id: "q2",
      question_text: "至高",
      question_type: "user_select",
      question_group: "supreme_relations",
      display_order: 2,
      is_active: true,
    },
    {
      id: "q3",
      question_text: "循環",
      question_type: "user_select",
      question_group: "happiness_cycle",
      display_order: 3,
      is_active: true,
    },
    {
      id: "q4",
      question_text: "チーム",
      question_type: "text",
      question_group: "team_value",
      display_order: 4,
      is_active: true,
    },
  ];

  it("3ヶ月の指名票合計と四半期合計が一致し、欠けた月を明示する", () => {
    const result = buildAwardQuarterlyRanking({
      year: 2026,
      quarter: 2,
      label: "2026年 Q2（6–8月・表彰: 9月）",
      expectedYearMonths: ["2026-06", "2026-07", "2026-08"],
      surveys: [
        { id: "s6", year_month: "2026-06", title: "6月" },
        { id: "s7", year_month: "2026-07", title: "7月" },
      ],
      questions,
      responses: [
        {
          survey_id: "s6",
          question_id: "q1",
          user_id: "voter1",
          text_value: null,
          nominee_user_id: "u1",
          is_late_submission: false,
        },
        {
          survey_id: "s6",
          question_id: "q1",
          user_id: "voter2",
          text_value: null,
          nominee_user_id: "u1",
          is_late_submission: true,
        },
        {
          survey_id: "s7",
          question_id: "q1",
          user_id: "voter1",
          text_value: null,
          nominee_user_id: "u2",
          is_late_submission: false,
        },
      ],
      userNameById: new Map([
        ["u1", "高橋聖"],
        ["u2", "猪狩俊"],
      ]),
      dbResponseCount: 3,
    });

    expect(result.surveyCount).toBe(2);
    expect(result.missingYearMonths).toEqual(["2026-08"]);
    expect(result.nominationVoteCount).toBe(3);
    expect(result.monthlyNominationSum).toBe(3);
    expect(result.checksumOk).toBe(true);
    expect(result.responseCountMismatch).toBe(false);
    expect(result.onTimeNominationVoteCount).toBe(2);
    expect(result.lateNominationVoteCount).toBe(1);
    expect(result.months.map((month) => month.nominationVoteCount)).toEqual([
      2, 1, 0,
    ]);

    const passionate = result.groups.find(
      (group) => group.group === "passionate_execution",
    );
    expect(passionate?.rows[0]).toMatchObject({
      name: "高橋聖",
      votes: 2,
      votesByMonth: { "2026-06": 2 },
    });
  });

  it("DB件数と取得件数が違うと mismatch になる", () => {
    const result = buildAwardQuarterlyRanking({
      year: 2026,
      quarter: 2,
      label: "Q2",
      expectedYearMonths: ["2026-06", "2026-07", "2026-08"],
      surveys: [{ id: "s6", year_month: "2026-06", title: "6月" }],
      questions,
      responses: [
        {
          survey_id: "s6",
          question_id: "q1",
          user_id: "voter1",
          text_value: null,
          nominee_user_id: "u1",
          is_late_submission: false,
        },
      ],
      userNameById: new Map([["u1", "高橋聖"]]),
      dbResponseCount: 1000,
    });
    expect(result.responseRowCount).toBe(1);
    expect(result.responseCountMismatch).toBe(true);
    expect(result.rankingBlocked).toBe(true);
    expect(result.rankingBlockedReason).toMatch(/元データ件数/);
    expect(result.groups.every((group) => group.rows.length === 0)).toBe(true);
  });

  it("月次再取得の指名票が四半期と違うと警告し、ランキングは残す", () => {
    const quarterlyResponses = [
      {
        survey_id: "s6",
        question_id: "q1",
        user_id: "voter1",
        text_value: null,
        nominee_user_id: "u1",
        is_late_submission: false,
      },
      {
        survey_id: "s7",
        question_id: "q1",
        user_id: "voter2",
        text_value: null,
        nominee_user_id: "u2",
        is_late_submission: false,
      },
    ];
    const result = buildAwardQuarterlyRanking({
      year: 2026,
      quarter: 2,
      label: "Q2",
      expectedYearMonths: ["2026-06", "2026-07", "2026-08"],
      surveys: [
        { id: "s6", year_month: "2026-06", title: "6月" },
        { id: "s7", year_month: "2026-07", title: "7月" },
      ],
      questions,
      responses: quarterlyResponses,
      userNameById: new Map([
        ["u1", "高橋聖"],
        ["u2", "猪狩俊"],
      ]),
      dbResponseCount: 2,
      independentMonthlyResponses: quarterlyResponses.slice(0, 1),
    });

    expect(result.rankingBlocked).toBe(false);
    expect(result.monthlyCrossCheckOk).toBe(false);
    expect(result.independentMonthlyRowCount).toBe(1);
    expect(result.independentMonthlyNominationSum).toBe(1);
    expect(result.monthlyCrossCheckWarning).toMatch(/一致しません/);
    expect(
      result.groups.some((group) =>
        group.rows.some((row) => row.name === "高橋聖"),
      ),
    ).toBe(true);
  });

  it("月次再取得が四半期と一致すれば照合OK", () => {
    const responses = [
      {
        survey_id: "s6",
        question_id: "q1",
        user_id: "voter1",
        text_value: null,
        nominee_user_id: "u1",
        is_late_submission: false,
      },
    ];
    const result = buildAwardQuarterlyRanking({
      year: 2026,
      quarter: 2,
      label: "Q2",
      expectedYearMonths: ["2026-06", "2026-07", "2026-08"],
      surveys: [{ id: "s6", year_month: "2026-06", title: "6月" }],
      questions,
      responses,
      userNameById: new Map([["u1", "高橋聖"]]),
      dbResponseCount: 1,
      independentMonthlyResponses: responses,
    });
    expect(result.monthlyCrossCheckOk).toBe(true);
    expect(result.monthlyCrossCheckWarning).toBeNull();
    expect(result.rankingBlocked).toBe(false);
  });
});

describe("1000件超の四半期集計回帰", () => {
  const questions = [
    question,
    {
      id: "q2",
      question_text: "至高",
      question_type: "user_select",
      question_group: "supreme_relations",
      display_order: 2,
      is_active: true,
    },
    {
      id: "q3",
      question_text: "循環",
      question_type: "user_select",
      question_group: "happiness_cycle",
      display_order: 3,
      is_active: true,
    },
    {
      id: "q4",
      question_text: "チーム",
      question_type: "text",
      question_group: "team_value",
      display_order: 4,
      is_active: true,
    },
  ];

  function votesFor(
    surveyId: string,
    nomineeUserId: string,
    count: number,
    startIndex = 0,
  ) {
    return Array.from({ length: count }, (_, index) => ({
      survey_id: surveyId,
      question_id: "q1",
      user_id: `voter-${surveyId}-${startIndex + index}`,
      text_value: null,
      nominee_user_id: nomineeUserId,
      is_late_submission: false,
    }));
  }

  it("先頭1000件だけだと後月の指名が消え、件数不一致ならランキングを出さない", () => {
    const june = votesFor("s6", "u1", 1000);
    const july = votesFor("s7", "u2", 201);
    const all = [...june, ...july];
    const truncated = buildAwardQuarterlyRanking({
      year: 2026,
      quarter: 2,
      label: "Q2",
      expectedYearMonths: ["2026-06", "2026-07", "2026-08"],
      surveys: [
        { id: "s6", year_month: "2026-06", title: "6月" },
        { id: "s7", year_month: "2026-07", title: "7月" },
      ],
      questions,
      responses: all.slice(0, 1000),
      userNameById: new Map([
        ["u1", "高橋聖"],
        ["u2", "猪狩俊"],
      ]),
      dbResponseCount: all.length,
    });
    const full = buildAwardQuarterlyRanking({
      year: 2026,
      quarter: 2,
      label: "Q2",
      expectedYearMonths: ["2026-06", "2026-07", "2026-08"],
      surveys: [
        { id: "s6", year_month: "2026-06", title: "6月" },
        { id: "s7", year_month: "2026-07", title: "7月" },
      ],
      questions,
      responses: all,
      userNameById: new Map([
        ["u1", "高橋聖"],
        ["u2", "猪狩俊"],
      ]),
      dbResponseCount: all.length,
      independentMonthlyResponses: all,
    });

    expect(all.length).toBeGreaterThan(1000);
    expect(truncated.responseCountMismatch).toBe(true);
    expect(truncated.rankingBlocked).toBe(true);
    expect(truncated.groups.every((group) => group.rows.length === 0)).toBe(
      true,
    );

    const passionate = full.groups.find(
      (group) => group.group === "passionate_execution",
    );
    expect(full.rankingBlocked).toBe(false);
    expect(full.monthlyCrossCheckOk).toBe(true);
    expect(passionate?.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "高橋聖", votes: 1000 }),
        expect.objectContaining({ name: "猪狩俊", votes: 201 }),
      ]),
    );
  });

  it("1Q（3–5月）でも1000件超を全件集計する", () => {
    const march = votesFor("s3", "u1", 1000);
    const may = votesFor("s5", "u2", 80);
    const result = buildAwardQuarterlyRanking({
      year: 2026,
      quarter: 1,
      label: "2026年 Q1（3–5月・表彰: 6月）",
      expectedYearMonths: ["2026-03", "2026-04", "2026-05"],
      surveys: [
        { id: "s3", year_month: "2026-03", title: "3月" },
        { id: "s5", year_month: "2026-05", title: "5月" },
      ],
      questions,
      responses: [...march, ...may],
      userNameById: new Map([
        ["u1", "高橋聖"],
        ["u2", "猪狩俊"],
      ]),
      dbResponseCount: 1080,
      independentMonthlyResponses: [...march, ...may],
    });

    expect(result.rankingBlocked).toBe(false);
    expect(result.missingYearMonths).toEqual(["2026-04"]);
    const passionate = result.groups.find(
      (group) => group.group === "passionate_execution",
    );
    expect(passionate?.rows[0]).toMatchObject({ name: "高橋聖", votes: 1000 });
    expect(passionate?.rows[1]).toMatchObject({ name: "猪狩俊", votes: 80 });
  });
});
