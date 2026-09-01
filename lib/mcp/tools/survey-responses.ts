import { clampOffset, clampSurveyRawLimit } from "@/lib/mcp/pagination";
import {
  getAwardResponse,
  getEnpsResponse,
  listAwardResponses,
  listEnpsResponses,
  listSlackIdsByUserIds,
} from "@/lib/mcp/privileged-client";
import { canExposeSlackUserId } from "@/lib/mcp/scopes";
import type { McpToolContext, McpToolDefinition } from "@/lib/mcp/tools/types";
import { z } from "zod";

const surveyRawPagination = {
  limit: z.number().int().optional(),
  offset: z.number().int().optional(),
};

const surveyRawPaginationSchema = {
  limit: { type: "number", description: "件数。既定50、最大200" },
  offset: { type: "number", description: "先頭から何件飛ばすか" },
};

async function attachSlackIds<T extends { user_id: string }>(
  rows: T[],
  context: McpToolContext,
  extraIds: (row: T) => Array<string | null | undefined> = () => [],
): Promise<
  Array<
    T & { slack_user_id?: string | null; nominee_slack_user_id?: string | null }
  >
> {
  if (!canExposeSlackUserId(context.principal) || rows.length === 0) {
    return rows;
  }
  const ids = rows.flatMap((row) => [row.user_id, ...extraIds(row)]);
  const slackIds = await listSlackIdsByUserIds(
    ids.filter((id): id is string => typeof id === "string" && id.length > 0),
  );
  return rows.map((row) => {
    const extraId = extraIds(row).find(
      (id): id is string => typeof id === "string" && id.length > 0,
    );
    return {
      ...row,
      slack_user_id: slackIds.get(row.user_id) ?? null,
      ...(extraId !== undefined
        ? { nominee_slack_user_id: slackIds.get(extraId) ?? null }
        : {}),
    };
  });
}

export const listEnpsResponsesTool: McpToolDefinition<{
  survey_id: string;
  question_id?: string;
  user_id?: string;
  limit?: number;
  offset?: number;
}> = {
  name: "list_enps_responses",
  description:
    "指定した eNPS サーベイの個別回答（スコア・自由記述・回答者）。survey_id 必須。全期間一括は不可。メールや生年月日は含まない。",
  scopes: ["survey_raw"],
  allowSlackUserId: true,
  inputSchema: {
    type: "object",
    properties: {
      survey_id: { type: "string", description: "eNPS サーベイ UUID（必須）" },
      question_id: { type: "string", description: "設問 UUID" },
      user_id: { type: "string", description: "回答者 UUID" },
      ...surveyRawPaginationSchema,
    },
    required: ["survey_id"],
    additionalProperties: false,
  },
  input: z.object({
    survey_id: z.string().uuid(),
    question_id: z.string().uuid().optional(),
    user_id: z.string().uuid().optional(),
    ...surveyRawPagination,
  }),
  async execute(input, context) {
    const result = await listEnpsResponses({
      survey_id: input.survey_id,
      question_id: input.question_id,
      user_id: input.user_id,
      limit: clampSurveyRawLimit(input.limit),
      offset: clampOffset(input.offset),
    });
    return {
      ...result,
      items: await attachSlackIds(result.items, context),
    };
  },
};

export const listAwardResponsesTool: McpToolDefinition<{
  survey_id: string;
  question_id?: string;
  user_id?: string;
  nominee_user_id?: string;
  limit?: number;
  offset?: number;
}> = {
  name: "list_award_responses",
  description:
    "指定した表彰サーベイの個別回答（自由記述・回答者・被指名者）。survey_id 必須。全期間一括は不可。",
  scopes: ["survey_raw"],
  allowSlackUserId: true,
  inputSchema: {
    type: "object",
    properties: {
      survey_id: { type: "string", description: "表彰サーベイ UUID（必須）" },
      question_id: { type: "string", description: "設問 UUID" },
      user_id: { type: "string", description: "回答者 UUID" },
      nominee_user_id: { type: "string", description: "被指名者 UUID" },
      ...surveyRawPaginationSchema,
    },
    required: ["survey_id"],
    additionalProperties: false,
  },
  input: z.object({
    survey_id: z.string().uuid(),
    question_id: z.string().uuid().optional(),
    user_id: z.string().uuid().optional(),
    nominee_user_id: z.string().uuid().optional(),
    ...surveyRawPagination,
  }),
  async execute(input, context) {
    const result = await listAwardResponses({
      survey_id: input.survey_id,
      question_id: input.question_id,
      user_id: input.user_id,
      nominee_user_id: input.nominee_user_id,
      limit: clampSurveyRawLimit(input.limit),
      offset: clampOffset(input.offset),
    });
    return {
      ...result,
      items: await attachSlackIds(result.items, context, (row) => [
        row.nominee_user_id,
      ]),
    };
  },
};

export const getEnpsResponseTool: McpToolDefinition<{ id: string }> = {
  name: "get_enps_response",
  description: "eNPS 個別回答を1件取得。メールや生年月日は含まない。",
  scopes: ["survey_raw"],
  allowSlackUserId: true,
  inputSchema: {
    type: "object",
    properties: {
      id: { type: "string", description: "回答 UUID" },
    },
    required: ["id"],
    additionalProperties: false,
  },
  input: z.object({ id: z.string().uuid() }),
  async execute(input, context) {
    const row = await getEnpsResponse(input.id);
    const [withSlack] = await attachSlackIds([row], context);
    return withSlack ?? row;
  },
};

export const getAwardResponseTool: McpToolDefinition<{ id: string }> = {
  name: "get_award_response",
  description: "表彰個別回答を1件取得。メールや生年月日は含まない。",
  scopes: ["survey_raw"],
  allowSlackUserId: true,
  inputSchema: {
    type: "object",
    properties: {
      id: { type: "string", description: "回答 UUID" },
    },
    required: ["id"],
    additionalProperties: false,
  },
  input: z.object({ id: z.string().uuid() }),
  async execute(input, context) {
    const row = await getAwardResponse(input.id);
    const [withSlack] = await attachSlackIds([row], context, (item) => [
      item.nominee_user_id,
    ]);
    return withSlack ?? row;
  },
};
