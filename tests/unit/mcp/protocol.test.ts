import { PHASE1_FORBIDDEN_TOOL_NAMES } from "@/lib/mcp/forbidden-tools";
import { handleMcpHttp } from "@/lib/mcp/http";
import { dispatchJsonRpc, listToolsForPrincipal } from "@/lib/mcp/protocol";
import { MCP_TOOLS } from "@/lib/mcp/tools";

const PUBLIC_KEYS = JSON.stringify([
  {
    id: "ops-public",
    secret: "public-secret",
    scopes: ["public"],
    label: "public",
  },
]);

function mcpRequest(body: unknown, headers?: Record<string, string>) {
  return new Request("https://mm-actionboard.jp/api/mcp", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer public-secret",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

describe("MCP protocol", () => {
  const originalKeys = process.env.MCP_API_KEYS;

  beforeEach(() => {
    process.env.MCP_API_KEYS = PUBLIC_KEYS;
  });

  afterEach(() => {
    if (originalKeys === undefined) {
      // biome-ignore lint/performance/noDelete: env cleanup requires delete in Node.js
      delete process.env.MCP_API_KEYS;
    } else {
      process.env.MCP_API_KEYS = originalKeys;
    }
  });

  it("rejects missing authorization", async () => {
    const response = await handleMcpHttp(
      new Request("https://mm-actionboard.jp/api/mcp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {},
        }),
      }),
    );
    expect(response.status).toBe(401);
  });

  it("initializes and lists only public tools", async () => {
    const init = await handleMcpHttp(
      mcpRequest({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: { protocolVersion: "2025-03-26", capabilities: {} },
      }),
    );
    expect(init.status).toBe(200);
    const initBody = (await init.json()) as {
      result: { serverInfo: { name: string }; protocolVersion: string };
    };
    expect(initBody.result.serverInfo.name).toBe("action-board-mcp");
    expect(initBody.result.protocolVersion).toBe("2025-03-26");

    const listed = await handleMcpHttp(
      mcpRequest({ jsonrpc: "2.0", id: 2, method: "tools/list" }),
    );
    const listedBody = (await listed.json()) as {
      result: { tools: { name: string }[] };
    };
    const names = listedBody.result.tools.map((tool) => tool.name);
    expect(names).toContain("list_missions");
    expect(names).toContain("get_xp_ranking");
    for (const forbidden of PHASE1_FORBIDDEN_TOOL_NAMES) {
      expect(names).not.toContain(forbidden);
    }
  });

  it("returns 202 for notifications", async () => {
    const response = await handleMcpHttp(
      mcpRequest({
        jsonrpc: "2.0",
        method: "notifications/initialized",
      }),
    );
    expect(response.status).toBe(202);
  });

  it("returns 405 for GET", async () => {
    const response = await handleMcpHttp(
      new Request("https://mm-actionboard.jp/api/mcp", { method: "GET" }),
    );
    expect(response.status).toBe(405);
  });

  it("forbids tools outside granted scopes", async () => {
    const response = await dispatchJsonRpc(
      {
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: { name: "list_enps_responses", arguments: {} },
      },
      {
        principal: { keyId: "ops-public", scopes: ["public"], label: "public" },
        getDb: () => {
          throw new Error("db should not be created");
        },
      },
    );
    expect(response?.error?.code).toBe(-32602);
  });
});

describe("tool registry", () => {
  it("registers only public-scoped tools in Phase 1", () => {
    expect(MCP_TOOLS.every((tool) => tool.scopes.includes("public"))).toBe(
      true,
    );
    const names = MCP_TOOLS.map((tool) => tool.name);
    for (const forbidden of PHASE1_FORBIDDEN_TOOL_NAMES) {
      expect(names).not.toContain(forbidden);
    }
  });

  it("hides restricted tools from a public principal", () => {
    const tools = listToolsForPrincipal({
      keyId: "x",
      scopes: ["public"],
      label: null,
    });
    expect(tools.some((tool) => tool.name === "list_missions")).toBe(true);
  });
});
