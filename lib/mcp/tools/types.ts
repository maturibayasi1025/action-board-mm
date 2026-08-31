import type { McpPrincipal } from "@/lib/mcp/auth";
import type { McpDb } from "@/lib/mcp/client";
import type { McpScope } from "@/lib/mcp/scopes";
import type { z } from "zod";

export type McpJsonSchema = {
  type: "object";
  properties?: Record<string, unknown>;
  required?: string[];
  additionalProperties?: boolean;
};

export type McpToolContext = {
  db: McpDb;
  principal: McpPrincipal;
};

export type McpToolDefinition<TInput = unknown> = {
  name: string;
  description: string;
  scopes: readonly McpScope[];
  inputSchema: McpJsonSchema;
  input: z.ZodType<TInput>;
  execute: (input: TInput, context: McpToolContext) => Promise<unknown>;
};

export type RegisteredMcpTool = {
  name: string;
  description: string;
  scopes: readonly McpScope[];
  inputSchema: McpJsonSchema;
  input: z.ZodType<unknown>;
  execute: (input: unknown, context: McpToolContext) => Promise<unknown>;
};

export function registerTool<TInput>(
  tool: McpToolDefinition<TInput>,
): RegisteredMcpTool {
  return tool as unknown as RegisteredMcpTool;
}
