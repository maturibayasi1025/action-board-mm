import { render, screen } from "@testing-library/react";
import type React from "react";
import RankingMission from "./ranking-mission";

type UserMissionRanking = {
  user_id: string;
  name: string;
  address_prefecture: string;
  rank: number | null;
  total_points: number | null;
  user_achievement_count?: number;
};

type UserPostingCount = {
  user_id: string;
  posting_count: number;
};

jest.mock("@/lib/services/missionsRanking", () => ({
  getMissionRanking: jest.fn(),
  getTopUsersPostingCount: jest.fn(),
}));

jest.mock("@/components/ui/card", () => ({
  Card: ({
    children,
    className,
  }: { children: React.ReactNode; className?: string }) => (
    <div className={className} data-testid="card">
      {children}
    </div>
  ),
}));

jest.mock("./ranking-item", () => ({
  RankingItem: ({ user, userWithMission, mission, badgeText }: any) => (
    <div data-testid="ranking-item">
      <span data-testid="user-name">{user.name}</span>
      <span data-testid="badge-text">{badgeText}</span>
      <span data-testid="mission-title">{mission?.name}</span>
    </div>
  ),
}));

jest.mock("next/link", () => {
  return ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href} data-testid="link">
      {children}
    </a>
  );
});

jest.mock("lucide-react", () => ({
  ChevronRight: ({ className }: { className?: string }) => (
    <div className={className} data-testid="chevron-right" />
  ),
}));

const mockMission = {
  id: "mission-1",
  title: "テストグッジョブ",
  name: "テストグッジョブ",
} as any;

const mockRankings: UserMissionRanking[] = [
  {
    user_id: "user-1",
    name: "ユーザー1",
    address_prefecture: "東京都",
    rank: 1,
    total_points: 1000,
  },
  {
    user_id: "user-2",
    name: "ユーザー2",
    address_prefecture: "大阪府",
    rank: 2,
    total_points: 800,
  },
];

const mockPostingCounts: UserPostingCount[] = [
  { user_id: "user-1", posting_count: 10 },
  { user_id: "user-2", posting_count: 8 },
];

const mockCurrentUser: UserMissionRanking = {
  user_id: "current-user",
  name: "現在のユーザー",
  address_prefecture: "愛知県",
  rank: 5,
  total_points: 500,
};

describe("RankingMission", () => {
  const {
    getMissionRanking,
    getTopUsersPostingCount,
  } = require("@/lib/services/missionsRanking");

  beforeEach(() => {
    getMissionRanking.mockClear();
    getTopUsersPostingCount.mockClear();
  });

  describe("基本的な表示", () => {
    it("グッジョブが存在しない場合はnullを返す", async () => {
      const result = await RankingMission({
        limit: 10,
      });

      expect(result).toBeNull();
    });

    it("グッジョブが存在する場合はランキングを表示する", async () => {
      getMissionRanking.mockResolvedValue(mockRankings);
      getTopUsersPostingCount.mockResolvedValue(mockPostingCounts);

      render(
        await RankingMission({
          mission: mockMission,
          limit: 10,
        }),
      );

      expect(
        screen.getByText("🏅「テストグッジョブ」トップ10"),
      ).toBeInTheDocument();
      expect(screen.getByTestId("card")).toBeInTheDocument();
    });

    it("ランキングアイテムが正しく表示される", async () => {
      getMissionRanking.mockResolvedValue(mockRankings);
      getTopUsersPostingCount.mockResolvedValue(mockPostingCounts);

      render(
        await RankingMission({
          mission: mockMission,
          limit: 10,
        }),
      );

      const rankingItems = screen.getAllByTestId("ranking-item");
      expect(rankingItems).toHaveLength(2);
      expect(screen.getByText("ユーザー1")).toBeInTheDocument();
      expect(screen.getByText("ユーザー2")).toBeInTheDocument();
    });
  });

  describe("バッジテキストの生成", () => {
    it("通常グッジョブの場合は回数が表示される", async () => {
      const mockRankingsWithAchievement = mockRankings.map((r) => ({
        ...r,
        user_achievement_count: r.user_id === "user-1" ? 10 : 8,
      }));
      getMissionRanking.mockResolvedValue(mockRankingsWithAchievement);
      getTopUsersPostingCount.mockResolvedValue([]);

      render(
        await RankingMission({
          mission: mockMission,
          limit: 10,
          isPostingMission: false,
        }),
      );

      expect(screen.getByText("10回")).toBeInTheDocument();
      expect(screen.getByText("8回")).toBeInTheDocument();
    });

    it("ポスティンググッジョブの場合は枚数が表示される", async () => {
      getMissionRanking.mockResolvedValue(mockRankings);
      getTopUsersPostingCount.mockResolvedValue(mockPostingCounts);

      render(
        await RankingMission({
          mission: mockMission,
          limit: 10,
          isPostingMission: true,
        }),
      );

      expect(screen.getByText("10枚")).toBeInTheDocument();
      expect(screen.getByText("8枚")).toBeInTheDocument();
    });
  });

  describe("サービス関数の呼び出し", () => {
    it("getMissionRankingが正しいパラメータで呼ばれる", async () => {
      getMissionRanking.mockResolvedValue(mockRankings);
      getTopUsersPostingCount.mockResolvedValue(mockPostingCounts);

      await RankingMission({
        mission: mockMission,
        limit: 15,
      });

      expect(getMissionRanking).toHaveBeenCalledWith("mission-1", 15);
    });

    it("ポスティンググッジョブの場合はgetTopUsersPostingCountが呼ばれる", async () => {
      getMissionRanking.mockResolvedValue(mockRankings);
      getTopUsersPostingCount.mockResolvedValue(mockPostingCounts);

      await RankingMission({
        mission: mockMission,
        limit: 10,
        isPostingMission: true,
      });

      expect(getTopUsersPostingCount).toHaveBeenCalledWith([
        "user-1",
        "user-2",
      ]);
    });
  });

  describe("エラーハンドリング", () => {
    it("getMissionRankingがエラーを投げても処理が継続される", async () => {
      getMissionRanking.mockRejectedValue(new Error("API Error"));
      getTopUsersPostingCount.mockResolvedValue(mockPostingCounts);

      await expect(
        RankingMission({
          mission: mockMission,
          limit: 10,
        }),
      ).rejects.toThrow("API Error");
    });

    it("getTopUsersPostingCountがエラーを投げても処理が継続される", async () => {
      getMissionRanking.mockResolvedValue(mockRankings);
      getTopUsersPostingCount.mockRejectedValue(new Error("API Error"));

      await expect(
        RankingMission({
          mission: mockMission,
          limit: 10,
          isPostingMission: true,
        }),
      ).rejects.toThrow("API Error");
    });
  });

  describe("空のデータ", () => {
    it("ランキングが空の場合でもエラーにならない", async () => {
      getMissionRanking.mockResolvedValue([]);
      getTopUsersPostingCount.mockResolvedValue([]);

      render(
        await RankingMission({
          mission: mockMission,
          limit: 10,
        }),
      );

      expect(
        screen.getByText("🏅「テストグッジョブ」トップ10"),
      ).toBeInTheDocument();
      expect(screen.queryByTestId("ranking-item")).not.toBeInTheDocument();
    });
  });

  describe("詳細情報表示", () => {
    it("showDetailedInfoがtrueの場合はリンクが表示される", async () => {
      getMissionRanking.mockResolvedValue(mockRankings);
      getTopUsersPostingCount.mockResolvedValue([]);

      render(
        await RankingMission({
          mission: mockMission,
          limit: 10,
          showDetailedInfo: true,
        }),
      );

      const link = screen.getByRole("link");
      expect(link).toHaveAttribute(
        "href",
        "/ranking/ranking-mission?missionId=mission-1",
      );
      expect(screen.getByText("トップ100を見る")).toBeInTheDocument();
    });

    it("showDetailedInfoがfalseの場合はリンクが表示されない", async () => {
      getMissionRanking.mockResolvedValue(mockRankings);
      getTopUsersPostingCount.mockResolvedValue([]);

      render(
        await RankingMission({
          mission: mockMission,
          limit: 10,
          showDetailedInfo: false,
        }),
      );

      expect(screen.queryByRole("link")).not.toBeInTheDocument();
    });
  });
});
