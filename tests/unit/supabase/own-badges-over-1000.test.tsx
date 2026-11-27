import { UserBadges } from "@/components/user-badges/user-badges-server";
import { listUserBadgesTool } from "@/lib/mcp/tools/profiles";
import type { McpToolContext } from "@/lib/mcp/tools/types";
import {
  checkBadgeNotifications,
  markBadgeNotificationAsSeen,
} from "@/lib/services/badgeNotification";
import { createServiceClient } from "@/lib/supabase/server";
import { type UserBadge, getBadgeTitle } from "@/lib/types/badge";
import { render, screen } from "@testing-library/react";
import { createFakePostgrest, pad } from "../survey/fake-postgrest";

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(),
  createServiceClient: jest.fn(),
}));
jest.mock("@/components/user-badges/badge-display", () => ({
  BadgeDisplay: ({ badge }: { badge: UserBadge }) => (
    <span data-testid="badge" data-id={badge.id}>
      {getBadgeTitle(badge)}
    </span>
  ),
}));

const USER_ID = "user-0001";
const OTHER_USER_ID = "user-0002";
const OWN = 1200;
const SAME_INSTANT = "2026-11-01T00:00:00.000Z";

const range = (n: number) => Array.from({ length: n }, (_, i) => i);
const badgeId = (i: number) => `badge-${pad(i)}`;
const slug = (i: number) => `slug-${pad(i)}`;
const missionTitle = (i: number) => `グッジョブ${pad(i)}`;
const rankOf = (i: number) => 1 + (i % 3);
const expectedTitle = (i: number) => `${missionTitle(i)} ${rankOf(i)}位`;

function buildTables() {
  return {
    missions: range(OWN).map((i) => ({
      id: `mission-${pad(i)}`,
      slug: slug(i),
      title: missionTitle(i),
    })),
    user_badges: [
      ...range(OWN).map((i) => ({
        id: badgeId(i),
        user_id: USER_ID,
        badge_type: "MISSION",
        sub_type: slug(i),
        rank: rankOf(i),
        achieved_at: SAME_INSTANT,
        created_at: SAME_INSTANT,
        quarter_period: null,
        badge_image_path: null,
        icon_image_path: null,
        is_notified: false,
      })),
      ...range(30).map((i) => ({
        id: `other-${pad(i)}`,
        user_id: OTHER_USER_ID,
        badge_type: "MISSION",
        sub_type: slug(i),
        rank: 1,
        achieved_at: SAME_INSTANT,
        created_at: SAME_INSTANT,
        is_notified: false,
      })),
    ],
  };
}

function useTables(
  tables: ReturnType<typeof buildTables>,
  options?: Parameters<typeof createFakePostgrest>[1],
) {
  const fake = createFakePostgrest(tables, options);
  jest.mocked(createServiceClient).mockResolvedValue(fake);
  return fake;
}

const allOwnTitles = range(OWN).map(expectedTitle).sort();
const byRankThenId = range(OWN)
  .sort((a, b) => rankOf(a) - rankOf(b) || a - b)
  .map(badgeId);

beforeEach(() => {
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("本人のバッジが 1200 件あるとき", () => {
  it("ユーザーページのバッジ欄は、全件をグッジョブ名つきで出す", async () => {
    useTables(buildTables());
    render(await UserBadges({ userId: USER_ID }));
    const shown = screen.getAllByTestId("badge");
    expect(shown).toHaveLength(OWN);
    expect(shown.map((el) => el.textContent).sort()).toEqual(allOwnTitles);
  });

  it("トップのバッジ通知は、未通知の全件をグッジョブ名つきで出す", async () => {
    useTables(buildTables());
    const result = await checkBadgeNotifications(USER_ID);
    expect(result.hasNewBadges).toBe(true);
    expect(result.newBadges?.map((b) => b.title).sort()).toEqual(allOwnTitles);
    expect(result.newBadges?.map((b) => b.badge.id)).toEqual(
      range(OWN).map(badgeId).reverse(),
    );
  });

  it("通知の確認は全件を通知済みにし、次のトップでは通知を出さない", async () => {
    const tables = buildTables();
    useTables(tables);
    const ids = range(OWN).map(badgeId);
    expect(await markBadgeNotificationAsSeen(ids)).toEqual({ success: true });
    expect(
      tables.user_badges
        .filter((b) => b.user_id === USER_ID)
        .every((b) => b.is_notified),
    ).toBe(true);
    expect(
      tables.user_badges
        .filter((b) => b.user_id === OTHER_USER_ID)
        .every((b) => !b.is_notified),
    ).toBe(true);
    expect(await checkBadgeNotifications(USER_ID)).toEqual({
      hasNewBadges: false,
    });
  });

  it("MCP の list_user_badges は、全件をランク順にミッション名つきで返す", async () => {
    const fake = createFakePostgrest(buildTables());
    const result = (await listUserBadgesTool.execute({ user_id: USER_ID }, {
      db: fake,
    } as unknown as McpToolContext)) as { items: Record<string, unknown>[] };
    expect(result.items.map((b) => b.id)).toEqual(byRankThenId);
    for (const item of result.items) {
      const i = Number(String(item.id).slice("badge-".length));
      expect(item.mission_title).toBe(missionTitle(i));
      expect(item.mission_id).toBe(`mission-${pad(i)}`);
    }
  });
});

describe("バッジの取得に失敗したとき", () => {
  it.each(["user_badges", "missions"])(
    "%s の取得に失敗したら、ユーザーページのバッジ欄は「まだ無い」と出さず、その場に失敗を出す",
    async (table) => {
      useTables(buildTables(), { failingTables: [table] });
      render(await UserBadges({ userId: USER_ID }));
      expect(screen.getByRole("alert")).toHaveTextContent(
        "バッジの取得に失敗しました",
      );
      expect(
        screen.queryByText("まだバッジを獲得していません"),
      ).not.toBeInTheDocument();
      expect(screen.queryAllByTestId("badge")).toHaveLength(0);
    },
  );
});
