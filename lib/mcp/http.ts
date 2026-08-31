import { authenticateMcpRequest } from "@/lib/mcp/auth";
import { type McpDb, createMcpDb } from "@/lib/mcp/client";
import { mcpProtectedResourceMetadataUrl } from "@/lib/mcp/oauth";
import {
  dispatchJsonRpc,
  isJsonRpcRequest,
  isNotification,
} from "@/lib/mcp/protocol";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Authorization, Content-Type, Accept, MCP-Protocol-Version",
};

export async function handleMcpHttp(
  request: Request,
  deps?: { db?: McpDb },
): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (request.method !== "POST") {
    return jsonResponse({ error: "Use POST (MCP Streamable HTTP)" }, 405, {
      Allow: "POST, OPTIONS",
    });
  }

  const principal = await authenticateMcpRequest(
    request.headers.get("authorization"),
  );
  if (!principal) {
    return jsonResponse({ error: "Unauthorized" }, 401, {
      "WWW-Authenticate": `Bearer realm="mcp", resource_metadata="${mcpProtectedResourceMetadataUrl()}"`,
    });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, 400);
  }

  const getDb = () => deps?.db ?? createMcpDb();

  if (Array.isArray(body)) {
    const responses = [];
    for (const item of body) {
      if (!isJsonRpcRequest(item)) {
        responses.push({
          jsonrpc: "2.0",
          id: null,
          error: { code: -32600, message: "Invalid Request" },
        });
        continue;
      }
      const response = await dispatchJsonRpc(item, { principal, getDb });
      if (response) {
        responses.push(response);
      }
    }
    if (responses.length === 0) {
      return new Response(null, { status: 202, headers: CORS_HEADERS });
    }
    return jsonResponse(responses, 200);
  }

  if (!isJsonRpcRequest(body)) {
    return jsonResponse(
      {
        jsonrpc: "2.0",
        id: null,
        error: { code: -32600, message: "Invalid Request" },
      },
      400,
    );
  }

  if (isNotification(body)) {
    return new Response(null, { status: 202, headers: CORS_HEADERS });
  }
  const response = await dispatchJsonRpc(body, { principal, getDb });
  return jsonResponse(response, 200);
}

function jsonResponse(
  body: unknown,
  status: number,
  extraHeaders?: Record<string, string>,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...CORS_HEADERS,
      ...extraHeaders,
    },
  });
}
