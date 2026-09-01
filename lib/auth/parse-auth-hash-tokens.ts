export function parseAuthHashTokens(hash: string): {
  access_token: string;
  refresh_token: string;
} | null {
  const trimmed = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!trimmed) {
    return null;
  }
  const params = new URLSearchParams(trimmed);
  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  if (!accessToken || !refreshToken) {
    return null;
  }
  return {
    access_token: accessToken,
    refresh_token: refreshToken,
  };
}

export function parseAuthCallbackTokens(hash: string, search: string) {
  return parseAuthHashTokens(hash) ?? parseAuthHashTokens(search);
}
