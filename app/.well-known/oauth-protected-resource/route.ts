import { mcpIssuer, mcpResourceUrl } from "@/lib/mcp/oauth";
import { oauthJson } from "@/lib/mcp/oauth-http";

export const runtime = "edge";

export function GET() {
  return oauthJson({
    resource: mcpResourceUrl(),
    authorization_servers: [mcpIssuer()],
    bearer_methods_supported: ["header"],
    scopes_supported: ["public"],
  });
}

export function OPTIONS() {
  return oauthJson(null, 204);
}
