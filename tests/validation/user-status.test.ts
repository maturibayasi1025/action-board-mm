import { isDeletedAt } from "@/lib/utils/user-status";

describe("isDeletedAt", () => {
  it("null / undefined / 空文字は在籍中", () => {
    expect(isDeletedAt(null)).toBe(false);
    expect(isDeletedAt(undefined)).toBe(false);
    expect(isDeletedAt("")).toBe(false);
  });

  it("日時が入っていれば削除済み", () => {
    expect(isDeletedAt("2026-08-30T00:00:00.000Z")).toBe(true);
  });
});
