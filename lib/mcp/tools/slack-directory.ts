import { clampLimit, clampOffset } from "@/lib/mcp/pagination";
import {
  getSlackDirectoryEntry,
  listSlackDirectory,
} from "@/lib/mcp/privileged-client";
import type { McpToolDefinition } from "@/lib/mcp/tools/types";
import { z } from "zod";

export const listSlackDirectoryTool: McpToolDefinition<{
  user_id?: string;
  query?: string;
  include_missing?: boolean;
  limit?: number;
  offset?: number;
}> = {
  name: "list_slack_directory",
  description:
    "user_id と公開名と Slack ID の対応表。生年月日・メール・HubSpot ID は含まない。slack_user_id が無い行はデフォルト除外。",
  scopes: ["slack_directory"],
  allowSlackUserId: true,
  inputSchema: {
    type: "object",
    properties: {
      user_id: { type: "string", description: "ユーザー UUID" },
      query: { type: "string", description: "公開名の部分一致" },
      include_missing: {
        type: "boolean",
        description: "true なら Slack ID 未登録も含める",
      },
      limit: { type: "number", description: "件数。既定20、最大100" },
      offset: { type: "number", description: "先頭から何件飛ばすか" },
    },
    additionalProperties: false,
  },
  input: z.object({
    user_id: z.string().uuid().optional(),
    query: z.string().min(1).max(80).optional(),
    include_missing: z.boolean().optional(),
    limit: z.number().int().optional(),
    offset: z.number().int().optional(),
  }),
  async execute(input) {
    return listSlackDirectory({
      user_id: input.user_id,
      query: input.query,
      include_missing: input.include_missing === true,
      limit: clampLimit(input.limit),
      offset: clampOffset(input.offset),
    });
  },
};

export const getSlackUserIdTool: McpToolDefinition<{ user_id: string }> = {
  name: "get_slack_user_id",
  description: "1人の Slack ID を取得。公開名以外の個人情報は付けない。",
  scopes: ["slack_directory"],
  allowSlackUserId: true,
  inputSchema: {
    type: "object",
    properties: {
      user_id: { type: "string", description: "ユーザー UUID" },
    },
    required: ["user_id"],
    additionalProperties: false,
  },
  input: z.object({ user_id: z.string().uuid() }),
  async execute(input) {
    return getSlackDirectoryEntry(input.user_id);
  },
};
