import { McpToolError } from "@/lib/mcp/errors";
import { clampLimit, clampOffset, toRange } from "@/lib/mcp/pagination";
import type { McpToolDefinition } from "@/lib/mcp/tools/types";
import { z } from "zod";

type MvvRow = { mvv_type: string };
type PraisedRow = { praised_user_id: string };

function mapMvvItems(items: MvvRow[] | null | undefined) {
  return {
    passionate_execution:
      items?.some((item) => item.mvv_type === "passionate_execution") ?? false,
    supreme_relationships:
      items?.some((item) => item.mvv_type === "supreme_relationships") ?? false,
    happiness_circulation:
      items?.some((item) => item.mvv_type === "happiness_circulation") ?? false,
  };
}

export const listUserMissionsTool: McpToolDefinition<{
  created_by?: string;
  praised_for_user_id?: string;
  limit?: number;
  offset?: number;
}> = {
  name: "list_user_missions",
  description:
    "承認済みのユーザー投稿グッジョブ。pending / rejected は含まない。投稿者名は公開プロフィールのみ。",
  scopes: ["public"],
  inputSchema: {
    type: "object",
    properties: {
      created_by: { type: "string", description: "投稿者 UUID" },
      praised_for_user_id: {
        type: "string",
        description: "称賛されたユーザー UUID",
      },
      limit: { type: "number", description: "件数。既定20、最大100" },
      offset: { type: "number" },
    },
    additionalProperties: false,
  },
  input: z.object({
    created_by: z.string().uuid().optional(),
    praised_for_user_id: z.string().uuid().optional(),
    limit: z.number().int().optional(),
    offset: z.number().int().optional(),
  }),
  async execute(input, { db }) {
    const limit = clampLimit(input.limit);
    const offset = clampOffset(input.offset);
    const range = toRange(limit, offset);

    let praisedMissionIds: string[] | null = null;
    if (input.praised_for_user_id) {
      const { data: praisedRows, error: praisedError } = await db
        .from("user_mission_praised_users")
        .select("user_mission_id")
        .eq("praised_user_id", input.praised_for_user_id);
      if (praisedError) {
        throw new McpToolError(
          `称賛対象の取得に失敗しました: ${praisedError.message}`,
        );
      }
      praisedMissionIds = (praisedRows ?? []).map((row) => row.user_mission_id);
      if (praisedMissionIds.length === 0) {
        return { items: [], limit, offset };
      }
    }

    let query = db
      .from("user_missions")
      .select(
        `
        id,
        created_by,
        title,
        content,
        likes_count,
        published_at,
        created_at,
        image_paths,
        user_mission_mvv_items ( mvv_type ),
        user_mission_praised_users ( praised_user_id )
      `,
      )
      .eq("status", "approved")
      .order("published_at", { ascending: false, nullsFirst: false })
      .range(range.from, range.to);

    if (praisedMissionIds) {
      query = query.in("id", praisedMissionIds);
    }
    if (input.created_by) {
      query = query.eq("created_by", input.created_by);
    }

    const { data, error } = await query;
    if (error) {
      throw new McpToolError(
        `ユーザーグッジョブの取得に失敗しました: ${error.message}`,
      );
    }
    const missions = data ?? [];
    if (missions.length === 0) {
      return { items: [], limit, offset };
    }

    const profileIds = new Set<string>();
    for (const mission of missions) {
      profileIds.add(mission.created_by);
      const praised = (mission.user_mission_praised_users ??
        []) as PraisedRow[];
      for (const row of praised) {
        profileIds.add(row.praised_user_id);
      }
    }

    const { data: profiles, error: profileError } = await db
      .from("public_user_profiles")
      .select("id, name, x_username")
      .in("id", Array.from(profileIds));
    if (profileError) {
      throw new McpToolError(
        `公開名の取得に失敗しました: ${profileError.message}`,
      );
    }
    const profileMap = new Map(
      (profiles ?? []).map((profile) => [profile.id, profile]),
    );

    const missionIds = missions.map((mission) => mission.id);
    const { data: externalUsers, error: externalError } = await db
      .from("user_mission_praised_external_users")
      .select("user_mission_id, praised_person_name")
      .in("user_mission_id", missionIds);
    if (externalError) {
      throw new McpToolError(
        `社外称賛名の取得に失敗しました: ${externalError.message}`,
      );
    }
    const externalMap = new Map<string, string[]>();
    for (const row of externalUsers ?? []) {
      const names = externalMap.get(row.user_mission_id) ?? [];
      names.push(row.praised_person_name);
      externalMap.set(row.user_mission_id, names);
    }

    return {
      items: missions.map((mission) => {
        const praised = (mission.user_mission_praised_users ??
          []) as PraisedRow[];
        return {
          id: mission.id,
          created_by: mission.created_by,
          created_by_name: profileMap.get(mission.created_by)?.name ?? null,
          title: mission.title,
          content: mission.content,
          likes_count: mission.likes_count,
          published_at: mission.published_at,
          created_at: mission.created_at,
          image_paths: mission.image_paths ?? [],
          mvv: mapMvvItems((mission.user_mission_mvv_items ?? []) as MvvRow[]),
          praised_users: praised.map((row) => ({
            user_id: row.praised_user_id,
            name: profileMap.get(row.praised_user_id)?.name ?? null,
            x_username: profileMap.get(row.praised_user_id)?.x_username ?? null,
          })),
          praised_external_users: externalMap.get(mission.id) ?? [],
        };
      }),
      limit,
      offset,
    };
  },
};
