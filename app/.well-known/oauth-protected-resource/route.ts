import { mcpIssuer, mcpResourceUrl } from "@/lib/mcp/oauth";
import { oauthJson } from "@/lib/mcp/oauth-http";
import { MCP_SCOPES } from "@/lib/mcp/scopes";

export const runtime = "edge";

export function GET() {
  return oauthJson({
    resource: mcpResourceUrl(),
    authorization_servers: [mcpIssuer()],
    bearer_methods_supported: ["header"],
    scopes_supported: [...MCP_SCOPES],
  });
}

export function OPTIONS() {
  return oauthJson(null, 204);
}
