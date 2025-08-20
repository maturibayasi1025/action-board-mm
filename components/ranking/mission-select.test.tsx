import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { MissionSelect } from "./mission-select";

type Mission = {
  id: string;
  title: string;
  description: string;
};

const mockPush = jest.fn();
const mockSearchParams = new URLSearchParams();

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

jest.mock("lucide-react", () => ({
  ChevronDown: ({ className }: { className?: string }) => (
    <div className={className} data-testid="chevron-down" />
  ),
}));

const mockMissions = [
  {
    id: "mission-1",
    title: "テストグッジョブ1",
    description: "テスト用のグッジョブ1",
  },
  {
    id: "mission-2",
    title: "テストグッジョブ2",
    description: "テスト用のグッジョブ2",
  },
  {
    id: "mission-3",
    title: "テストグッジョブ3",
    description: "テスト用のグッジョブ3",
  },
] as any;

describe("MissionSelect", () => {
  beforeEach(() => {
    mockPush.mockClear();
  });

  describe("基本的な表示", () => {
    it("ラベルが正しく表示される", () => {
      render(<MissionSelect missions={mockMissions} />);

      expect(screen.getByText("グッジョブを選択")).toBeInTheDocument();
    });

    it("セレクトボックスが表示される", () => {
      render(<MissionSelect missions={mockMissions} />);

      const select = screen.getByRole("combobox");
      expect(select).toBeInTheDocument();
      expect(select).toHaveAttribute("id", "mission-select");
    });

    it("ChevronDownアイコンが表示される", () => {
      render(<MissionSelect missions={mockMissions} />);

      expect(screen.getByTestId("chevron-down")).toBeInTheDocument();
    });

    it("すべてのグッジョブオプションが表示される", () => {
      render(<MissionSelect missions={mockMissions} />);

      expect(screen.getByText("テストグッジョブ1")).toBeInTheDocument();
      expect(screen.getByText("テストグッジョブ2")).toBeInTheDocument();
      expect(screen.getByText("テストグッジョブ3")).toBeInTheDocument();
    });
  });

  describe("初期値の設定", () => {
    it("URLパラメータがない場合は最初のグッジョブが選択される", () => {
      render(<MissionSelect missions={mockMissions} />);

      const select = screen.getByRole("combobox") as HTMLSelectElement;
      expect(select.value).toBe("mission-1");
    });

    it("URLパラメータがある場合はそのグッジョブが選択される", () => {
      const originalURLSearchParams = global.URLSearchParams;
      global.URLSearchParams = jest.fn().mockImplementation(() => ({
        get: jest.fn().mockReturnValue("mission-2"),
      }));

      render(<MissionSelect missions={mockMissions} />);

      const select = screen.getByRole("combobox") as HTMLSelectElement;
      expect(select.value).toBe("mission-2");

      global.URLSearchParams = originalURLSearchParams;
    });
  });

  describe("グッジョブ変更時の動作", () => {
    it("グッジョブを変更するとrouterのpushが呼ばれる", () => {
      render(<MissionSelect missions={mockMissions} />);

      const select = screen.getByRole("combobox");
      fireEvent.change(select, { target: { value: "mission-3" } });

      expect(mockPush).toHaveBeenCalledWith(
        "/ranking/ranking-mission?missionId=mission-3",
      );
    });

    it("選択値が更新される", () => {
      render(<MissionSelect missions={mockMissions} />);

      const select = screen.getByRole("combobox") as HTMLSelectElement;
      fireEvent.change(select, { target: { value: "mission-2" } });

      expect(select.value).toBe("mission-2");
    });
  });

  describe("エッジケース", () => {
    it("グッジョブが空の場合でもエラーにならない", () => {
      render(<MissionSelect missions={[]} />);

      const select = screen.getByRole("combobox");
      expect(select).toBeInTheDocument();
    });

    it("単一のグッジョブの場合", () => {
      const singleMission = [mockMissions[0]];
      render(<MissionSelect missions={singleMission} />);

      expect(screen.getByText("テストグッジョブ1")).toBeInTheDocument();
      expect(screen.queryByText("テストグッジョブ2")).not.toBeInTheDocument();
    });

    it("無効なmissionIdがURLにある場合は最初のグッジョブが選択される", () => {
      const originalURLSearchParams = global.URLSearchParams;
      global.URLSearchParams = jest.fn().mockImplementation(() => ({
        get: jest.fn().mockReturnValue("invalid-mission"),
      }));

      render(<MissionSelect missions={mockMissions} />);

      const select = screen.getByRole("combobox") as HTMLSelectElement;
      expect(select.value).toBe("mission-1");

      global.URLSearchParams = originalURLSearchParams;
    });
  });
});
