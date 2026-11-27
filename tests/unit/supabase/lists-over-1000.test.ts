/**
 * @jest-environment node
 */
import { getAssessmentData } from "@/app/(protected)/admin/assessment-export/actions";
import {
  getGoodjobDetails,
  getMatrixData,
} from "@/app/(protected)/admin/goodjob-matrix/actions";
import {
  listPendingInvitations,
  listUsersWithCompanies,
} from "@/app/(protected)/admin/users-and-companies/actions";
import { GET as getBackfillStatus } from "@/app/api/batch/backfill-missing-xp/route";
import type { McpToolContext } from "@/lib/mcp/tools/types";
import { listUserMissionsTool } from "@/lib/mcp/tools/user-missions";
import { getMvvBadgesWithUsers } from "@/lib/services/badges";
import { filterActiveUserIds } from "@/lib/services/user-status";
import { getUserMissionsServer } from "@/lib/services/userMissions";
import { findPrivateUserByFuzzyName } from "@/lib/slack/match-private-user-for-slack";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { createFakePostgrest, pad } from "../survey/fake-postgrest";

jest.mock("@/lib/supabase/server", () => ({
  createServiceClient: jest.fn(),
  createClient: jest.fn(),
}));
jest.mock("@/lib/utils/isOwner", () => ({
  requireOwner: jest.fn(),
  isUserIdOwner: jest.fn(),
}));
jest.mock("next/cache", () => ({
  revalidatePath: jest.fn(),
}));

const USERS = 1200;
const MISSIONS = 1500;
const PRAISED_HEAVY = 600;
const WITH_EXTERNAL = 1100;
const XP_GRANTED = 1400;
const MVV_TYPES = [
  "passionate_execution",
  "supreme_relationships",
  "happiness_circulation",
] as const;
const QUARTER = "2026-Q4";
const START = "2026-10-01T00:00:00.000Z";
const END = "2026-12-31T23:59:59.999Z";
const SAME_INSTANT = "2026-11-01T00:00:00.000Z";

const userId = (i: number) => `user-${pad(i)}`;
const userName = (i: number) => `社員${pad(i)}`;
const missionId = (i: number) => `mission-${pad(i)}`;
const range = (n: number) => Array.from({ length: n }, (_, i) => i);
const praisedUserIndex = (i: number) =>
  i < PRAISED_HEAVY ? 0 : (i + 1) % USERS;
const mvvTypeOf = (i: number) => MVV_TYPES[i % MVV_TYPES.length];

function buildTables() {
  const userMissions = range(MISSIONS).map((i) => ({
    id: missionId(i),
    created_by: userId(i % USERS),
    title: `投稿${i}`,
    content: "",
    status: "approved",
    approved_at: SAME_INSTANT,
    published_at: SAME_INSTANT,
    created_at: SAME_INSTANT,
    updated_at: SAME_INSTANT,
    likes_count: 1,
    image_paths: [],
    rejection_reason: null,
    approved_by: null,
    public_mission_id: null,
    user_mission_mvv_items: [{ mvv_type: mvvTypeOf(i) }],
    user_mission_likes: [],
    user_mission_praised_users: [
      {
        praised_user_id: userId(praisedUserIndex(i)),
        private_users: {
          name: userName(praisedUserIndex(i)),
          x_username: null,
        },
      },
    ],
  }));

  return {
    private_users: range(USERS).map((i) => ({
      id: userId(i),
      name: userName(i),
      address_prefecture: "東京都",
      registered_at: SAME_INSTANT,
      suspended_at: null,
      x_username: null,
    })),
    public_user_profiles: range(USERS).map((i) => ({
      id: userId(i),
      name: userName(i),
      avatar_url: null,
      x_username: null,
      suspended_at: null,
      business_unit_id: null,
      business_units: null,
    })),
    user_missions: userMissions,
    user_mission_praised_users: range(MISSIONS).map((i) => ({
      id: `praised-${pad(i)}`,
      user_mission_id: missionId(i),
      praised_user_id: userId(praisedUserIndex(i)),
    })),
    user_mission_mvv_items: range(MISSIONS).map((i) => ({
      id: `mvv-${pad(i)}`,
      user_mission_id: missionId(i),
      mvv_type: mvvTypeOf(i),
    })),
    user_mission_praised_external_users: range(WITH_EXTERNAL).map((i) => ({
      id: `external-${pad(i)}`,
      user_mission_id: missionId(i),
      praised_person_name: `社外${i}`,
    })),
    user_mission_likes: range(MISSIONS).map((i) => ({
      id: `like-${pad(i)}`,
      user_id: userId(i % USERS),
      user_mission_id: missionId(i),
      created_at: SAME_INSTANT,
    })),
    achievements: range(MISSIONS).map((i) => ({
      id: `achievement-${pad(i)}`,
      user_id: userId(i % USERS),
      mission_id: "mission-master",
      created_at: SAME_INSTANT,
      missions: { id: "mission-master", title: "達成", difficulty: 1 },
    })),
    xp_transactions: range(XP_GRANTED).map((i) => ({
      id: `xp-${pad(i)}`,
      source_type: "MISSION_COMPLETION",
      source_id: `achievement-${pad(i)}`,
    })),
    user_levels: range(USERS).map((i) => ({
      user_id: userId(i),
      xp: i,
      level: 1,
    })),
    user_invitations: range(USERS).map((i) => ({
      id: `invitation-${pad(i)}`,
      email: `invite${i}@example.com`,
      status: "pending",
      created_at: SAME_INSTANT,
      business_unit_id: null,
      business_units: null,
    })),
    user_badges: range(USERS).map((i) => ({
      id: `badge-${pad(i)}`,
      user_id: userId(i),
      badge_type: "MVV_PASSIONATE_EXECUTION",
      quarter_period: QUARTER,
      achieved_at: SAME_INSTANT,
    })),
  };
}

const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

describe("全件前提の取得は 1000 行を超えても欠けも重複もない", () => {
  let fake: ReturnType<typeof createFakePostgrest>;

  beforeEach(() => {
    fake = createFakePostgrest(buildTables());
    const withAuth = Object.assign(fake, {
      auth: { getUser: async () => ({ data: { user: null } }) },
    });
    jest
      .mocked(createServiceClient)
      .mockResolvedValue(
        withAuth as Awaited<ReturnType<typeof createServiceClient>>,
      );
    jest
      .mocked(createClient)
      .mockResolvedValue(withAuth as Awaited<ReturnType<typeof createClient>>);
  });

  it("評価エクスポートの集計", async () => {
    const result = await getAssessmentData(START, END);
    if (!result.success) throw new Error(result.error);

    const rows = result.data;
    expect(rows).toHaveLength(USERS);
    expect(sum(rows.map((r) => r.goodjobPostedCount))).toBe(MISSIONS);
    expect(sum(rows.map((r) => r.goodjobReceivedCount))).toBe(MISSIONS);
    expect(sum(rows.map((r) => r.likesReceivedCount))).toBe(MISSIONS);
    expect(sum(rows.map((r) => r.likesGivenCount))).toBe(MISSIONS);
    expect(sum(rows.map((r) => r.missionAchievementCount))).toBe(MISSIONS);
    expect(
      sum(
        rows.map(
          (r) =>
            r.passionateExecutionCount +
            r.supremeRelationshipsCount +
            r.happinessCirculationCount,
        ),
      ),
    ).toBe(MISSIONS);
    for (const row of rows) {
      expect(row.totalXp).toBe(Number(row.userId.slice(5)));
    }
  });

  it("グッジョブマトリクスと詳細", async () => {
    const matrix = await getMatrixData(START, END);
    if (!matrix.success) throw new Error(matrix.error);
    expect(sum(matrix.data.map((r) => r.total))).toBe(MISSIONS);

    const details = await getGoodjobDetails(
      userId(0),
      "passionate_execution",
      START,
      END,
    );
    if (!details.success) throw new Error(details.error);
    const expected = range(MISSIONS).filter(
      (i) =>
        praisedUserIndex(i) === 0 && mvvTypeOf(i) === "passionate_execution",
    );
    expect(details.data.map((d) => d.id).sort()).toEqual(
      expected.map(missionId),
    );
    expect(details.data.every((d) => d.createdByName !== "不明")).toBe(true);
  });

  it("ユーザーと会社の一覧、招待中の一覧", async () => {
    const users = await listUsersWithCompanies();
    if (!users.success) throw new Error(users.error);
    expect(users.users.map((u) => u.id)).toEqual(range(USERS).map(userId));

    const invitations = await listPendingInvitations();
    if (!invitations.success) throw new Error(invitations.error);
    expect(invitations.invitations.map((i) => i.id).sort()).toEqual(
      range(USERS).map((i) => `invitation-${pad(i)}`),
    );
  });

  it("Slack 表示名から全員を名寄せできる", async () => {
    const sampled = range(USERS).filter((i) => i % 50 === 0 || i === USERS - 1);
    const matched = [];
    for (const i of sampled) {
      matched.push(await findPrivateUserByFuzzyName(userName(i), fake));
    }
    expect(matched).toEqual(sampled.map(userId));
  });

  it("グッジョブ一覧（全件）と称賛されたグッジョブ一覧", async () => {
    const all = await getUserMissionsServer();
    expect(all.map((m) => m.id)).toEqual(
      range(MISSIONS).map(missionId).reverse(),
    );
    expect(sum(all.map((m) => m.praisedExternalUsers.length))).toBe(
      WITH_EXTERNAL,
    );
    expect(all.every((m) => m.createdByName !== "不明なユーザー")).toBe(true);

    const praised = await getUserMissionsServer({
      praisedForUserId: userId(0),
    });
    const expected = range(MISSIONS)
      .filter((i) => praisedUserIndex(i) === 0)
      .map(missionId)
      .reverse();
    expect(expected.length).toBeGreaterThan(500);
    expect(praised.map((m) => m.id)).toEqual(expected);
  });

  it("MCP の称賛されたグッジョブ一覧をページ送りで全件たどれる", async () => {
    const context = { db: fake } as unknown as McpToolContext;
    const seen: string[] = [];
    for (let offset = 0; ; offset += 100) {
      const page = (await listUserMissionsTool.execute(
        { praised_for_user_id: userId(0), limit: 100, offset },
        context,
      )) as { items: { id: string }[] };
      if (page.items.length === 0) break;
      seen.push(...page.items.map((item) => item.id));
    }
    expect(seen).toEqual(
      range(MISSIONS)
        .filter((i) => praisedUserIndex(i) === 0)
        .map(missionId)
        .reverse(),
    );
  });

  it("四半期の MVV バッジとユーザー", async () => {
    const badges = await getMvvBadgesWithUsers(QUARTER);
    expect(badges).toHaveLength(USERS);
  });

  it("停止中でないユーザーの絞り込み", async () => {
    const active = await filterActiveUserIds(range(USERS).map(userId));
    expect(active.size).toBe(USERS);
  });

  it("XP 補填バッチの未付与件数", async () => {
    const response = await getBackfillStatus();
    const body = await response.json();
    expect(body.statistics.missingXpAchievements).toBe(MISSIONS - XP_GRANTED);
  });
});
