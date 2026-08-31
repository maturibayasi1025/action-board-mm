import type { McpPrincipal } from "@/lib/mcp/auth";
import { getXpRankingTool } from "@/lib/mcp/tools/rankings";

const principal: McpPrincipal = {
  keyId: "ops-public",
  scopes: ["public"],
  label: "public",
  email: null,
};

describe("get_xp_ranking", () => {
  it("reads the ranking view for all-time", async () => {
    const query: Record<string, unknown> = {};
    const chain = () => query;
    query.select = chain;
    query.order = chain;
    query.limit = chain;
    query.then = (
      resolve: (value: { data: unknown; error: null }) => unknown,
    ) =>
      resolve({
        data: [{ user_id: "u1", name: "A", rank: 1, xp: 10 }],
        error: null,
      });

    const db = {
      from: jest.fn(() => query),
      rpc: jest.fn(),
    };

    const result = (await getXpRankingTool.execute(
      { period: "all", limit: 5 },
      { db: db as never, principal },
    )) as { items: unknown[]; period: string };

    expect(result.period).toBe("all");
    expect(result.items).toHaveLength(1);
    expect(db.from).toHaveBeenCalledWith("user_ranking_view");
    expect(db.rpc).not.toHaveBeenCalled();
  });

  it("uses the period RPC for daily", async () => {
    const db = {
      from: jest.fn(),
      rpc: jest.fn().mockResolvedValue({ data: [], error: null }),
    };

    await getXpRankingTool.execute(
      { period: "daily" },
      { db: db as never, principal },
    );

    expect(db.rpc).toHaveBeenCalledWith(
      "get_period_ranking",
      expect.objectContaining({ p_limit: 20 }),
    );
  });
});
