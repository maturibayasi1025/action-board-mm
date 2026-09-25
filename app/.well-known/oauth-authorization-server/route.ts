import { mcpIssuer } from "@/lib/mcp/oauth";
import { oauthJson } from "@/lib/mcp/oauth-http";
import { MCP_SCOPES } from "@/lib/mcp/scopes";

export const runtime = "edge";

export function GET() {
  const issuer = mcpIssuer();
  return oauthJson({
    issuer,
    authorization_endpoint: `${issuer}/api/mcp/oauth/authorize`,
    token_endpoint: `${issuer}/api/mcp/oauth/token`,
    registration_endpoint: `${issuer}/api/mcp/oauth/register`,
    scopes_supported: [...MCP_SCOPES, "offline_access"],
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    authorization_response_iss_parameter_supported: true,
  });
}

export function OPTIONS() {
  return oauthJson(null, 204);
}
