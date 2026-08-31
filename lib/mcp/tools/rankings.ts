import { McpToolError } from "@/lib/mcp/errors";
import { clampLimit } from "@/lib/mcp/pagination";
import type { McpToolDefinition } from "@/lib/mcp/tools/types";
import { getTodayStartJST } from "@/lib/utils/date-timezone";
import { z } from "zod";

const rankingPeriodSchema = z.enum(["all", "daily"]);
type RankingPeriod = z.infer<typeof rankingPeriodSchema>;

function periodStart(period: RankingPeriod): Date | null {
  switch (period) {
    case "daily":
      return getTodayStartJST();
    case "all":
      return null;
    default: {
      const exhaustive: never = period;
      return exhaustive;
    }
  }
}

export const getXpRankingTool: McpToolDefinition<{
  period?: RankingPeriod;
  limit?: number;
}> = {
  name: "get_xp_ranking",
  description:
    "XP ランキング。period=all は通算、daily は日本時間の今日。取引明細は含まない。",
  scopes: ["public"],
  inputSchema: {
    type: "object",
    properties: {
      period: {
        type: "string",
        enum: ["all", "daily"],
        description: "all（通算）または daily（今日）",
      },
      limit: { type: "number", description: "件数。既定20、最大100" },
    },
    additionalProperties: false,
  },
  input: z.object({
    period: rankingPeriodSchema.optional(),
    limit: z.number().int().optional(),
  }),
  async execute(input, { db }) {
    const period = input.period ?? "all";
    const limit = clampLimit(input.limit);
    const start = periodStart(period);
    if (start) {
      const { data, error } = await db.rpc("get_period_ranking", {
        p_start_date: start.toISOString(),
        p_limit: limit,
      });
      if (error) {
        throw new McpToolError(
          `期間別XPランキングの取得に失敗しました: ${error.message}`,
        );
      }
      return { items: data ?? [], period, limit };
    }
    const { data, error } = await db
      .from("user_ranking_view")
      .select("user_id, name, address_prefecture, rank, level, xp, updated_at")
      .order("rank", { ascending: true })
      .limit(limit);
    if (error) {
      throw new McpToolError(
        `XPランキングの取得に失敗しました: ${error.message}`,
      );
    }
    return { items: data ?? [], period, limit };
  },
};

export const getMissionRankingTool: McpToolDefinition<{
  mission_id: string;
  period?: RankingPeriod;
  limit?: number;
}> = {
  name: "get_mission_ranking",
  description:
    "指定ミッションの達成ランキング。mission_id 必須。成果物の中身は含まない。",
  scopes: ["public"],
  inputSchema: {
    type: "object",
    properties: {
      mission_id: { type: "string", description: "ミッション UUID" },
      period: { type: "string", enum: ["all", "daily"] },
      limit: { type: "number", description: "件数。既定20、最大100" },
    },
    required: ["mission_id"],
    additionalProperties: false,
  },
  input: z.object({
    mission_id: z.string().uuid(),
    period: rankingPeriodSchema.optional(),
    limit: z.number().int().optional(),
  }),
  async execute(input, { db }) {
    const period = input.period ?? "all";
    const limit = clampLimit(input.limit);
    const start = periodStart(period);
    const { data, error } = start
      ? await db.rpc("get_period_mission_ranking", {
          p_mission_id: input.mission_id,
          p_limit: limit,
          p_start_date: start.toISOString(),
        })
      : await db.rpc("get_mission_ranking", {
          mission_id: input.mission_id,
          limit_count: limit,
        });
    if (error) {
      throw new McpToolError(
        `ミッションランキングの取得に失敗しました: ${error.message}`,
      );
    }
    return { items: data ?? [], period, limit };
  },
};

export const getLikesRankingTool: McpToolDefinition<{
  period?: RankingPeriod;
  limit?: number;
}> = {
  name: "get_likes_ranking",
  description: "承認済みグッジョブのいいね数ランキング。",
  scopes: ["public"],
  inputSchema: {
    type: "object",
    properties: {
      period: { type: "string", enum: ["all", "daily"] },
      limit: { type: "number", description: "件数。既定20、最大100" },
    },
    additionalProperties: false,
  },
  input: z.object({
    period: rankingPeriodSchema.optional(),
    limit: z.number().int().optional(),
  }),
  async execute(input, { db }) {
    const period = input.period ?? "all";
    const limit = clampLimit(input.limit);
    const start = periodStart(period);
    const { data, error } = start
      ? await db.rpc("get_period_likes_ranking", {
          p_limit: limit,
          p_start_date: start.toISOString(),
        })
      : await db.rpc("get_likes_ranking", { limit_count: limit });
    if (error) {
      throw new McpToolError(
        `いいねランキングの取得に失敗しました: ${error.message}`,
      );
    }
    return { items: data ?? [], period, limit };
  },
};

export const getPrefectureRankingTool: McpToolDefinition<{
  prefecture: string;
  period?: RankingPeriod;
  limit?: number;
}> = {
  name: "get_prefecture_ranking",
  description: "都道府県内の XP ランキング。prefecture 必須。",
  scopes: ["public"],
  inputSchema: {
    type: "object",
    properties: {
      prefecture: { type: "string", description: "都道府県名（例: 東京都）" },
      period: { type: "string", enum: ["all", "daily"] },
      limit: { type: "number", description: "件数。既定20、最大100" },
    },
    required: ["prefecture"],
    additionalProperties: false,
  },
  input: z.object({
    prefecture: z.string().trim().min(1).max(32),
    period: rankingPeriodSchema.optional(),
    limit: z.number().int().optional(),
  }),
  async execute(input, { db }) {
    const period = input.period ?? "all";
    const limit = clampLimit(input.limit);
    const start = periodStart(period);
    const { data, error } = start
      ? await db.rpc("get_period_prefecture_ranking", {
          p_prefecture: input.prefecture,
          p_limit: limit,
          p_start_date: start.toISOString(),
        })
      : await db.rpc("get_prefecture_ranking", {
          prefecture: input.prefecture,
          limit_count: limit,
        });
    if (error) {
      throw new McpToolError(
        `都道府県ランキングの取得に失敗しました: ${error.message}`,
      );
    }
    return { items: data ?? [], period, limit };
  },
};
