import { formatRemainingNames, remainingUserIds } from "./remaining";

describe("remainingUserIds", () => {
  it("入室のみの人を在室にする", () => {
    expect(
      remainingUserIds([{ userId: "a", at: "2026-08-26T01:00:00.000Z" }], []),
    ).toEqual(["a"]);
  });

  it("退室後は在室から外す", () => {
    expect(
      remainingUserIds(
        [{ userId: "a", at: "2026-08-26T01:00:00.000Z" }],
        [{ userId: "a", at: "2026-08-26T09:00:00.000Z" }],
      ),
    ).toEqual([]);
  });

  it("途中退室のあと再入室した人は在室にする", () => {
    expect(
      remainingUserIds(
        [
          { userId: "a", at: "2026-08-26T01:00:00.000Z" },
          { userId: "a", at: "2026-08-26T10:00:00.000Z" },
        ],
        [{ userId: "a", at: "2026-08-26T09:00:00.000Z" }],
      ),
    ).toEqual(["a"]);
  });

  it("複数人のうち退室していない人だけ残す", () => {
    expect(
      remainingUserIds(
        [
          { userId: "a", at: "2026-08-26T01:00:00.000Z" },
          { userId: "b", at: "2026-08-26T01:05:00.000Z" },
        ],
        [{ userId: "a", at: "2026-08-26T08:00:00.000Z" }],
      ).sort(),
    ).toEqual(["b"]);
  });

  it("入室記録が無い退室だけでは在室にしない", () => {
    expect(
      remainingUserIds([], [{ userId: "a", at: "2026-08-26T08:00:00.000Z" }]),
    ).toEqual([]);
  });
});

describe("formatRemainingNames", () => {
  it("在室者がいるときは人数を付ける", () => {
    expect(formatRemainingNames(["葉倉歩", "島田瞳"])).toBe(
      "葉倉歩、島田瞳（2名）",
    );
  });

  it("在室者がいないときは全員退室と出す", () => {
    expect(formatRemainingNames([])).toBe("なし（全員退室）");
  });
});
