import {
  filterActiveBySuspendedAt,
  isSuspendedAt,
} from "@/lib/utils/user-status";

describe("isSuspendedAt", () => {
  it("NULL は有効とみなす", () => {
    expect(isSuspendedAt(null)).toBe(false);
    expect(isSuspendedAt(undefined)).toBe(false);
  });

  it("日時がある場合は停止とみなす", () => {
    expect(isSuspendedAt("2026-08-20T00:00:00.000Z")).toBe(true);
  });
});

describe("filterActiveBySuspendedAt", () => {
  it("停止ユーザーを除外する", () => {
    const rows = [
      { id: "a", suspended_at: null },
      { id: "b", suspended_at: "2026-08-20T00:00:00.000Z" },
      { id: "c" },
    ];
    expect(filterActiveBySuspendedAt(rows).map((r) => r.id)).toEqual([
      "a",
      "c",
    ]);
  });
});
