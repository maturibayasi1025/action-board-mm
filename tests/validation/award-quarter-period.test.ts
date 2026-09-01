import {
  getMonthsForQuarter,
  yearMonthKeysForQuarter,
} from "@/app/(protected)/admin/award-surveys/quarterly-ranking-model";
import {
  formatAwardQuarterPeriodLabel,
  getAwardQuarter,
  getAwardQuarterYearMonthKeys,
  getFiscalYearAndQuarterFromMonth,
  getQuarterPeriod,
} from "@/lib/types/badge";

function jstDate(isoDate: string): Date {
  return new Date(`${isoDate}T12:00:00+09:00`);
}

describe("MVV表彰四半期の集計範囲", () => {
  describe("getFiscalYearAndQuarterFromMonth", () => {
    it.each([
      [2026, 3, { fiscalYear: 2026, quarter: 1 }],
      [2026, 4, { fiscalYear: 2026, quarter: 1 }],
      [2026, 5, { fiscalYear: 2026, quarter: 1 }],
      [2026, 6, { fiscalYear: 2026, quarter: 2 }],
      [2026, 7, { fiscalYear: 2026, quarter: 2 }],
      [2026, 8, { fiscalYear: 2026, quarter: 2 }],
      [2026, 9, { fiscalYear: 2026, quarter: 3 }],
      [2026, 10, { fiscalYear: 2026, quarter: 3 }],
      [2026, 11, { fiscalYear: 2026, quarter: 3 }],
      [2026, 12, { fiscalYear: 2026, quarter: 4 }],
      [2027, 1, { fiscalYear: 2026, quarter: 4 }],
      [2027, 2, { fiscalYear: 2026, quarter: 4 }],
    ] as const)("%s年%s月は %j", (year, month, expected) => {
      expect(getFiscalYearAndQuarterFromMonth(year, month)).toEqual(expected);
    });
  });

  describe("getAwardQuarterYearMonthKeys", () => {
    it("Q1 は 3–5月", () => {
      expect(getAwardQuarterYearMonthKeys(2026, 1)).toEqual([
        "2026-03",
        "2026-04",
        "2026-05",
      ]);
    });

    it("Q2 は 6–8月", () => {
      expect(getAwardQuarterYearMonthKeys(2026, 2)).toEqual([
        "2026-06",
        "2026-07",
        "2026-08",
      ]);
    });

    it("Q3 は 9–11月", () => {
      expect(getAwardQuarterYearMonthKeys(2026, 3)).toEqual([
        "2026-09",
        "2026-10",
        "2026-11",
      ]);
    });

    it("Q4 は 12–2月（翌年にまたがる）", () => {
      expect(getAwardQuarterYearMonthKeys(2026, 4)).toEqual([
        "2026-12",
        "2027-01",
        "2027-02",
      ]);
    });
  });

  describe("自己評価CSV・ランキングが参照する yearMonthKeysForQuarter", () => {
    it("選択四半期の月次アンケート範囲を badge 定義と一致させる", () => {
      expect(yearMonthKeysForQuarter(2026, 1)).toEqual([
        "2026-03",
        "2026-04",
        "2026-05",
      ]);
      expect(yearMonthKeysForQuarter(2026, 2)).toEqual([
        "2026-06",
        "2026-07",
        "2026-08",
      ]);
      expect(getMonthsForQuarter(1)).toEqual([3, 4, 5]);
      expect(getMonthsForQuarter(2)).toEqual([6, 7, 8]);
    });
  });

  describe("formatAwardQuarterPeriodLabel", () => {
    it("Q1/Q2 の表示期間を 3–5月 / 6–8月 にする", () => {
      expect(formatAwardQuarterPeriodLabel(2026, 1)).toBe(
        "2026年 Q1（3–5月・表彰: 6月）",
      );
      expect(formatAwardQuarterPeriodLabel(2026, 2)).toBe(
        "2026年 Q2（6–8月・表彰: 9月）",
      );
    });
  });

  describe("getQuarterPeriod", () => {
    it("3月は Q1、6月は Q2", () => {
      expect(getQuarterPeriod(jstDate("2026-03-01"))).toBe("2026-Q1");
      expect(getQuarterPeriod(jstDate("2026-05-31"))).toBe("2026-Q1");
      expect(getQuarterPeriod(jstDate("2026-06-01"))).toBe("2026-Q2");
      expect(getQuarterPeriod(jstDate("2026-08-31"))).toBe("2026-Q2");
    });
  });

  describe("getAwardQuarter", () => {
    it("表彰月は四半期終了の翌月のまま", () => {
      expect(getAwardQuarter(jstDate("2026-06-15"))).toBe("2026-Q1");
      expect(getAwardQuarter(jstDate("2026-09-15"))).toBe("2026-Q2");
      expect(getAwardQuarter(jstDate("2026-12-15"))).toBe("2026-Q3");
      expect(getAwardQuarter(jstDate("2026-03-15"))).toBe("2025-Q4");
    });
  });
});
