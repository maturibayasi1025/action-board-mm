import { assertAllFloorsChecked, officeClosingFormSchema } from "./validation";

describe("officeClosingFormSchema", () => {
  it("最終退室の正常な入力を受け入れる", () => {
    const parsed = officeClosingFormSchema.parse({
      leaveKind: "final",
      leftAtTime: "22:15",
      checkedFloorIds: ["11111111-1111-4111-8111-111111111111"],
      note: "問題なし",
    });
    expect(parsed.leftAtTime).toBe("22:15");
  });

  it("途中退室は階チェックなしで受け入れる", () => {
    const parsed = officeClosingFormSchema.parse({
      leaveKind: "midday",
      leftAtTime: "18:30",
    });
    expect(parsed.leaveKind).toBe("midday");
    expect(parsed.checkedFloorIds).toEqual([]);
  });

  it("最終退室で階チェックが無いと失敗する", () => {
    const result = officeClosingFormSchema.safeParse({
      leaveKind: "final",
      leftAtTime: "22:15",
      checkedFloorIds: [],
    });
    expect(result.success).toBe(false);
  });

  it("退室時間が無いと失敗する", () => {
    const result = officeClosingFormSchema.safeParse({
      leaveKind: "midday",
      leftAtTime: "",
    });
    expect(result.success).toBe(false);
  });
});

describe("assertAllFloorsChecked", () => {
  const floors = [
    "11111111-1111-4111-8111-111111111111",
    "22222222-2222-4222-8222-222222222222",
  ];

  it("全階チェック済みなら通す", () => {
    expect(() => assertAllFloorsChecked(floors, floors)).not.toThrow();
  });

  it("未チェックの階があると失敗する", () => {
    expect(() => assertAllFloorsChecked(floors, [floors[0]])).toThrow(
      "すべての階の最終チェックを入れてください",
    );
  });
});
