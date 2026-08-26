import {
  LEFT_AT_TIME_PATTERN,
  formatJstDateTime,
  formatJstHm,
  leftAtFromJstTime,
} from "./left-at";

describe("leftAtFromJstTime", () => {
  it("JST 当日の時刻を UTC に変換する", () => {
    const now = new Date("2026-08-26T12:00:00+09:00");
    const leftAt = leftAtFromJstTime("22:15", now);
    expect(leftAt.toISOString()).toBe("2026-08-26T13:15:00.000Z");
  });

  it("秒付きの時刻も受け入れる", () => {
    const now = new Date("2026-08-26T12:00:00+09:00");
    const leftAt = leftAtFromJstTime("22:15:00", now);
    expect(leftAt.toISOString()).toBe("2026-08-26T13:15:00.000Z");
  });

  it("不正な時刻はエラーにする", () => {
    expect(() => leftAtFromJstTime("25:00")).toThrow(
      "退室時間の形式が正しくありません",
    );
  });
});

describe("formatJstHm / formatJstDateTime", () => {
  const utc = new Date("2026-08-26T13:15:00.000Z");

  it("JST の時刻だけを返す", () => {
    expect(formatJstHm(utc)).toBe("22:15");
  });

  it("JST の日時を返す", () => {
    expect(formatJstDateTime(utc)).toBe("2026/08/26 22:15");
  });
});

describe("LEFT_AT_TIME_PATTERN", () => {
  it.each(["00:00", "09:05", "23:59", "22:15:00"])(
    "%s を受け入れる",
    (value) => {
      expect(LEFT_AT_TIME_PATTERN.test(value)).toBe(true);
    },
  );

  it.each(["24:00", "9:00", "22:5", ""])("%s を拒否する", (value) => {
    expect(LEFT_AT_TIME_PATTERN.test(value)).toBe(false);
  });
});
