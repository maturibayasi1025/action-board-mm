import { inferRowCount, logMcpAudit } from "@/lib/mcp/audit";
import type { McpPrincipal } from "@/lib/mcp/auth";
import type { McpDb } from "@/lib/mcp/client";
import { isMcpToolError } from "@/lib/mcp/errors";
import { stripForbiddenKeys } from "@/lib/mcp/redact";
import { hasAllScopes } from "@/lib/mcp/scopes";
import { MCP_TOOLS, MCP_TOOL_BY_NAME } from "@/lib/mcp/tools";

export const MCP_PROTOCOL_VERSION = "2025-03-26";
export const SUPPORTED_PROTOCOL_VERSIONS = [
  "2024-11-05",
  "2025-03-26",
  "2025-06-18",
] as const;

export type JsonRpcId = string | number | null;

export type JsonRpcRequest = {
  jsonrpc: "2.0";
  id?: JsonRpcId;
  method: string;
  params?: unknown;
};

export type JsonRpcResponse = {
  jsonrpc: "2.0";
  id: JsonRpcId;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
};

export function isJsonRpcRequest(value: unknown): value is JsonRpcRequest {
  if (!value || typeof value !== "object") {
    return false;
  }
  const record = value as Record<string, unknown>;
  return record.jsonrpc === "2.0" && typeof record.method === "string";
}

export function isNotification(request: JsonRpcRequest): boolean {
  return request.id === undefined;
}

export function listToolsForPrincipal(principal: McpPrincipal) {
  return MCP_TOOLS.filter((tool) =>
    hasAllScopes(principal.scopes, tool.scopes),
  ).map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
  }));
}

export type McpDispatchContext = {
  principal: McpPrincipal;
  getDb: () => McpDb;
};

export async function dispatchJsonRpc(
  request: JsonRpcRequest,
  context: McpDispatchContext,
): Promise<JsonRpcResponse | null> {
  if (isNotification(request)) {
    return null;
  }
  const id = request.id ?? null;
  try {
    const result = await dispatchMethod(request, context);
    return { jsonrpc: "2.0", id, result };
  } catch (error) {
    if (error instanceof JsonRpcError) {
      return {
        jsonrpc: "2.0",
        id,
        error: { code: error.code, message: error.message, data: error.data },
      };
    }
    const message = error instanceof Error ? error.message : "Internal error";
    return {
      jsonrpc: "2.0",
      id,
      error: { code: -32603, message },
    };
  }
}

class JsonRpcError extends Error {
  readonly code: number;
  readonly data?: unknown;

  constructor(code: number, message: string, data?: unknown) {
    super(message);
    this.name = "JsonRpcError";
    this.code = code;
    this.data = data;
  }
}

async function dispatchMethod(
  request: JsonRpcRequest,
  context: McpDispatchContext,
): Promise<unknown> {
  switch (request.method) {
    case "initialize":
      return initializeResult(request.params);
    case "ping":
      return {};
    case "tools/list":
      return { tools: listToolsForPrincipal(context.principal) };
    case "tools/call":
      return callTool(request.params, context);
    case "resources/list":
      return { resources: [] };
    case "prompts/list":
      return { prompts: [] };
    case "notifications/initialized":
      return {};
    default:
      throw new JsonRpcError(-32601, `Method not found: ${request.method}`);
  }
}

function initializeResult(params: unknown) {
  const requested =
    params && typeof params === "object"
      ? (params as { protocolVersion?: string }).protocolVersion
      : undefined;
  const protocolVersion =
    requested &&
    (SUPPORTED_PROTOCOL_VERSIONS as readonly string[]).includes(requested)
      ? requested
      : MCP_PROTOCOL_VERSION;
  return {
    protocolVersion,
    capabilities: {
      tools: { listChanged: false },
    },
    serverInfo: {
      name: "action-board-mcp",
      version: "0.1.0",
    },
    instructions:
      "Action Board の読み取り専用 MCP。公開データ（ミッション、ランキング、公開プロフィール、承認済みグッジョブ）だけを返す。メール・個別サーベイ回答・Slack ID はこのキーでは取れない。",
  };
}

async function callTool(params: unknown, context: McpDispatchContext) {
  if (!params || typeof params !== "object") {
    throw new JsonRpcError(-32602, "tools/call requires params");
  }
  const { name, arguments: rawArgs } = params as {
    name?: unknown;
    arguments?: unknown;
  };
  if (typeof name !== "string" || name.length === 0) {
    throw new JsonRpcError(-32602, "tools/call requires name");
  }
  const tool = MCP_TOOL_BY_NAME.get(name);
  if (!tool) {
    throw new JsonRpcError(-32602, `Unknown tool: ${name}`);
  }
  if (!hasAllScopes(context.principal.scopes, tool.scopes)) {
    throw new JsonRpcError(-32000, `Forbidden tool: ${name}`);
  }

  const parsed = tool.input.safeParse(rawArgs ?? {});
  if (!parsed.success) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            error: "invalid_input",
            details: parsed.error.flatten(),
          }),
        },
      ],
      isError: true,
    };
  }

  const started = Date.now();
  try {
    const payload = stripForbiddenKeys(
      await tool.execute(parsed.data, {
        db: context.getDb(),
        principal: context.principal,
      }),
    );
    logMcpAudit({
      keyId: context.principal.keyId,
      email: context.principal.email,
      tool: name,
      latencyMs: Date.now() - started,
      rowCount: inferRowCount(payload),
      ok: true,
    });
    return {
      content: [{ type: "text", text: JSON.stringify(payload) }],
      isError: false,
    };
  } catch (error) {
    const message = isMcpToolError(error)
      ? error.message
      : error instanceof Error
        ? error.message
        : "tool failed";
    logMcpAudit({
      keyId: context.principal.keyId,
      email: context.principal.email,
      tool: name,
      latencyMs: Date.now() - started,
      rowCount: null,
      ok: false,
    });
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            error: isMcpToolError(error) ? error.status : "query_failed",
            message,
          }),
        },
      ],
      isError: true,
    };
  }
}
