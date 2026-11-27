/**
 * @jest-environment node
 */
import Home from "@/app/page";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import type { ReactNode } from "react";
import { prerenderToNodeStream } from "react-dom/static";
import { createFakePostgrest, pad } from "../survey/fake-postgrest";

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(),
  createServiceClient: jest.fn(),
}));
jest.mock("@/lib/services/users", () => ({
  getUser: async () => ({ id: "user-0001" }),
  getProfile: async () => ({
    id: "user-0001",
    name: "テスト太郎",
    address_prefecture: "東京都",
  }),
}));
jest.mock("@/lib/services/userLevel", () => ({
  getUserLevel: async () => ({ level: 7, xp: 1234 }),
}));
jest.mock("@/components/user-avatar", () => ({
  __esModule: true,
  default: ({ userProfile }: { userProfile: { name: string } }) => (
    <div data-avatar={userProfile.name} />
  ),
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
const USER_NAME = "テスト太郎";
const MISSIONS = 3;
const TOP_BADGE_TITLE = "グッジョブ0 3位";
const FAILURE_DETAIL = "connection error";
const missionId = (i: number) => `mission-${pad(i)}`;
const range = (n: number) => Array.from({ length: n }, (_, i) => i);

function buildClientTables() {
  return {
    private_users: [{ id: USER_ID }],
    achievements: [],
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

function buildServiceTables() {
  return {
    user_badges: [
      {
        id: "badge-0001",
        user_id: USER_ID,
        badge_type: "MISSION",
        sub_type: "slug-0000",
        rank: 3,
      },
      {
        id: "badge-0002",
        user_id: USER_ID,
        badge_type: "ALL",
        sub_type: null,
        rank: 40,
      },
    ],
    missions: range(MISSIONS).map((i) => ({
      id: missionId(i),
      slug: `slug-${pad(i)}`,
      title: `グッジョブ${i}`,
    })),
  };
}

async function renderTop(failingServiceTables: string[] = []) {
  jest
    .mocked(createClient)
    .mockResolvedValue(
      createFakePostgrest(buildClientTables(), { authUserId: USER_ID }),
    );
  jest.mocked(createServiceClient).mockResolvedValue(
    createFakePostgrest(buildServiceTables(), {
      failingTables: failingServiceTables,
    }),
  );
  const { prelude } = await prerenderToNodeStream(
    await Home({ searchParams: Promise.resolve({}) }),
  );
  let html = "";
  for await (const chunk of prelude) html += chunk.toString();
  return html;
}

function expectNormalTop(html: string) {
  expect(html).toContain("min-h-screen");
  expect(html).toContain(`${USER_NAME}さんのプロフィールへ`);
  expect(html).toContain(`data-avatar="${USER_NAME}"`);
  expect(html).toMatch(/LV\.<\/div><div[^>]*>7<\/div>/);
  for (const section of ["dashboard", "mvv-badges", "user-missions"]) {
    expect(html).toContain(`data-section="${section}"`);
  }
  expect(html).toContain("⭐ 共有グッジョブ");
  expect(html).toContain("📈 グッジョブ");
  expect(html).not.toContain("アクションボード");
}

let consoleError: jest.SpyInstance;

beforeEach(() => {
  consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("トップのヒーローの最高ランクバッジ", () => {
  it("取得に成功すれば、名前・レベルと並んで最高ランクのバッジがグッジョブ名付きで出る", async () => {
    const html = await renderTop();
    expectNormalTop(html);
    expect(html).toContain(TOP_BADGE_TITLE);
    expect(html).not.toContain("総合ランキング 40位");
  });

  it.each([
    ["本人のバッジ（user_badges）", "user_badges"],
    ["グッジョブ名（missions）", "missions"],
  ])(
    "%sの取得に失敗しても、バッジだけを出さず、ヒーロー・各セクション・通常レイアウトは残り、失敗の内容は画面に出ない",
    async (_label, table) => {
      const html = await renderTop([table]);
      expectNormalTop(html);
      expect(html).not.toContain(TOP_BADGE_TITLE);
      expect(html).not.toContain("ランキング");
      expect(html).not.toContain(FAILURE_DETAIL);
      expect(consoleError).toHaveBeenCalled();
    },
  );
});
