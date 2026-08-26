import { render, screen } from "@testing-library/react";
import { OfficeClosingHistory } from "./office-closing-history";

describe("OfficeClosingHistory", () => {
  it("報告が無いときは空メッセージを出す", () => {
    render(<OfficeClosingHistory reports={[]} />);
    expect(
      screen.getByText("今日の最終チェックはまだありません。"),
    ).toBeInTheDocument();
  });

  it("退室時間と各階チェックを表示する", () => {
    render(
      <OfficeClosingHistory
        reports={[
          {
            id: "r1",
            reporterName: "関口貴大",
            leftAt: "2026-08-26T13:15:00.000Z",
            note: "問題なし",
            floors: [
              { name: "3F", checked: true },
              { name: "4F", checked: false },
            ],
          },
        ]}
      />,
    );

    expect(screen.getByText(/関口貴大/)).toBeInTheDocument();
    expect(screen.getByText(/退室/)).toBeInTheDocument();
    expect(screen.getByText("3F: 済")).toBeInTheDocument();
    expect(screen.getByText("4F: 未")).toBeInTheDocument();
    expect(screen.getByText("備考: 問題なし")).toBeInTheDocument();
  });
});
