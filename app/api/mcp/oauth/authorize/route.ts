import {
  googleAuthorizationUrl,
  isAllowedOAuthRedirectUri,
  readMcpOAuthEnv,
  signGoogleOAuthState,
} from "@/lib/mcp/oauth";
import { oauthErrorRedirect } from "@/lib/mcp/oauth-http";

export const runtime = "edge";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("mode");
  const redirectUri = url.searchParams.get("redirect_uri") ?? "";
  const state = url.searchParams.get("state") ?? "";
  const mcpClient =
    mode !== "connect" && isAllowedOAuthRedirectUri(redirectUri)
      ? { redirectUri, state }
      : undefined;

  const env = readMcpOAuthEnv();
  if (!env) {
    return oauthErrorRedirect("not_configured", mcpClient);
  }

  if (mode === "connect" || !url.searchParams.get("redirect_uri")) {
    const connectState = await signGoogleOAuthState(
      { mode: "connect", nonce: crypto.randomUUID() },
      env.jwtSecret,
    );
    return Response.redirect(googleAuthorizationUrl(env, connectState), 302);
  }

  const responseType = url.searchParams.get("response_type");
  const codeChallenge = url.searchParams.get("code_challenge") ?? "";
  const codeChallengeMethod = url.searchParams.get("code_challenge_method");
  const clientId = url.searchParams.get("client_id") ?? "public";

  if (
    responseType !== "code" ||
    codeChallengeMethod !== "S256" ||
    codeChallenge.length < 16 ||
    !mcpClient
  ) {
    return oauthErrorRedirect("invalid_request", mcpClient);
  }

  const googleState = await signGoogleOAuthState(
    {
      mode: "mcp",
      nonce: crypto.randomUUID(),
      clientId,
      redirectUri,
      state,
      codeChallenge,
      codeChallengeMethod: "S256",
    },
    env.jwtSecret,
  );
  return Response.redirect(googleAuthorizationUrl(env, googleState), 302);
}
