import { McpToolError } from "@/lib/mcp/errors";
import { clampLimit, clampOffset, toRange } from "@/lib/mcp/pagination";
import type { McpToolDefinition } from "@/lib/mcp/tools/types";
import { fetchAllRows, fetchByIdChunks } from "@/lib/supabase/fetch-all-rows";
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

    const buildQuery = () => {
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
        .eq("status", "approved");
      if (input.created_by) {
        query = query.eq("created_by", input.created_by);
      }
      return query;
    };
    type MissionRow = NonNullable<
      Awaited<ReturnType<typeof buildQuery>>["data"]
    >[number];

    let missions: MissionRow[];
    const praisedForUserId = input.praised_for_user_id;
    if (praisedForUserId) {
      // 称賛されたグッジョブの ID は 1 回の .in() に収まらないことがあるため、
      // 分割して全件取得してから並べてページを切り出す
      const praisedRows = await fetchAllRows<{ user_mission_id: string }>(
        (from, to) =>
          db
            .from("user_mission_praised_users")
            .select("user_mission_id")
            .eq("praised_user_id", praisedForUserId)
            .order("id", { ascending: true })
            .range(from, to),
      ).catch((praisedError) => {
        throw new McpToolError(
          `称賛対象の取得に失敗しました: ${praisedError instanceof Error ? praisedError.message : String(praisedError)}`,
        );
      });
      const praisedMissions = await fetchByIdChunks<MissionRow>(
        praisedRows.map((row) => row.user_mission_id),
        (chunk) => buildQuery().in("id", chunk),
      ).catch((error) => {
        throw new McpToolError(
          `ユーザーグッジョブの取得に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
        );
      });
      praisedMissions.sort(
        (a, b) =>
          compareDescNullsLast(a.published_at, b.published_at) ||
          b.id.localeCompare(a.id),
      );
      missions = praisedMissions.slice(range.from, range.to + 1);
    } else {
      const { data, error } = await buildQuery()
        .order("published_at", { ascending: false, nullsFirst: false })
        .order("id", { ascending: false })
        .range(range.from, range.to);
      if (error) {
        throw new McpToolError(
          `ユーザーグッジョブの取得に失敗しました: ${error.message}`,
        );
      }
      missions = data ?? [];
    }
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

    const profiles = await fetchByIdChunks<{
      id: string;
      name: string;
      x_username: string | null;
    }>(Array.from(profileIds), (chunk) =>
      db
        .from("public_user_profiles")
        .select("id, name, x_username")
        .in("id", chunk),
    ).catch((profileError) => {
      throw new McpToolError(
        `公開名の取得に失敗しました: ${profileError instanceof Error ? profileError.message : String(profileError)}`,
      );
    });
    const profileMap = new Map(
      profiles.map((profile) => [profile.id, profile]),
    );

    const missionIds = missions.map((mission) => mission.id);
    const externalUsers = await fetchAllRows<{
      user_mission_id: string;
      praised_person_name: string;
    }>((from, to) =>
      db
        .from("user_mission_praised_external_users")
        .select("user_mission_id, praised_person_name")
        .in("user_mission_id", missionIds)
        .order("id", { ascending: true })
        .range(from, to),
    ).catch((externalError) => {
      throw new McpToolError(
        `社外称賛名の取得に失敗しました: ${externalError instanceof Error ? externalError.message : String(externalError)}`,
      );
    });
    const externalMap = new Map<string, string[]>();
    for (const row of externalUsers) {
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

function compareDescNullsLast(a: string | null, b: string | null): number {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return b.localeCompare(a);
}
