import { clampLimit, clampOffset } from "@/lib/mcp/pagination";
import {
  getAwardNominationRanking,
  listEnpsMonthlySnapshots,
  listEnpsSurveys,
} from "@/lib/mcp/privileged-client";
import type { McpToolDefinition } from "@/lib/mcp/tools/types";
import { z } from "zod";

const paginationInput = {
  limit: z.number().int().optional(),
  offset: z.number().int().optional(),
};

const paginationSchema = {
  limit: { type: "number", description: "件数。既定20、最大100" },
  offset: { type: "number", description: "先頭から何件飛ばすか" },
};

export const listEnpsSurveysTool: McpToolDefinition<{
  year?: number;
  limit?: number;
  offset?: number;
}> = {
  name: "list_enps_surveys",
  description:
    "eNPS サーベイ定義と設問一覧。個別回答や AI 要約 payload は取れない。",
  scopes: ["survey_agg"],
  inputSchema: {
    type: "object",
    properties: {
      year: { type: "number", description: "year_month の年（例: 2026）" },
      ...paginationSchema,
    },
    additionalProperties: false,
  },
  input: z.object({
    year: z.number().int().min(2000).max(2100).optional(),
    ...paginationInput,
  }),
  async execute(input) {
    return listEnpsSurveys({
      year: input.year,
      limit: clampLimit(input.limit),
      offset: clampOffset(input.offset),
    });
  },
};

export const getEnpsMonthlySnapshotsTool: McpToolDefinition<{
  year_month?: string;
  group?: string;
  limit?: number;
  offset?: number;
}> = {
  name: "get_enps_monthly_snapshots",
  description:
    "凍結済み eNPS 月次スナップショット（会社・部門別の集計）。個別の自由記述は含まない。",
  scopes: ["survey_agg"],
  inputSchema: {
    type: "object",
    properties: {
      year_month: {
        type: "string",
        description: "対象月 YYYY-MM",
      },
      group: {
        type: "string",
        description: "company_name / business_unit_name / scope の完全一致",
      },
      ...paginationSchema,
    },
    additionalProperties: false,
  },
  input: z.object({
    year_month: z
      .string()
      .regex(/^\d{4}-\d{2}$/, "YYYY-MM")
      .optional(),
    group: z.string().min(1).max(80).optional(),
    ...paginationInput,
  }),
  async execute(input) {
    return listEnpsMonthlySnapshots({
      year_month: input.year_month,
      group: input.group,
      limit: clampLimit(input.limit),
      offset: clampOffset(input.offset),
    });
  },
};

const awardRankingInput = z
  .object({
    survey_id: z.string().uuid().optional(),
    year: z.number().int().min(2000).max(2100).optional(),
    quarter: z
      .union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)])
      .optional(),
  })
  .refine(
    (value) =>
      Boolean(value.survey_id) ||
      (value.year !== undefined && value.quarter !== undefined),
    { message: "survey_id か year+quarter のいずれかを指定してください" },
  );

export const getAwardNominationRankingTool: McpToolDefinition<{
  survey_id?: string;
  year?: number;
  quarter?: 1 | 2 | 3 | 4;
}> = {
  name: "get_award_nomination_ranking",
  description:
    "表彰の指名件数トップ（設問グループ別）。氏名は公開プロフィール名まで。個別の自由記述全文は出さない。",
  scopes: ["survey_agg"],
  inputSchema: {
    type: "object",
    properties: {
      survey_id: {
        type: "string",
        description: "表彰サーベイ UUID。指定時はその1件だけ集計",
      },
      year: { type: "number", description: "会計年度（4月始まり）" },
      quarter: {
        type: "number",
        description: "四半期 1-4（Q1=4-6月）",
      },
    },
    additionalProperties: false,
  },
  input: awardRankingInput,
  async execute(input) {
    return getAwardNominationRanking({
      survey_id: input.survey_id,
      year: input.year,
      quarter: input.quarter,
    });
  },
};
