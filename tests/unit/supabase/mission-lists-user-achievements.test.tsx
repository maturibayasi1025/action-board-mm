import MissionsByCategory from "@/components/mission/MissionsByCategory";
import Missions from "@/components/mission/missions";
import { getUserAchievementCountMap } from "@/lib/services/missions";
import { createClient } from "@/lib/supabase/server";
import { render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import {
  MAX_IN_VALUES,
  createFakePostgrest,
  pad,
} from "../survey/fake-postgrest";

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
const LOAD_ERROR = "グッジョブの取得に失敗しました";

const missionId = (i: number) => `mission-${pad(i)}`;
const range = (n: number) => Array.from({ length: n }, (_, i) => i);
const unachievedIds = range(MISSIONS).slice(ACHIEVED_MISSIONS).map(missionId);
const achievedIds = range(ACHIEVED_MISSIONS).map(missionId);

function buildTables({
  missions = MISSIONS,
  achievedMissions = ACHIEVED_MISSIONS,
  repeat = REPEAT,
} = {}) {
  return {
    achievements: range(achievedMissions * repeat).map((n) => ({
      id: `achievement-${pad(n)}`,
      user_id: USER_ID,
      mission_id: missionId(Math.floor(n / repeat)),
    })),
    mission_achievement_count_view: range(missions).map((i) => ({
      mission_id: missionId(i),
      achievement_count: 1,
    })),
    mission_category_view: range(missions).map((i) => ({
      category_id: "category-1",
      category_title: "カテゴリ",
      category_kbn: null,
      category_sort_no: 1,
      link_sort_no: i,
      mission_id: missionId(i),
      title: `グッジョブ${i}`,
      max_achievement_count: repeat,
      is_hidden: false,
    })),
    missions: range(missions).map((i) => ({
      id: missionId(i),
      title: `グッジョブ${i}`,
      difficulty: 1,
      created_at: SAME_INSTANT,
      max_achievement_count: repeat,
      is_hidden: false,
      is_featured: false,
      is_important: false,
      important_display_start_date: null,
      important_display_end_date: null,
    })),
  };
}

function useTables(
  tables: ReturnType<typeof buildTables>,
  options?: Parameters<typeof createFakePostgrest>[1],
) {
  jest
    .mocked(createClient)
    .mockResolvedValue(createFakePostgrest(tables, options));
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

beforeEach(() => {
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("getUserAchievementCountMap", () => {
  it("1000 行を超える達成履歴を、グッジョブごとの回数に欠けなく数える", async () => {
    const counts = await getUserAchievementCountMap(
      createFakePostgrest(buildTables()),
      USER_ID,
    );
    expect(counts.size).toBe(ACHIEVED_MISSIONS);
    expect([...counts.values()].every((n) => n === REPEAT)).toBe(true);
  });

  it("取得に失敗したら、空の Map ではなく例外を返す", async () => {
    await expect(
      getUserAchievementCountMap(
        createFakePostgrest(buildTables(), {
          failingTables: ["achievements"],
        }),
        USER_ID,
      ),
    ).rejects.toThrow("connection error");
  });
});

describe.each(LISTS)(
  "$name はユーザーの達成履歴が 1000 行を超えても欠けずに集計する",
  ({ Component }) => {
    beforeEach(() => useTables(buildTables()));

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

    it("達成履歴の取得に失敗したら、未達成扱いで描画せず一覧の中に取得失敗を出す", async () => {
      useTables(buildTables(), { failingTables: ["achievements"] });
      const element = await Component({
        userId: USER_ID,
        showAchievedMissions: true,
        title: "一覧の見出し",
      });
      const shown = renderedMissions(element);
      expect(shown).toEqual([]);
      expect(screen.getByText("一覧の見出し")).toBeInTheDocument();
      expect(screen.getByRole("alert")).toHaveTextContent(LOAD_ERROR);
      expect(
        screen.queryByText("未達成のグッジョブはありません"),
      ).not.toBeInTheDocument();
    });
  },
);

it("カテゴリ別のグッジョブ一覧は、上限まで達成したグッジョブを全件後ろに回す", async () => {
  useTables(buildTables());
  const shown = renderedMissions(
    await MissionsByCategory({ userId: USER_ID, showAchievedMissions: true }),
  );
  expect(shown.map((m) => m.id)).toEqual([...unachievedIds, ...achievedIds]);
});

const MANY_MISSIONS = 700;
const MANY_ACHIEVED = MAX_IN_VALUES + 100;
const MAX_SIZE = 30;

describe.each(LISTS)("$name の未達成の絞り込み", ({ Component }) => {
  it("本人の達成がゼロなら、全グッジョブが未達成として並ぶ", async () => {
    useTables(buildTables({ achievedMissions: 0 }));
    const shown = renderedMissions(
      await Component({ userId: USER_ID, showAchievedMissions: false }),
    );
    expect(shown.map((m) => m.id)).toEqual(range(MISSIONS).map(missionId));
    expect(shown.every((m) => !m.achieved && m.count === 0)).toBe(true);
  });

  it("userId を渡さなければ、全グッジョブが未達成として並ぶ", async () => {
    useTables(buildTables());
    const shown = renderedMissions(
      await Component({ showAchievedMissions: false }),
    );
    expect(shown.map((m) => m.id)).toEqual(range(MISSIONS).map(missionId));
  });

  it(`異なる達成済みグッジョブが ${MANY_ACHIEVED} 件でも、未達成だけが欠けなく並ぶ`, async () => {
    useTables(
      buildTables({
        missions: MANY_MISSIONS,
        achievedMissions: MANY_ACHIEVED,
        repeat: 1,
      }),
    );
    const shown = renderedMissions(
      await Component({ userId: USER_ID, showAchievedMissions: false }),
    );
    expect(shown.map((m) => m.id)).toEqual(
      range(MANY_MISSIONS).slice(MANY_ACHIEVED).map(missionId),
    );
  });
});

describe("グッジョブ一覧の件数指定（maxSize）", () => {
  it(`達成済みを除いてから ${MAX_SIZE} 件に絞る`, async () => {
    useTables(
      buildTables({
        missions: MANY_MISSIONS,
        achievedMissions: MANY_ACHIEVED,
        repeat: 1,
      }),
    );
    const shown = renderedMissions(
      await Missions({
        userId: USER_ID,
        showAchievedMissions: false,
        maxSize: MAX_SIZE,
      }),
    );
    expect(shown.map((m) => m.id)).toEqual(
      range(MANY_MISSIONS)
        .slice(MANY_ACHIEVED, MANY_ACHIEVED + MAX_SIZE)
        .map(missionId),
    );
  });

  it("本人の達成がゼロでも、先頭から件数どおりに並ぶ", async () => {
    useTables(buildTables({ achievedMissions: 0 }));
    const shown = renderedMissions(
      await Missions({
        userId: USER_ID,
        showAchievedMissions: false,
        maxSize: MAX_SIZE,
      }),
    );
    expect(shown.map((m) => m.id)).toEqual(range(MAX_SIZE).map(missionId));
  });

  it("達成済みも出すときは、先頭から件数どおりに達成状況つきで並ぶ", async () => {
    useTables(buildTables());
    const shown = renderedMissions(
      await Missions({
        userId: USER_ID,
        showAchievedMissions: true,
        maxSize: MAX_SIZE,
      }),
    );
    expect(shown).toEqual(range(MAX_SIZE).map(missionId).map(expected));
  });
});

describe("グッジョブ自体の取得に失敗したとき", () => {
  it.each([
    { name: "グッジョブ一覧", Component: Missions, table: "missions" },
    {
      name: "カテゴリ別のグッジョブ一覧",
      Component: MissionsByCategory,
      table: "mission_category_view",
    },
    {
      name: "グッジョブ一覧（達成数）",
      Component: Missions,
      table: "mission_achievement_count_view",
    },
  ])(
    "$name は「無い」と出さず、一覧の中に取得失敗を出す",
    async ({ Component, table }) => {
      useTables(buildTables(), { failingTables: [table] });
      const shown = renderedMissions(
        await Component({ userId: USER_ID, showAchievedMissions: false }),
      );
      expect(shown).toEqual([]);
      expect(screen.getByRole("alert")).toHaveTextContent(LOAD_ERROR);
      expect(
        screen.queryByText("未達成のグッジョブはありません"),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText("グッジョブが見つかりませんでした"),
      ).not.toBeInTheDocument();
    },
  );
});
