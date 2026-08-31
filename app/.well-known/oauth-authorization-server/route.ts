import { mcpIssuer } from "@/lib/mcp/oauth";
import { oauthJson } from "@/lib/mcp/oauth-http";

export const runtime = "edge";

export function GET() {
  const issuer = mcpIssuer();
  return oauthJson({
    issuer,
    authorization_endpoint: `${issuer}/api/mcp/oauth/authorize`,
    token_endpoint: `${issuer}/api/mcp/oauth/token`,
    registration_endpoint: `${issuer}/api/mcp/oauth/register`,
    scopes_supported: ["public"],
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    authorization_response_iss_parameter_supported: true,
  });
}

export function OPTIONS() {
  return oauthJson(null, 204);
}
