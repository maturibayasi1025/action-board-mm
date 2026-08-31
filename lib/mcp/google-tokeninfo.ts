import type { GoogleIdentity } from "@/lib/mcp/google-access";

type GoogleTokenInfo = {
  aud?: string;
  email?: string;
  email_verified?: boolean | string;
  hd?: string;
  exp?: string;
  error?: string;
};

export async function fetchGoogleIdentityFromIdToken(
  idToken: string,
  clientId: string,
  fetcher: typeof fetch = fetch,
): Promise<GoogleIdentity | null> {
  const url = new URL("https://oauth2.googleapis.com/tokeninfo");
  url.searchParams.set("id_token", idToken);
  const response = await fetcher(url.toString(), { method: "GET" });
  if (!response.ok) {
    return null;
  }
  const info = (await response.json()) as GoogleTokenInfo;
  if (info.error || info.aud !== clientId || !info.email) {
    return null;
  }
  const verified =
    info.email_verified === true || info.email_verified === "true";
  return {
    email: info.email,
    emailVerified: verified,
    hostedDomain: info.hd ?? null,
  };
}

export async function exchangeGoogleAuthorizationCode(
  code: string,
  options: {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    fetcher?: typeof fetch;
  },
): Promise<string | null> {
  const fetcher = options.fetcher ?? fetch;
  const body = new URLSearchParams({
    code,
    client_id: options.clientId,
    client_secret: options.clientSecret,
    redirect_uri: options.redirectUri,
    grant_type: "authorization_code",
  });
  const response = await fetcher("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!response.ok) {
    return null;
  }
  const json = (await response.json()) as { id_token?: string };
  return json.id_token ?? null;
}
