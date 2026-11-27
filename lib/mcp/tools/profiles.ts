import { McpToolError } from "@/lib/mcp/errors";
import { clampLimit, clampOffset, toRange } from "@/lib/mcp/pagination";
import { pickAllowlisted } from "@/lib/mcp/redact";
import type { McpToolDefinition } from "@/lib/mcp/tools/types";
import { fetchAllRows, fetchByIdChunks } from "@/lib/supabase/fetch-all-rows";
import { z } from "zod";

const PROFILE_COLUMNS = [
  "id",
  "name",
  "avatar_url",
  "address_prefecture",
  "github_username",
  "x_username",
  "business_unit_id",
] as const;

const LEVEL_COLUMNS = ["user_id", "xp", "level", "updated_at"] as const;

const BADGE_COLUMNS = [
  "id",
  "user_id",
  "badge_type",
  "sub_type",
  "rank",
  "achieved_at",
  "quarter_period",
  "badge_image_path",
  "icon_image_path",
] as const;

export const getPublicProfileTool: McpToolDefinition<{ user_id: string }> = {
  name: "get_public_profile",
  description:
    "公開プロフィールを1件取得。メール・生年月日・Slack ID は含まない。",
  scopes: ["public"],
  inputSchema: {
    type: "object",
    properties: {
      user_id: { type: "string", description: "ユーザー UUID" },
    },
    required: ["user_id"],
    additionalProperties: false,
  },
  input: z.object({ user_id: z.string().uuid() }),
  async execute(input, { db }) {
    const { data, error } = await db
      .from("public_user_profiles")
      .select(
        "id, name, avatar_url, address_prefecture, github_username, x_username, business_unit_id",
      )
      .eq("id", input.user_id)
      .maybeSingle();
    if (error) {
      throw new McpToolError(
        `プロフィールの取得に失敗しました: ${error.message}`,
      );
    }
    if (!data) {
      throw new McpToolError("プロフィールが見つかりません", "not_found");
    }
    return pickAllowlisted(
      data as unknown as Record<string, unknown>,
      PROFILE_COLUMNS,
    );
  },
};

export const searchPublicProfilesTool: McpToolDefinition<{
  query: string;
  business_unit_id?: string;
  limit?: number;
  offset?: number;
}> = {
  name: "search_public_profiles",
  description:
    "公開プロフィールを名前の部分一致で検索。メールや Slack ID は検索も返却もしない。",
  scopes: ["public"],
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string", description: "名前の部分一致" },
      business_unit_id: { type: "string", description: "部署 UUID で絞る" },
      limit: { type: "number", description: "件数。既定20、最大100" },
      offset: { type: "number" },
    },
    required: ["query"],
    additionalProperties: false,
  },
  input: z.object({
    query: z.string().trim().min(1).max(100),
    business_unit_id: z.string().uuid().optional(),
    limit: z.number().int().optional(),
    offset: z.number().int().optional(),
  }),
  async execute(input, { db }) {
    const limit = clampLimit(input.limit);
    const offset = clampOffset(input.offset);
    const range = toRange(limit, offset);
    const escaped = input.query.replace(/[%_]/g, "\\$&");
    let query = db
      .from("public_user_profiles")
      .select(
        "id, name, avatar_url, address_prefecture, github_username, x_username, business_unit_id",
      )
      .ilike("name", `%${escaped}%`)
      .order("name", { ascending: true })
      .order("id", { ascending: true })
      .range(range.from, range.to);
    if (input.business_unit_id) {
      query = query.eq("business_unit_id", input.business_unit_id);
    }
    const { data, error } = await query;
    if (error) {
      throw new McpToolError(
        `プロフィール検索に失敗しました: ${error.message}`,
      );
    }
    return {
      items: (data ?? []).map((row) =>
        pickAllowlisted(
          row as unknown as Record<string, unknown>,
          PROFILE_COLUMNS,
        ),
      ),
      limit,
      offset,
    };
  },
};

export const getUserLevelTool: McpToolDefinition<{ user_id: string }> = {
  name: "get_user_level",
  description: "公開されている XP とレベル。取引明細は含まない。",
  scopes: ["public"],
  inputSchema: {
    type: "object",
    properties: {
      user_id: { type: "string", description: "ユーザー UUID" },
    },
    required: ["user_id"],
    additionalProperties: false,
  },
  input: z.object({ user_id: z.string().uuid() }),
  async execute(input, { db }) {
    const { data, error } = await db
      .from("user_levels")
      .select("user_id, xp, level, updated_at")
      .eq("user_id", input.user_id)
      .maybeSingle();
    if (error) {
      throw new McpToolError(`レベルの取得に失敗しました: ${error.message}`);
    }
    if (!data) {
      throw new McpToolError("レベル情報が見つかりません", "not_found");
    }
    return pickAllowlisted(
      data as unknown as Record<string, unknown>,
      LEVEL_COLUMNS,
    );
  },
};

export const listUserBadgesTool: McpToolDefinition<{ user_id: string }> = {
  name: "list_user_badges",
  description: "ユーザーが持つバッジ。通知フラグなど内部状態は含まない。",
  scopes: ["public"],
  inputSchema: {
    type: "object",
    properties: {
      user_id: { type: "string", description: "ユーザー UUID" },
    },
    required: ["user_id"],
    additionalProperties: false,
  },
  input: z.object({ user_id: z.string().uuid() }),
  async execute(input, { db }) {
    type BadgeRow = Record<string, unknown>;
    let rows: BadgeRow[];
    try {
      rows = await fetchAllRows<BadgeRow>((from, to) =>
        db
          .from("user_badges")
          .select(
            "id, user_id, badge_type, sub_type, rank, achieved_at, quarter_period, badge_image_path, icon_image_path",
          )
          .eq("user_id", input.user_id)
          .order("badge_type", { ascending: true })
          .order("rank", { ascending: true })
          .order("id", { ascending: true })
          .range(from, to),
      );
    } catch (error) {
      throw new McpToolError(
        `バッジの取得に失敗しました: ${(error as Error).message}`,
      );
    }
    const badges = rows.map((row) => pickAllowlisted(row, BADGE_COLUMNS));
    const missionSlugs = Array.from(
      new Set(
        badges
          .filter((badge) => badge.badge_type === "MISSION" && badge.sub_type)
          .map((badge) => String(badge.sub_type)),
      ),
    );
    if (missionSlugs.length === 0) {
      return { items: badges };
    }
    let missions: { id: string; slug: string; title: string }[];
    try {
      // MISSION バッジはミッションごとに増えるので slug を分割する
      missions = await fetchByIdChunks(missionSlugs, (chunk) =>
        db.from("missions").select("id, slug, title").in("slug", chunk),
      );
    } catch (error) {
      throw new McpToolError(
        `バッジ用ミッション名の取得に失敗しました: ${(error as Error).message}`,
      );
    }
    const missionMap = new Map(
      missions.map((mission) => [
        mission.slug,
        { id: mission.id, title: mission.title },
      ]),
    );
    return {
      items: badges.map((badge) => {
        if (badge.badge_type !== "MISSION" || !badge.sub_type) {
          return badge;
        }
        const mission = missionMap.get(String(badge.sub_type));
        return {
          ...badge,
          mission_id: mission?.id ?? null,
          mission_title: mission?.title ?? null,
        };
      }),
    };
  },
};

export const listBusinessUnitsTool: McpToolDefinition<{
  company_id?: string;
}> = {
  name: "list_business_units",
  description: "有効な会社と部署のマスタ。無効な行は含まない。",
  scopes: ["public"],
  inputSchema: {
    type: "object",
    properties: {
      company_id: { type: "string", description: "会社 UUID で部署を絞る" },
    },
    additionalProperties: false,
  },
  input: z.object({ company_id: z.string().uuid().optional() }),
  async execute(input, { db }) {
    const companies = await fetchAllRows<{
      id: string;
      name: string;
      slug: string | null;
      display_order: number;
    }>((from, to) =>
      db
        .from("companies")
        .select("id, name, slug, display_order")
        .eq("is_active", true)
        .order("display_order", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to),
    ).catch((companyError) => {
      throw new McpToolError(
        `会社一覧の取得に失敗しました: ${companyError instanceof Error ? companyError.message : String(companyError)}`,
      );
    });

    const units = await fetchAllRows<{
      id: string;
      company_id: string;
      name: string;
      parent_id: string | null;
      display_order: number;
    }>((from, to) => {
      let unitQuery = db
        .from("business_units")
        .select("id, company_id, name, parent_id, display_order")
        .eq("is_active", true);
      if (input.company_id) {
        unitQuery = unitQuery.eq("company_id", input.company_id);
      }
      return unitQuery
        .order("display_order", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to);
    }).catch((unitError) => {
      throw new McpToolError(
        `部署一覧の取得に失敗しました: ${unitError instanceof Error ? unitError.message : String(unitError)}`,
      );
    });

    const companyName = new Map(
      companies.map((company) => [company.id, company.name]),
    );
    return {
      companies,
      business_units: units.map((unit) => ({
        ...unit,
        company_name: companyName.get(unit.company_id) ?? null,
      })),
    };
  },
};
