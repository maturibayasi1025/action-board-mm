import type { McpPrincipal } from "@/lib/mcp/auth";
import {
  listAchievementsTool,
  listMissionsTool,
} from "@/lib/mcp/tools/missions";

const principal: McpPrincipal = {
  keyId: "ops-public",
  scopes: ["public"],
  label: "public",
};

function createThenQuery(result: { data: unknown; error: null }) {
  const query: Record<string, unknown> = {};
  const chain = jest.fn(() => query);
  query.select = chain;
  query.eq = chain;
  query.in = chain;
  query.order = chain;
  query.range = chain;
  query.gte = chain;
  query.lte = chain;
  query.maybeSingle = async () => result;
  query.then = (resolve: (value: { data: unknown; error: null }) => unknown) =>
    resolve(result);
  return query;
}

describe("list_missions", () => {
  it("returns allowlisted mission fields and clamps limit", async () => {
    const rows = [
      {
        id: "11111111-1111-1111-1111-111111111111",
        slug: "hello",
        title: "Hello",
        content: "body",
        difficulty: 1,
        required_artifact_type: "NONE",
        max_achievement_count: 1,
        is_featured: true,
        is_important: false,
        event_date: null,
        icon_url: null,
        ogp_image_url: null,
        artifact_label: null,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
        is_hidden: true,
        slack_user_id: "Uleak",
      },
    ];
    const db = {
      from: jest.fn(() => createThenQuery({ data: rows, error: null })),
    };

    const result = (await listMissionsTool.execute(
      { limit: 500 },
      { db: db as never, principal },
    )) as { items: Record<string, unknown>[]; limit: number };

    expect(result.limit).toBe(100);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.title).toBe("Hello");
    expect(result.items[0]?.is_hidden).toBeUndefined();
    expect(result.items[0]?.slack_user_id).toBeUndefined();
    expect(db.from).toHaveBeenCalledWith("missions");
  });
});

describe("list_achievements", () => {
  it("excludes hidden missions via an inner embed", async () => {
    const query = createThenQuery({ data: [], error: null });
    const db = {
      from: jest.fn(() => query),
    };

    await listAchievementsTool.execute({}, { db: db as never, principal });

    expect(db.from).toHaveBeenCalledWith("achievements");
    expect(query.select).toHaveBeenCalledWith(
      "id, user_id, mission_id, created_at, missions!inner(title, slug)",
    );
    expect(query.eq).toHaveBeenCalledWith("missions.is_hidden", false);
  });
});
