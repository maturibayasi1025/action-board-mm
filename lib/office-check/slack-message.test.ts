import { buildOfficeClosingSlackMessage } from "./slack-message";

describe("buildOfficeClosingSlackMessage", () => {
  it("最終退室は退室時間・各階チェック・在室者を含む", () => {
    const message = buildOfficeClosingSlackMessage({
      kind: "final",
      reporterName: "関口貴大",
      atLabel: "2026/08/26 22:15",
      remainingNames: [],
      floors: [
        { name: "3F", checked: true },
        { name: "4F", checked: true },
      ],
      note: "問題なし",
    });

    expect(message.text).toContain("退室時間 2026/08/26 22:15");
    expect(message.text).toContain("なし（全員退室）");
    const serialized = JSON.stringify(message.blocks);
    expect(serialized).toContain("関口貴大");
    expect(serialized).toContain("2026/08/26 22:15");
    expect(serialized).toContain("3F");
    expect(serialized).toContain("4F");
    expect(serialized).toContain("問題なし");
    expect(serialized).toContain(":white_check_mark:");
    expect(serialized).toContain("現在の在室");
  });

  it("途中退室は階チェックなしで在室者を含む", () => {
    const message = buildOfficeClosingSlackMessage({
      kind: "midday",
      reporterName: "島田瞳",
      atLabel: "2026/08/26 18:30",
      remainingNames: ["葉倉歩", "関口貴大"],
      note: "",
    });

    expect(message.text).toContain("途中退室");
    const serialized = JSON.stringify(message.blocks);
    expect(serialized).toContain("途中退室しました");
    expect(serialized).toContain("葉倉歩、関口貴大（2名）");
    expect(serialized).not.toContain("各階の最終チェック");
    expect(serialized).toContain("*備考:*\\nなし");
  });

  it("入室は在室者を含む", () => {
    const message = buildOfficeClosingSlackMessage({
      kind: "checkin",
      reporterName: "葉倉歩",
      atLabel: "2026/08/26 10:00",
      remainingNames: ["葉倉歩"],
    });

    expect(message.text).toContain("入室");
    const serialized = JSON.stringify(message.blocks);
    expect(serialized).toContain("入室しました");
    expect(serialized).toContain("葉倉歩（1名）");
    expect(serialized).not.toContain("各階の最終チェック");
    expect(serialized).not.toContain("*備考:*");
  });
});
