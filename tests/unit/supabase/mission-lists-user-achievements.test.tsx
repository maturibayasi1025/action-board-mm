import MissionsByCategory from "@/components/mission/MissionsByCategory";
import Missions from "@/components/mission/missions";
import { createClient } from "@/lib/supabase/server";
import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { createFakePostgrest, pad } from "../survey/fake-postgrest";

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(),
}));
jest.mock("@/components/mission/mission", () => ({
  __esModule: true,
  default: ({
    mission,
    achieved,
    userAchievementCount,
  }: {
    mission: { id: string };
    achieved: boolean;
    userAchievementCount: number;
  }) => (
    <div
      data-testid="mission"
      data-id={mission.id}
      data-achieved={String(achieved)}
      data-count={String(userAchievementCount)}
    />
  ),
}));
jest.mock("@/components/mission/HorizontalScrollContainer", () => ({
  HorizontalScrollContainer: ({ children }: { children: React.ReactNode }) =>
    children,
}));

const USER_ID = "user-0001";
const MISSIONS = 450;
const ACHIEVED_MISSIONS = 300;
const REPEAT = 4;
const SAME_INSTANT = "2026-11-01T00:00:00.000Z";

const missionId = (i: number) => `mission-${pad(i)}`;
const range = (n: number) => Array.from({ length: n }, (_, i) => i);
const unachievedIds = range(MISSIONS).slice(ACHIEVED_MISSIONS).map(missionId);
const achievedIds = range(ACHIEVED_MISSIONS).map(missionId);

function buildTables() {
  return {
    achievements: range(ACHIEVED_MISSIONS * REPEAT).map((n) => ({
      id: `achievement-${pad(n)}`,
      user_id: USER_ID,
      mission_id: missionId(Math.floor(n / REPEAT)),
    })),
    mission_achievement_count_view: range(MISSIONS).map((i) => ({
      mission_id: missionId(i),
      achievement_count: 1,
    })),
    mission_category_view: range(MISSIONS).map((i) => ({
      category_id: "category-1",
      category_title: "カテゴリ",
      category_kbn: null,
      category_sort_no: 1,
      link_sort_no: i,
      mission_id: missionId(i),
      title: `グッジョブ${i}`,
      max_achievement_count: REPEAT,
      is_hidden: false,
    })),
    missions: range(MISSIONS).map((i) => ({
      id: missionId(i),
      title: `グッジョブ${i}`,
      difficulty: 1,
      created_at: SAME_INSTANT,
      max_achievement_count: REPEAT,
      is_hidden: false,
      is_featured: false,
      is_important: false,
      important_display_start_date: null,
      important_display_end_date: null,
    })),
  };
}

function renderedMissions(element: ReactElement) {
  const { container } = render(element);
  return Array.from(
    container.querySelectorAll<HTMLElement>('[data-testid="mission"]'),
  ).map((el) => ({
    id: el.dataset.id,
    achieved: el.dataset.achieved === "true",
    count: Number(el.dataset.count),
  }));
}

const expected = (id: string) =>
  achievedIds.includes(id)
    ? { id, achieved: true, count: REPEAT }
    : { id, achieved: false, count: 0 };

const LISTS = [
  { name: "カテゴリ別のグッジョブ一覧", Component: MissionsByCategory },
  { name: "グッジョブ一覧", Component: Missions },
];

describe.each(LISTS)(
  "$name はユーザーの達成履歴が 1000 行を超えても欠けずに集計する",
  ({ Component }) => {
    beforeEach(() => {
      jest
        .mocked(createClient)
        .mockResolvedValue(createFakePostgrest(buildTables()));
    });

    it("達成済みを除くと、未達成のグッジョブだけが並ぶ", async () => {
      const shown = renderedMissions(
        await Component({ userId: USER_ID, showAchievedMissions: false }),
      );
      expect(shown.map((m) => m.id)).toEqual(unachievedIds);
    });

    it("達成済みも出すと、全グッジョブの達成済みと達成回数が正しい", async () => {
      const shown = renderedMissions(
        await Component({ userId: USER_ID, showAchievedMissions: true }),
      );
      expect(shown).toHaveLength(MISSIONS);
      expect(shown).toEqual(
        expect.arrayContaining(range(MISSIONS).map(missionId).map(expected)),
      );
    });

    it("達成履歴の取得に失敗したら、未達成扱いで描画せず例外にする", async () => {
      jest.mocked(createClient).mockResolvedValue(
        createFakePostgrest(buildTables(), {
          failingTables: ["achievements"],
        }),
      );
      jest.spyOn(console, "error").mockImplementation(() => {});
      await expect(
        Component({ userId: USER_ID, showAchievedMissions: true }),
      ).rejects.toThrow("connection error");
    });
  },
);

it("カテゴリ別のグッジョブ一覧は、上限まで達成したグッジョブを全件後ろに回す", async () => {
  jest
    .mocked(createClient)
    .mockResolvedValue(createFakePostgrest(buildTables()));
  const shown = renderedMissions(
    await MissionsByCategory({ userId: USER_ID, showAchievedMissions: true }),
  );
  expect(shown.map((m) => m.id)).toEqual([...unachievedIds, ...achievedIds]);
});
