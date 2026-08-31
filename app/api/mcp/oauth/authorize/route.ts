import {
  googleAuthorizationUrl,
  isAllowedOAuthRedirectUri,
  readMcpOAuthEnv,
  signGoogleOAuthState,
} from "@/lib/mcp/oauth";
import { oauthErrorRedirect } from "@/lib/mcp/oauth-http";

export const runtime = "edge";

export async function GET(request: Request) {
  const env = readMcpOAuthEnv();
  if (!env) {
    return oauthErrorRedirect("not_configured");
  }

  const url = new URL(request.url);
  const mode = url.searchParams.get("mode");
  if (mode === "connect" || !url.searchParams.get("redirect_uri")) {
    const state = await signGoogleOAuthState(
      { mode: "connect", nonce: crypto.randomUUID() },
      env.jwtSecret,
    );
    return Response.redirect(googleAuthorizationUrl(env, state), 302);
  }

  const responseType = url.searchParams.get("response_type");
  const redirectUri = url.searchParams.get("redirect_uri") ?? "";
  const codeChallenge = url.searchParams.get("code_challenge") ?? "";
  const codeChallengeMethod = url.searchParams.get("code_challenge_method");
  const clientId = url.searchParams.get("client_id") ?? "public";
  const state = url.searchParams.get("state") ?? "";

  if (
    responseType !== "code" ||
    codeChallengeMethod !== "S256" ||
    codeChallenge.length < 16 ||
    !isAllowedOAuthRedirectUri(redirectUri)
  ) {
    return oauthErrorRedirect("invalid_request");
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
