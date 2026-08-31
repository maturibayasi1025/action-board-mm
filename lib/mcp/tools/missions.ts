import { McpToolError } from "@/lib/mcp/errors";
import { clampLimit, clampOffset, toRange } from "@/lib/mcp/pagination";
import { pickAllowlisted } from "@/lib/mcp/redact";
import type { McpToolDefinition } from "@/lib/mcp/tools/types";
import { z } from "zod";

const MISSION_COLUMNS = [
  "id",
  "slug",
  "title",
  "content",
  "difficulty",
  "required_artifact_type",
  "max_achievement_count",
  "is_featured",
  "is_important",
  "event_date",
  "icon_url",
  "ogp_image_url",
  "artifact_label",
  "created_at",
  "updated_at",
] as const;

const MISSION_SELECT =
  "id, slug, title, content, difficulty, required_artifact_type, max_achievement_count, is_featured, is_important, event_date, icon_url, ogp_image_url, artifact_label, created_at, updated_at";

const paginationInput = {
  limit: z.number().int().optional(),
  offset: z.number().int().optional(),
};

export const listMissionsTool: McpToolDefinition<{
  featured?: boolean;
  important?: boolean;
  category_slug?: string;
  limit?: number;
  offset?: number;
}> = {
  name: "list_missions",
  description:
    "公式グッジョブ（ミッション）一覧。非表示ミッションは含まない。成果物の中身やメールは取れない。",
  scopes: ["public"],
  inputSchema: {
    type: "object",
    properties: {
      featured: {
        type: "boolean",
        description: "注目ミッションだけに絞る",
      },
      important: {
        type: "boolean",
        description: "重要ミッションだけに絞る",
      },
      category_slug: {
        type: "string",
        description: "カテゴリ slug で絞る",
      },
      limit: { type: "number", description: "件数。既定20、最大100" },
      offset: { type: "number", description: "先頭から何件飛ばすか" },
    },
    additionalProperties: false,
  },
  input: z.object({
    featured: z.boolean().optional(),
    important: z.boolean().optional(),
    category_slug: z.string().min(1).optional(),
    ...paginationInput,
  }),
  async execute(input, { db }) {
    const limit = clampLimit(input.limit);
    const offset = clampOffset(input.offset);
    const range = toRange(limit, offset);

    let missionIds: string[] | null = null;
    if (input.category_slug) {
      const { data: category, error: categoryError } = await db
        .from("mission_category")
        .select("id")
        .eq("slug", input.category_slug)
        .eq("del_flg", false)
        .maybeSingle();
      if (categoryError) {
        throw new McpToolError(
          `カテゴリの取得に失敗しました: ${categoryError.message}`,
        );
      }
      if (!category) {
        return { items: [], limit, offset };
      }
      const { data: links, error: linkError } = await db
        .from("mission_category_link")
        .select("mission_id")
        .eq("category_id", category.id)
        .eq("del_flg", false);
      if (linkError) {
        throw new McpToolError(
          `カテゴリ紐付けの取得に失敗しました: ${linkError.message}`,
        );
      }
      missionIds = (links ?? []).map((row) => row.mission_id);
      if (missionIds.length === 0) {
        return { items: [], limit, offset };
      }
    }

    let query = db
      .from("missions")
      .select(MISSION_SELECT)
      .eq("is_hidden", false)
      .order("difficulty", { ascending: true })
      .order("created_at", { ascending: false })
      .range(range.from, range.to);

    if (input.featured === true) {
      query = query.eq("is_featured", true);
    }
    if (input.important === true) {
      query = query.eq("is_important", true);
    }
    if (missionIds) {
      query = query.in("id", missionIds);
    }

    const { data, error } = await query;
    if (error) {
      throw new McpToolError(
        `ミッション一覧の取得に失敗しました: ${error.message}`,
      );
    }
    return {
      items: (data ?? []).map((row) =>
        pickAllowlisted(
          row as unknown as Record<string, unknown>,
          MISSION_COLUMNS,
        ),
      ),
      limit,
      offset,
    };
  },
};

export const getMissionTool: McpToolDefinition<{ id?: string; slug?: string }> =
  {
    name: "get_mission",
    description:
      "公式グッジョブを id または slug で1件取得。非表示ミッションは返さない。",
    scopes: ["public"],
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "ミッション UUID" },
        slug: { type: "string", description: "ミッション slug" },
      },
      additionalProperties: false,
    },
    input: z
      .object({
        id: z.string().uuid().optional(),
        slug: z.string().min(1).optional(),
      })
      .refine((value) => Boolean(value.id || value.slug), {
        message: "id または slug が必要です",
      }),
    async execute(input, { db }) {
      let query = db
        .from("missions")
        .select(MISSION_SELECT)
        .eq("is_hidden", false);
      if (input.id) {
        query = query.eq("id", input.id);
      } else if (input.slug) {
        query = query.eq("slug", input.slug);
      }
      const { data, error } = await query.maybeSingle();
      if (error) {
        throw new McpToolError(
          `ミッションの取得に失敗しました: ${error.message}`,
        );
      }
      if (!data) {
        throw new McpToolError("ミッションが見つかりません", "not_found");
      }
      return pickAllowlisted(
        data as unknown as Record<string, unknown>,
        MISSION_COLUMNS,
      );
    },
  };

export const listMissionCategoriesTool: McpToolDefinition<
  Record<string, never>
> = {
  name: "list_mission_categories",
  description:
    "ミッションカテゴリの一覧。削除フラグが立っているものは含まない。",
  scopes: ["public"],
  inputSchema: { type: "object", additionalProperties: false },
  input: z.object({}),
  async execute(_input, { db }) {
    const { data, error } = await db
      .from("mission_category")
      .select("id, slug, category_title, sort_no")
      .eq("del_flg", false)
      .order("sort_no", { ascending: true });
    if (error) {
      throw new McpToolError(
        `カテゴリ一覧の取得に失敗しました: ${error.message}`,
      );
    }
    return { items: data ?? [] };
  },
};

export const listAchievementsTool: McpToolDefinition<{
  user_id?: string;
  mission_id?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}> = {
  name: "list_achievements",
  description:
    "公式ミッションの達成記録（誰が何をいつ達成したか）。成果物の本文・画像・位置情報は含まない。",
  scopes: ["public"],
  inputSchema: {
    type: "object",
    properties: {
      user_id: { type: "string", description: "達成したユーザーの UUID" },
      mission_id: { type: "string", description: "ミッション UUID" },
      from: { type: "string", description: "この日時以降（ISO 8601）" },
      to: { type: "string", description: "この日時以前（ISO 8601）" },
      limit: { type: "number", description: "件数。既定20、最大100" },
      offset: { type: "number" },
    },
    additionalProperties: false,
  },
  input: z.object({
    user_id: z.string().uuid().optional(),
    mission_id: z.string().uuid().optional(),
    from: z.string().min(1).optional(),
    to: z.string().min(1).optional(),
    ...paginationInput,
  }),
  async execute(input, { db }) {
    const limit = clampLimit(input.limit);
    const offset = clampOffset(input.offset);
    const range = toRange(limit, offset);
    let query = db
      .from("achievements")
      .select("id, user_id, mission_id, created_at, missions(title, slug)")
      .order("created_at", { ascending: false })
      .range(range.from, range.to);
    if (input.user_id) {
      query = query.eq("user_id", input.user_id);
    }
    if (input.mission_id) {
      query = query.eq("mission_id", input.mission_id);
    }
    if (input.from) {
      query = query.gte("created_at", input.from);
    }
    if (input.to) {
      query = query.lte("created_at", input.to);
    }
    const { data, error } = await query;
    if (error) {
      throw new McpToolError(`達成記録の取得に失敗しました: ${error.message}`);
    }
    const items = (data ?? []).map((row) => {
      const mission = Array.isArray(row.missions)
        ? row.missions[0]
        : row.missions;
      return {
        id: row.id,
        user_id: row.user_id,
        mission_id: row.mission_id,
        created_at: row.created_at,
        mission_title: mission?.title ?? null,
        mission_slug: mission?.slug ?? null,
      };
    });
    return { items, limit, offset };
  },
};
