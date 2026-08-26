import { buildOfficeClosingSlackMessage } from "./slack-message";

describe("buildOfficeClosingSlackMessage", () => {
  it("退室時間と各階チェックを含む", () => {
    const message = buildOfficeClosingSlackMessage({
      reporterName: "関口貴大",
      leftAtLabel: "2026/08/26 22:15",
      floors: [
        { name: "3F", checked: true },
        { name: "4F", checked: true },
      ],
      note: "問題なし",
    });

    expect(message.text).toContain("退室時間 2026/08/26 22:15");
    const serialized = JSON.stringify(message.blocks);
    expect(serialized).toContain("関口貴大");
    expect(serialized).toContain("2026/08/26 22:15");
    expect(serialized).toContain("3F");
    expect(serialized).toContain("4F");
    expect(serialized).toContain("問題なし");
    expect(serialized).toContain(":white_check_mark:");
  });

  it("備考が空ならなしと表示する", () => {
    const message = buildOfficeClosingSlackMessage({
      reporterName: "テスト",
      leftAtLabel: "2026/08/26 21:00",
      floors: [{ name: "4F", checked: false }],
      note: "  ",
    });
    const serialized = JSON.stringify(message.blocks);
    expect(serialized).toContain("*備考:*\\nなし");
    expect(serialized).toContain(":x:");
  });
});
