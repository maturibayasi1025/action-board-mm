import {
  MCP_ACCESS_TOKEN_TTL_SECONDS,
  consumeAuthorizationCode,
  issueAccessToken,
  readMcpOAuthEnv,
} from "@/lib/mcp/oauth";
import { oauthJson } from "@/lib/mcp/oauth-http";

export const runtime = "edge";

export function OPTIONS() {
  return oauthJson(null, 204);
}

export async function POST(request: Request) {
  const env = readMcpOAuthEnv();
  if (!env) {
    return oauthJson({ error: "temporarily_unavailable" }, 503);
  }

  const params = await readTokenParams(request);
  if (
    params.grant_type !== "authorization_code" ||
    !params.code ||
    !params.code_verifier ||
    !params.redirect_uri
  ) {
    return oauthJson({ error: "invalid_request" }, 400);
  }

  const consumed = await consumeAuthorizationCode(
    params.code,
    {
      clientId: params.client_id,
      redirectUri: params.redirect_uri,
      codeVerifier: params.code_verifier,
    },
    env.jwtSecret,
  );
  if (!consumed) {
    return oauthJson({ error: "invalid_grant" }, 400);
  }

  const accessToken = await issueAccessToken(
    { ok: true, email: consumed.email, scopes: consumed.scopes },
    env.jwtSecret,
  );
  return oauthJson({
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: MCP_ACCESS_TOKEN_TTL_SECONDS,
    scope: consumed.scopes.join(" "),
  });
}

async function readTokenParams(request: Request): Promise<{
  grant_type?: string;
  code?: string;
  code_verifier?: string;
  redirect_uri?: string;
  client_id?: string;
}> {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const json = (await request.json()) as Record<string, unknown>;
    return {
      grant_type: asString(json.grant_type),
      code: asString(json.code),
      code_verifier: asString(json.code_verifier),
      redirect_uri: asString(json.redirect_uri),
      client_id: asString(json.client_id),
    };
  }
  const form = await request.formData();
  return {
    grant_type: asString(form.get("grant_type")),
    code: asString(form.get("code")),
    code_verifier: asString(form.get("code_verifier")),
    redirect_uri: asString(form.get("redirect_uri")),
    client_id: asString(form.get("client_id")),
  };
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
