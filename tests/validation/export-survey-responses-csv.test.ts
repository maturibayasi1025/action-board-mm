import {
  buildSurveyResponsesCsv,
  escapeSurveyCsvCell,
  formatSurveyCsvAnswerCell,
  surveyResponsesCsvFilename,
  surveyResponsesCsvText,
} from "@/lib/survey/export-responses-csv";

const scoreQuestion = {
  id: "q-score",
  question_text: "推奨度",
  question_type: "score_0_10",
  display_order: 1,
};

const commentQuestion = {
  id: "q-text",
  question_text: "理由",
  question_type: "text",
  display_order: 2,
};

const nominateQuestion = {
  id: "q-nom",
  question_text: "推薦",
  question_type: "user_select",
  display_order: 3,
};

describe("export-survey-responses-csv", () => {
  it("escapes commas, quotes, and newlines", () => {
    expect(escapeSurveyCsvCell("a,b")).toBe('"a,b"');
    expect(escapeSurveyCsvCell("line1\nline2")).toBe('"line1\nline2"');
    expect(escapeSurveyCsvCell('say "hello"')).toBe('"say ""hello"""');
    expect(escapeSurveyCsvCell(9)).toBe("9");
  });

  it("formats score as a number and comment as text", () => {
    expect(
      formatSurveyCsvAnswerCell(scoreQuestion, {
        id: "r1",
        question_id: "q-score",
        user_id: "u1",
        user_name: "山田",
        company_name: "A",
        business_unit_name: "B",
        created_at: "2026-08-01T00:00:00Z",
        score_value: 9,
        text_value: null,
      }),
    ).toBe("9");
    expect(
      formatSurveyCsvAnswerCell(commentQuestion, {
        id: "r2",
        question_id: "q-text",
        user_id: "u1",
        user_name: "山田",
        company_name: "A",
        business_unit_name: "B",
        created_at: "2026-08-01T00:00:00Z",
        score_value: null,
        text_value: "良い",
      }),
    ).toBe("良い");
  });

  it("joins nominee and comment for user_select", () => {
    expect(
      formatSurveyCsvAnswerCell(nominateQuestion, {
        id: "r3",
        question_id: "q-nom",
        user_id: "u1",
        user_name: "山田",
        company_name: "A",
        business_unit_name: "B",
        created_at: "2026-08-01T00:00:00Z",
        score_value: null,
        text_value: "一緒にやり切った",
        nominee_user_name: "佐藤",
      }),
    ).toBe("佐藤\n一緒にやり切った");
  });

  it("builds one row per person with score and comment columns", () => {
    const { lines, rowCount } = buildSurveyResponsesCsv({
      questions: [scoreQuestion, commentQuestion],
      responses: [
        {
          id: "r1",
          question_id: "q-score",
          user_id: "u2",
          user_name: "佐藤",
          company_name: "Maison",
          business_unit_name: "開発",
          created_at: "2026-08-02T00:00:00Z",
          score_value: 4,
          text_value: null,
        },
        {
          id: "r2",
          question_id: "q-score",
          user_id: "u1",
          user_name: "山田",
          company_name: "Maison",
          business_unit_name: "企画",
          created_at: "2026-08-01T00:00:00Z",
          score_value: 10,
          text_value: null,
          is_late_submission: true,
        },
        {
          id: "r3",
          question_id: "q-text",
          user_id: "u1",
          user_name: "山田",
          company_name: "Maison",
          business_unit_name: "企画",
          created_at: "2026-08-01T00:00:00Z",
          score_value: null,
          text_value: "とても良い, です",
        },
      ],
    });

    expect(rowCount).toBe(2);
    expect(lines[0]).toBe("氏名,会社,事業部,期限後,推奨度,理由");
    expect(lines[1]).toBe("佐藤,Maison,開発,,4,");
    expect(lines[2]).toBe('山田,Maison,企画,期限後,10,"とても良い, です"');
  });

  it("keeps the latest answer when the same person answered twice", () => {
    const { lines, rowCount } = buildSurveyResponsesCsv({
      questions: [scoreQuestion],
      responses: [
        {
          id: "old",
          question_id: "q-score",
          user_id: "u1",
          user_name: "山田",
          company_name: "",
          business_unit_name: "",
          created_at: "2026-08-01T00:00:00Z",
          score_value: 3,
          text_value: null,
        },
        {
          id: "new",
          question_id: "q-score",
          user_id: "u1",
          user_name: "山田",
          company_name: "",
          business_unit_name: "",
          created_at: "2026-08-02T00:00:00Z",
          score_value: 8,
          text_value: null,
        },
      ],
    });
    expect(rowCount).toBe(1);
    expect(lines[1]).toBe("山田,,,,8");
  });

  it("disambiguates duplicate question titles", () => {
    const { lines } = buildSurveyResponsesCsv({
      questions: [
        {
          id: "q1",
          question_text: "コメント",
          question_type: "text",
          display_order: 1,
        },
        {
          id: "q2",
          question_text: "コメント",
          question_type: "text",
          display_order: 2,
        },
      ],
      responses: [],
    });
    expect(lines[0]).toBe("氏名,会社,事業部,期限後,コメント,コメント (2)");
  });

  it("builds a monthly filename and optional BOM", () => {
    expect(surveyResponsesCsvFilename("enps", "2026-08")).toBe(
      "eNPS回答_2026-08.csv",
    );
    expect(surveyResponsesCsvFilename("award", "2026-08")).toBe(
      "表彰回答_2026-08.csv",
    );
    expect(
      surveyResponsesCsvText(["a,b"], { bom: true }).startsWith("\uFEFF"),
    ).toBe(true);
  });
});
