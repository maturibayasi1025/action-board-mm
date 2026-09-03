/** @jest-environment node */
import {
  NEVER_REGISTERED_TOOL_NAMES,
  RESTRICTED_TOOL_NAMES,
  SURVEY_AGG_TOOL_NAMES,
} from "@/lib/mcp/forbidden-tools";
import { handleMcpHttp } from "@/lib/mcp/http";
import { dispatchJsonRpc, listToolsForPrincipal } from "@/lib/mcp/protocol";
import { MCP_TOOLS } from "@/lib/mcp/tools";

jest.mock("@/lib/mcp/client", () => ({
  createMcpDb: jest.fn(() => {
    throw new Error("db should not be created");
  }),
}));

const PUBLIC_KEYS = JSON.stringify([
  {
    id: "ops-public",
    secret: "public-secret",
    scopes: ["public"],
    label: "public",
  },
  {
    id: "ops-restricted-key",
    secret: "restricted-secret",
    scopes: ["public", "survey_agg", "slack_directory", "survey_raw"],
    label: "key-with-restricted-scopes",
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
    for (const forbidden of [
      ...RESTRICTED_TOOL_NAMES,
      ...SURVEY_AGG_TOOL_NAMES,
      ...NEVER_REGISTERED_TOOL_NAMES,
    ]) {
      expect(names).not.toContain(forbidden);
    }
  });

  it("hides restricted tools from an API key even if scopes are present", async () => {
    const listed = await handleMcpHttp(
      mcpRequest(
        { jsonrpc: "2.0", id: 2, method: "tools/list" },
        { Authorization: "Bearer restricted-secret" },
      ),
    );
    const listedBody = (await listed.json()) as {
      result: { tools: { name: string }[] };
    };
    const names = listedBody.result.tools.map((tool) => tool.name);
    expect(names).toContain("list_enps_surveys");
    for (const restricted of RESTRICTED_TOOL_NAMES) {
      expect(names).not.toContain(restricted);
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

  it("forbids restricted tools for a public principal", async () => {
    const response = await dispatchJsonRpc(
      {
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: { name: "list_enps_responses", arguments: {} },
      },
      {
        principal: {
          keyId: "ops-public",
          scopes: ["public"],
          label: "public",
          email: null,
        },
        getDb: () => {
          throw new Error("db should not be created");
        },
      },
    );
    expect(response?.error?.code).toBe(-32000);
  });

  it("forbids survey_raw on an API key even when the scope is granted", async () => {
    const response = await dispatchJsonRpc(
      {
        jsonrpc: "2.0",
        id: 4,
        method: "tools/call",
        params: {
          name: "list_enps_responses",
          arguments: { survey_id: "11111111-1111-1111-1111-111111111111" },
        },
      },
      {
        principal: {
          keyId: "ops-restricted-key",
          scopes: ["public", "survey_raw"],
          label: "key",
          email: null,
        },
        getDb: () => {
          throw new Error("db should not be created");
        },
      },
    );
    expect(response?.error?.code).toBe(-32000);
  });

  it("does not register write or SQL tools", async () => {
    const response = await dispatchJsonRpc(
      {
        jsonrpc: "2.0",
        id: 5,
        method: "tools/call",
        params: { name: "execute_sql", arguments: { sql: "select 1" } },
      },
      {
        principal: {
          keyId: "ops-public",
          scopes: ["public"],
          label: "public",
          email: null,
        },
        getDb: () => {
          throw new Error("db should not be created");
        },
      },
    );
    expect(response?.error?.code).toBe(-32602);
  });
});

describe("tool registry", () => {
  it("registers Phase 3 tools and never registers SQL/write tools", () => {
    const names = MCP_TOOLS.map((tool) => tool.name);
    for (const name of SURVEY_AGG_TOOL_NAMES) {
      expect(names).toContain(name);
    }
    for (const name of RESTRICTED_TOOL_NAMES) {
      expect(names).toContain(name);
    }
    for (const forbidden of NEVER_REGISTERED_TOOL_NAMES) {
      expect(names).not.toContain(forbidden);
    }
  });

  it("hides restricted tools from a public principal", () => {
    const tools = listToolsForPrincipal({
      keyId: "x",
      scopes: ["public"],
      label: null,
      email: null,
    });
    const names = tools.map((tool) => tool.name);
    expect(names).toContain("list_missions");
    for (const restricted of RESTRICTED_TOOL_NAMES) {
      expect(names).not.toContain(restricted);
    }
  });

  it("lists restricted tools only for a Google principal with scopes", () => {
    const tools = listToolsForPrincipal({
      keyId: "google:owner@maisonmarc.com",
      scopes: ["public", "survey_agg", "slack_directory", "survey_raw"],
      label: "owner@maisonmarc.com",
      email: "owner@maisonmarc.com",
    });
    const names = tools.map((tool) => tool.name);
    expect(names).toContain("list_enps_surveys");
    expect(names).toContain("list_slack_directory");
    expect(names).toContain("list_enps_responses");
    expect(names).toContain("export_enps_responses_csv");
    expect(names).toContain("export_award_responses_csv");
  });
});
