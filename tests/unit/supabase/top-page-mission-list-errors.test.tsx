/**
 * @jest-environment node
 */
import Home from "@/app/page";
import { createClient } from "@/lib/supabase/server";
import type { ReactNode } from "react";
import { prerenderToNodeStream } from "react-dom/static";
import { createFakePostgrest, pad } from "../survey/fake-postgrest";

jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn() }));
jest.mock("@/components/hero", () => ({
  __esModule: true,
  default: () => <div data-section="hero" />,
}));
jest.mock("@/components/dashboard/dashboard-section", () => ({
  DashboardSection: () => <div data-section="dashboard" />,
}));
jest.mock("@/components/mvv-badge-honor-section", () => ({
  __esModule: true,
  default: () => <div data-section="mvv-badges" />,
}));
jest.mock("@/components/top/user-missions-section", () => ({
  __esModule: true,
  default: () => <div data-section="user-missions" />,
}));
jest.mock("@/lib/services/levelUpNotification", () => ({
  checkLevelUpNotification: async () => ({ shouldNotify: false }),
}));
jest.mock("@/lib/services/badgeNotification", () => ({
  checkBadgeNotifications: async () => ({ hasNewBadges: false }),
}));
jest.mock("@/lib/metadata", () => ({ generateRootMetadata: jest.fn() }));
jest.mock("@/components/mission/mission", () => ({
  __esModule: true,
  default: ({ mission }: { mission: { id: string } }) => (
    <div data-mission={mission.id} />
  ),
}));
jest.mock("@/components/mission/HorizontalScrollContainer", () => ({
  HorizontalScrollContainer: ({ children }: { children: ReactNode }) =>
    children,
}));

const USER_ID = "user-0001";
const MISSIONS = 5;
const LOAD_ERROR = "グッジョブの取得に失敗しました";
const missionId = (i: number) => `mission-${pad(i)}`;
const range = (n: number) => Array.from({ length: n }, (_, i) => i);

function buildTables() {
  return {
    private_users: [{ id: USER_ID }],
    achievements: range(1200).map((n) => ({
      id: `achievement-${pad(n)}`,
      user_id: USER_ID,
      mission_id: missionId(n % MISSIONS),
    })),
    mission_achievement_count_view: [],
    mission_category_view: range(MISSIONS).map((i) => ({
      category_id: "category-1",
      category_title: "カテゴリ",
      category_sort_no: 1,
      link_sort_no: i,
      mission_id: missionId(i),
      title: `グッジョブ${i}`,
      max_achievement_count: null,
    })),
    missions: range(MISSIONS).map((i) => ({
      id: missionId(i),
      title: `グッジョブ${i}`,
      difficulty: 1,
      created_at: "2026-11-01T00:00:00.000Z",
      max_achievement_count: null,
      is_hidden: false,
      is_important: true,
      important_display_start_date: null,
      important_display_end_date: null,
    })),
  };
}

async function renderTop(options: Parameters<typeof createFakePostgrest>[1]) {
  jest
    .mocked(createClient)
    .mockResolvedValue(createFakePostgrest(buildTables(), options));
  const { prelude } = await prerenderToNodeStream(
    await Home({ searchParams: Promise.resolve({}) }),
  );
  let html = "";
  for await (const chunk of prelude) html += chunk.toString();
  return html;
}

const count = (html: string, needle: string) => html.split(needle).length - 1;

beforeEach(() => {
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("トップページ", () => {
  it("本人の達成履歴の取得に失敗しても、他のセクションと通常レイアウトは残り、グッジョブ一覧の中だけに取得失敗が出る", async () => {
    const html = await renderTop({
      authUserId: USER_ID,
      failingTables: ["achievements"],
    });

    expect(html).toContain("min-h-screen");
    for (const section of [
      "hero",
      "dashboard",
      "mvv-badges",
      "user-missions",
    ]) {
      expect(html).toContain(`data-section="${section}"`);
    }
    expect(html).toContain("⭐ 共有グッジョブ");
    expect(html).toContain("📈 グッジョブ");
    expect(count(html, LOAD_ERROR)).toBe(2);
    expect(count(html, 'role="alert"')).toBe(2);
    expect(html).not.toContain("data-mission=");
    expect(html).not.toContain("未達成のグッジョブはありません");
  });

  it("取得に成功すれば、本人の達成が 1000 行を超えていても一覧が出て取得失敗は出ない", async () => {
    const html = await renderTop({ authUserId: USER_ID });
    expect(count(html, "data-mission=")).toBe(MISSIONS * 2);
    expect(html).not.toContain(LOAD_ERROR);
  });

  it("匿名でも、達成履歴を取らずに一覧が出る", async () => {
    const html = await renderTop({
      authUserId: null,
      failingTables: ["achievements"],
    });
    expect(count(html, "data-mission=")).toBe(MISSIONS * 2);
    expect(html).not.toContain(LOAD_ERROR);
    expect(html).not.toContain('data-section="dashboard"');
    expect(html).toContain('data-section="user-missions"');
  });
});
