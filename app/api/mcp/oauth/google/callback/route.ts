import { getSiteUrl } from "@/lib/env";
import {
  MCP_ISSUED_COOKIE,
  grantFromGoogleCode,
  issueAccessToken,
  issueAuthorizationCode,
  mcpIssuer,
  readGoogleOAuthState,
  readMcpOAuthEnv,
} from "@/lib/mcp/oauth";
import { oauthErrorRedirect } from "@/lib/mcp/oauth-http";

export const runtime = "edge";

export async function GET(request: Request) {
  const env = readMcpOAuthEnv();
  if (!env) {
    return oauthErrorRedirect("not_configured");
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const stateToken = url.searchParams.get("state");
  const googleError = url.searchParams.get("error");
  const state = stateToken
    ? await readGoogleOAuthState(stateToken, env.jwtSecret)
    : null;
  const mcpClient =
    state?.mode === "mcp"
      ? { redirectUri: state.redirectUri, state: state.state }
      : undefined;

  if (googleError || !code || !stateToken) {
    return oauthErrorRedirect("google_token", mcpClient);
  }

  if (!state) {
    return oauthErrorRedirect("invalid_request");
  }

  const granted = await grantFromGoogleCode(code, env);
  if (!granted.ok) {
    return oauthErrorRedirect(granted.reason, mcpClient);
  }

  if (state.mode === "connect") {
    const accessToken = await issueAccessToken(granted, env.jwtSecret);
    const connectUrl = new URL("/mcp/connect", `${getSiteUrl()}/`);
    connectUrl.searchParams.set("ok", "1");
    const response = new Response(null, {
      status: 302,
      headers: { Location: connectUrl.toString() },
    });
    const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
    response.headers.append(
      "Set-Cookie",
      `${MCP_ISSUED_COOKIE}=${accessToken}; Path=/mcp/connect; HttpOnly; SameSite=Lax; Max-Age=300${secure}`,
    );
    return response;
  }

  const authCode = await issueAuthorizationCode(
    granted,
    {
      clientId: state.clientId,
      redirectUri: state.redirectUri,
      codeChallenge: state.codeChallenge,
    },
    env.jwtSecret,
  );
  const redirect = new URL(state.redirectUri);
  redirect.searchParams.set("code", authCode);
  if (state.state) {
    redirect.searchParams.set("state", state.state);
  }
  redirect.searchParams.set("iss", mcpIssuer());
  return Response.redirect(redirect.toString(), 302);
}
