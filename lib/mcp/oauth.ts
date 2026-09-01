import { getSiteUrl } from "@/lib/env";
import {
  type GoogleAccessOk,
  evaluateGoogleAccess,
  parseAllowedGoogleDomain,
  parseAllowedGoogleEmails,
} from "@/lib/mcp/google-access";
import {
  exchangeGoogleAuthorizationCode,
  fetchGoogleIdentityFromIdToken,
} from "@/lib/mcp/google-tokeninfo";
import { sha256Base64Url, signHs256Jwt, verifyHs256Jwt } from "@/lib/mcp/jwt";
import type { McpScope } from "@/lib/mcp/scopes";

export const MCP_ACCESS_TOKEN_TTL_SECONDS = 8 * 60 * 60;
export const MCP_REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;
export const MCP_AUTH_CODE_TTL_SECONDS = 5 * 60;
export const MCP_OAUTH_STATE_TTL_SECONDS = 10 * 60;

export const ALLOWED_OAUTH_HTTPS_HOSTS = [
  "cursor.com",
  "www.cursor.com",
  "claude.ai",
  "chatgpt.com",
  "www.chatgpt.com",
  "chat.openai.com",
  "platform.openai.com",
] as const;

export const MCP_ISSUED_COOKIE = "mcp_issued_token";

export function mcpIssuer(): string {
  return getSiteUrl().replace(/\/$/, "");
}

export function mcpResourceUrl(): string {
  return `${mcpIssuer()}/api/mcp`;
}

export function mcpGoogleCallbackUrl(): string {
  return `${mcpIssuer()}/api/mcp/oauth/google/callback`;
}

export function mcpProtectedResourceMetadataUrl(): string {
  return `${mcpIssuer()}/.well-known/oauth-protected-resource`;
}

export type McpOAuthEnv = {
  jwtSecret: string;
  googleClientId: string;
  googleClientSecret: string;
  domain: string;
  allowlistRaw: string | undefined;
};

export function readMcpOAuthEnv(
  env: NodeJS.ProcessEnv = process.env,
): McpOAuthEnv | null {
  const jwtSecret = env.MCP_JWT_SECRET?.trim();
  const googleClientId = env.MCP_GOOGLE_CLIENT_ID?.trim();
  const googleClientSecret = env.MCP_GOOGLE_CLIENT_SECRET?.trim();
  if (!jwtSecret || !googleClientId || !googleClientSecret) {
    return null;
  }
  return {
    jwtSecret,
    googleClientId,
    googleClientSecret,
    domain: parseAllowedGoogleDomain(env.MCP_ALLOWED_GOOGLE_DOMAIN),
    allowlistRaw: env.MCP_ALLOWED_GOOGLE_EMAILS,
  };
}

export function isAllowedOAuthRedirectUri(uri: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(uri);
  } catch {
    return false;
  }
  if (parsed.protocol === "cursor:" || parsed.protocol === "vscode:") {
    return true;
  }
  if (
    parsed.protocol === "http:" &&
    (parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost")
  ) {
    return true;
  }
  if (parsed.protocol === "https:") {
    return (ALLOWED_OAUTH_HTTPS_HOSTS as readonly string[]).includes(
      parsed.hostname,
    );
  }
  return false;
}

export type GoogleOAuthState =
  | {
      typ: "mcp_google_state";
      mode: "connect";
      nonce: string;
      exp: number;
    }
  | {
      typ: "mcp_google_state";
      mode: "mcp";
      nonce: string;
      exp: number;
      clientId: string;
      redirectUri: string;
      state: string;
      codeChallenge: string;
      codeChallengeMethod: "S256";
    };

export type McpAuthCodePayload = {
  typ: "mcp_code";
  email: string;
  scopes: McpScope[];
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  exp: number;
};

export type McpAccessTokenPayload = {
  typ: "mcp_at";
  sub: string;
  email: string;
  scopes: McpScope[];
  iss: string;
  aud: "action-board-mcp";
  iat: number;
  exp: number;
};

export type McpRefreshTokenPayload = {
  typ: "mcp_rt";
  sub: string;
  email: string;
  scopes: McpScope[];
  iss: string;
  aud: "action-board-mcp";
  iat: number;
  exp: number;
};

export type McpTokenPair = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  scopes: McpScope[];
};

export function googleAuthorizationUrl(
  env: McpOAuthEnv,
  state: string,
): string {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", env.googleClientId);
  url.searchParams.set("redirect_uri", mcpGoogleCallbackUrl());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email");
  url.searchParams.set("hd", env.domain);
  url.searchParams.set("prompt", "select_account");
  url.searchParams.set("state", state);
  return url.toString();
}

export async function signGoogleOAuthState(
  state:
    | { mode: "connect"; nonce: string }
    | {
        mode: "mcp";
        nonce: string;
        clientId: string;
        redirectUri: string;
        state: string;
        codeChallenge: string;
        codeChallengeMethod: "S256";
      },
  secret: string,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return signHs256Jwt(
    {
      ...state,
      typ: "mcp_google_state",
      exp: now + MCP_OAUTH_STATE_TTL_SECONDS,
    },
    secret,
  );
}

export async function readGoogleOAuthState(
  token: string,
  secret: string,
): Promise<GoogleOAuthState | null> {
  const payload = await verifyHs256Jwt<GoogleOAuthState>(token, secret);
  if (!payload || payload.typ !== "mcp_google_state") {
    return null;
  }
  return payload;
}

export async function issueAccessToken(
  granted: GoogleAccessOk,
  secret: string,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload: McpAccessTokenPayload = {
    typ: "mcp_at",
    sub: granted.email,
    email: granted.email,
    scopes: granted.scopes,
    iss: mcpIssuer(),
    aud: "action-board-mcp",
    iat: now,
    exp: now + MCP_ACCESS_TOKEN_TTL_SECONDS,
  };
  return signHs256Jwt(payload, secret);
}

export async function issueRefreshToken(
  granted: GoogleAccessOk,
  secret: string,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload: McpRefreshTokenPayload = {
    typ: "mcp_rt",
    sub: granted.email,
    email: granted.email,
    scopes: granted.scopes,
    iss: mcpIssuer(),
    aud: "action-board-mcp",
    iat: now,
    exp: now + MCP_REFRESH_TOKEN_TTL_SECONDS,
  };
  return signHs256Jwt(payload, secret);
}

export async function issueTokenPair(
  granted: GoogleAccessOk,
  secret: string,
): Promise<McpTokenPair> {
  return {
    accessToken: await issueAccessToken(granted, secret),
    refreshToken: await issueRefreshToken(granted, secret),
    expiresIn: MCP_ACCESS_TOKEN_TTL_SECONDS,
    scopes: granted.scopes,
  };
}

export async function refreshGrantedAccess(
  refreshToken: string,
  secret: string,
  allowlistRaw: string | undefined,
): Promise<GoogleAccessOk | null> {
  const payload = await verifyHs256Jwt<McpRefreshTokenPayload>(
    refreshToken,
    secret,
  );
  if (!payload || payload.typ !== "mcp_rt" || !payload.email) {
    return null;
  }
  const entry = parseAllowedGoogleEmails(allowlistRaw).find(
    (item) => item.email === payload.email,
  );
  if (!entry) {
    return null;
  }
  return { ok: true, email: payload.email, scopes: entry.scopes };
}

export async function issueAuthorizationCode(
  granted: GoogleAccessOk,
  params: {
    clientId: string;
    redirectUri: string;
    codeChallenge: string;
  },
  secret: string,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload: McpAuthCodePayload = {
    typ: "mcp_code",
    email: granted.email,
    scopes: granted.scopes,
    clientId: params.clientId,
    redirectUri: params.redirectUri,
    codeChallenge: params.codeChallenge,
    exp: now + MCP_AUTH_CODE_TTL_SECONDS,
  };
  return signHs256Jwt(payload, secret);
}

export async function consumeAuthorizationCode(
  code: string,
  params: {
    clientId?: string;
    redirectUri: string;
    codeVerifier: string;
  },
  secret: string,
): Promise<McpAuthCodePayload | null> {
  const payload = await verifyHs256Jwt<McpAuthCodePayload>(code, secret);
  if (!payload || payload.typ !== "mcp_code") {
    return null;
  }
  if (payload.redirectUri !== params.redirectUri) {
    return null;
  }
  if (params.clientId && payload.clientId !== params.clientId) {
    return null;
  }
  const challenge = await sha256Base64Url(params.codeVerifier);
  if (challenge !== payload.codeChallenge) {
    return null;
  }
  return payload;
}

export async function grantFromGoogleCode(
  code: string,
  env: McpOAuthEnv,
  fetcher: typeof fetch = fetch,
): Promise<GoogleAccessOk | { ok: false; reason: string }> {
  const idToken = await exchangeGoogleAuthorizationCode(code, {
    clientId: env.googleClientId,
    clientSecret: env.googleClientSecret,
    redirectUri: mcpGoogleCallbackUrl(),
    fetcher,
  });
  if (!idToken) {
    return { ok: false, reason: "google_token" };
  }
  const identity = await fetchGoogleIdentityFromIdToken(
    idToken,
    env.googleClientId,
    fetcher,
  );
  if (!identity) {
    return { ok: false, reason: "google_identity" };
  }
  const decision = evaluateGoogleAccess(identity, {
    domain: env.domain,
    allowlist: parseAllowedGoogleEmails(env.allowlistRaw),
  });
  if (!decision.ok) {
    return decision;
  }
  return decision;
}
