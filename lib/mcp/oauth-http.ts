import { getSiteUrl } from "@/lib/env";
import { isAllowedOAuthRedirectUri, mcpIssuer } from "@/lib/mcp/oauth";

export const OAUTH_CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, Accept",
};

export function oauthJson(body: unknown, status = 200): Response {
  if (status === 204) {
    return new Response(null, { status, headers: OAUTH_CORS_HEADERS });
  }
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...OAUTH_CORS_HEADERS,
    },
  });
}

export function oauthErrorRedirect(
  reason: string,
  client?: { redirectUri: string; state?: string },
): Response {
  if (client && isAllowedOAuthRedirectUri(client.redirectUri)) {
    const url = new URL(client.redirectUri);
    url.searchParams.set("error", reason);
    if (client.state) {
      url.searchParams.set("state", client.state);
    }
    url.searchParams.set("iss", mcpIssuer());
    return Response.redirect(url.toString(), 302);
  }
  const url = new URL("/mcp/connect", `${getSiteUrl()}/`);
  url.searchParams.set("error", reason);
  return Response.redirect(url.toString(), 302);
}

export const CONNECT_ERROR_MESSAGES: Record<string, string> = {
  unverified: "Google のメールが未確認です。",
  wrong_domain: "maisonmarc.com の Google アカウントでログインしてください。",
  missing_hd: "Google Workspace（会社アカウント）でログインしてください。",
  allowlist_empty: "許可リストが未設定のため、接続できません。",
  not_allowlisted: "この Google アカウントは MCP の許可リストにありません。",
  google_token: "Google との認証に失敗しました。",
  google_identity: "Google の身分情報を確認できませんでした。",
  oauth: "認証の開始に失敗しました。設定を確認してください。",
  invalid_request: "OAuth のリクエストが不正です。",
  not_configured: "Google ログインの設定がまだありません。",
};
