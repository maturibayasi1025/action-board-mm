import {
  SELF_EVAL_QUESTION_IDS,
  buildCsvContent,
  buildMonthRangeLabel,
  buildValueCell,
  escapeCsvField,
  parseMonthsArg,
  serializeCsvRow,
} from "@/lib/admin/export-award-self-eval";

describe("export-award-self-eval", () => {
  describe("parseMonthsArg", () => {
    it("parses comma-separated months", () => {
      expect(
        parseMonthsArg(["node", "script", "--months=2026-03,2026-04,2026-05"]),
      ).toEqual(["2026-03", "2026-04", "2026-05"]);
    });

    it("returns null when --months is omitted", () => {
      expect(parseMonthsArg(["node", "script"])).toBeNull();
    });

    it("throws on invalid month format", () => {
      expect(() =>
        parseMonthsArg(["node", "script", "--months=2026-3"]),
      ).toThrow("不正な年月形式");
    });
  });

  describe("escapeCsvField", () => {
    it("quotes fields containing commas and newlines", () => {
      expect(escapeCsvField("a,b")).toBe('"a,b"');
      expect(escapeCsvField("line1\nline2")).toBe('"line1\nline2"');
      expect(escapeCsvField('say "hello"')).toBe('"say ""hello"""');
    });

    it("leaves plain text unchanged", () => {
      expect(escapeCsvField("株式会社MAISON MARC")).toBe("株式会社MAISON MARC");
    });
  });

  describe("serializeCsvRow", () => {
    it("joins fields with commas", () => {
      expect(serializeCsvRow(["氏名", "会社", "部署"])).toBe(
        "氏名,会社,部署\n",
      );
    });
  });

  describe("buildValueCell", () => {
    const surveys = [
      { id: "s1", year_month: "2026-03", title: "3月" },
      { id: "s2", year_month: "2026-04", title: "4月" },
      { id: "s3", year_month: "2026-05", title: "5月" },
    ];
    const surveyIdToYearMonth = new Map(
      surveys.map((s) => [s.id, s.year_month]),
    );

    it("joins monthly self-eval text with month labels", () => {
      const responseIndex = new Map([
        [
          `u1:s1:${SELF_EVAL_QUESTION_IDS.passionate_execution}`,
          "3月のエピソード",
        ],
        [
          `u1:s3:${SELF_EVAL_QUESTION_IDS.passionate_execution}`,
          "5月のエピソード",
        ],
      ]);

      expect(
        buildValueCell(
          "u1",
          "passionate_execution",
          surveys,
          surveyIdToYearMonth,
          responseIndex,
        ),
      ).toBe("【2026-03】3月のエピソード\n【2026-05】5月のエピソード");
    });

    it("returns empty string when no responses exist", () => {
      expect(
        buildValueCell(
          "u1",
          "happiness_cycle",
          surveys,
          surveyIdToYearMonth,
          new Map(),
        ),
      ).toBe("");
    });
  });

  describe("buildCsvContent", () => {
    it("adds UTF-8 BOM and header row", () => {
      const content = buildCsvContent(
        ["氏名", "夢中になってやり切る"],
        [["関口貴大", "【2026-03】エピソード"]],
      );

      expect(content.startsWith("\uFEFF")).toBe(true);
      expect(content).toContain("氏名,夢中になってやり切る");
      expect(content).toContain("関口貴大,【2026-03】エピソード");
    });
  });

  describe("buildMonthRangeLabel", () => {
    it("uses single month when only one survey", () => {
      expect(
        buildMonthRangeLabel([{ id: "s1", year_month: "2026-05", title: "" }]),
      ).toBe("2026-05");
    });

    it("uses range label for multiple surveys", () => {
      expect(
        buildMonthRangeLabel([
          { id: "s1", year_month: "2026-03", title: "" },
          { id: "s2", year_month: "2026-05", title: "" },
        ]),
      ).toBe("2026-03_to_2026-05");
    });
  });
});
