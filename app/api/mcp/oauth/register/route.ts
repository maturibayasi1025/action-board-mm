import { isAllowedOAuthRedirectUri } from "@/lib/mcp/oauth";
import { oauthJson } from "@/lib/mcp/oauth-http";

export const runtime = "edge";

export function OPTIONS() {
  return oauthJson(null, 204);
}

export async function POST(request: Request) {
  let body: { redirect_uris?: unknown; client_name?: unknown };
  try {
    body = (await request.json()) as {
      redirect_uris?: unknown;
      client_name?: unknown;
    };
  } catch {
    return oauthJson({ error: "invalid_client_metadata" }, 400);
  }
  const redirectUris = Array.isArray(body.redirect_uris)
    ? body.redirect_uris.filter((uri): uri is string => typeof uri === "string")
    : [];
  if (
    redirectUris.length === 0 ||
    redirectUris.some((uri) => !isAllowedOAuthRedirectUri(uri))
  ) {
    return oauthJson({ error: "invalid_redirect_uri" }, 400);
  }
  return oauthJson(
    {
      client_id: crypto.randomUUID(),
      client_name:
        typeof body.client_name === "string" ? body.client_name : "mcp",
      redirect_uris: redirectUris,
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    },
    201,
  );
}
