/**
 * @jest-environment node
 */
import { authenticateMcpRequest } from "@/lib/mcp/auth";
import { sha256Base64Url, signHs256Jwt, verifyHs256Jwt } from "@/lib/mcp/jwt";
import {
  consumeAuthorizationCode,
  isAllowedOAuthRedirectUri,
  issueAccessToken,
  issueAuthorizationCode,
  issueRefreshToken,
  refreshGrantedAccess,
} from "@/lib/mcp/oauth";

describe("JWT", () => {
  it("signs and verifies HS256 tokens", async () => {
    const token = await signHs256Jwt(
      { hello: "world", exp: 4_000_000_000 },
      "s",
    );
    await expect(verifyHs256Jwt(token, "s")).resolves.toMatchObject({
      hello: "world",
    });
    await expect(verifyHs256Jwt(token, "other")).resolves.toBeNull();
  });

  it("rejects expired tokens", async () => {
    const token = await signHs256Jwt({ exp: 1 }, "s");
    await expect(verifyHs256Jwt(token, "s")).resolves.toBeNull();
  });
});

describe("OAuth helpers", () => {
  it("allows Cursor, Claude, ChatGPT, and localhost redirects", () => {
    expect(
      isAllowedOAuthRedirectUri("cursor://anysphere.cursor-mcp/oauth/callback"),
    ).toBe(true);
    expect(isAllowedOAuthRedirectUri("http://127.0.0.1:8734/callback")).toBe(
      true,
    );
    expect(
      isAllowedOAuthRedirectUri(
        "https://chatgpt.com/connector_platform_oauth_redirect",
      ),
    ).toBe(true);
    expect(
      isAllowedOAuthRedirectUri(
        "https://chatgpt.com/connector/oauth/callback-id-123",
      ),
    ).toBe(true);
    expect(
      isAllowedOAuthRedirectUri(
        "https://platform.openai.com/apps-manage/oauth",
      ),
    ).toBe(true);
    expect(
      isAllowedOAuthRedirectUri("https://claude.ai/api/mcp/auth_callback"),
    ).toBe(true);
    expect(isAllowedOAuthRedirectUri("https://evil.example/callback")).toBe(
      false,
    );
  });

  it("refreshes access from a refresh token and re-checks the allowlist", async () => {
    const refresh = await issueRefreshToken(
      {
        ok: true,
        email: "owner@maisonmarc.com",
        scopes: ["public"],
      },
      "jwt-secret",
    );
    const granted = await refreshGrantedAccess(
      refresh,
      "jwt-secret",
      JSON.stringify([
        {
          email: "owner@maisonmarc.com",
          scopes: ["public", "survey_agg"],
        },
      ]),
    );
    expect(granted).toEqual({
      ok: true,
      email: "owner@maisonmarc.com",
      scopes: ["public", "survey_agg"],
    });
    await expect(
      refreshGrantedAccess(refresh, "jwt-secret", "other@maisonmarc.com"),
    ).resolves.toBeNull();
    await expect(
      refreshGrantedAccess(refresh, "other-secret", "owner@maisonmarc.com"),
    ).resolves.toBeNull();
  });

  it("does not accept a refresh token as an MCP access token", async () => {
    const refresh = await issueRefreshToken(
      { ok: true, email: "owner@maisonmarc.com", scopes: ["public"] },
      "jwt-secret",
    );
    await expect(
      authenticateMcpRequest(`Bearer ${refresh}`, {
        rawKeys: "[]",
        jwtSecret: "jwt-secret",
      }),
    ).resolves.toBeNull();
  });

  it("round-trips PKCE authorization codes", async () => {
    const verifier = "abcdefghijklmnopqrstuvwxyz012345";
    const challenge = await sha256Base64Url(verifier);
    const code = await issueAuthorizationCode(
      { ok: true, email: "owner@maisonmarc.com", scopes: ["public"] },
      {
        clientId: "cursor",
        redirectUri: "cursor://anysphere.cursor-mcp/oauth/callback",
        codeChallenge: challenge,
      },
      "jwt-secret",
    );
    const consumed = await consumeAuthorizationCode(
      code,
      {
        clientId: "cursor",
        redirectUri: "cursor://anysphere.cursor-mcp/oauth/callback",
        codeVerifier: verifier,
      },
      "jwt-secret",
    );
    expect(consumed?.email).toBe("owner@maisonmarc.com");
    await expect(
      consumeAuthorizationCode(
        code,
        {
          clientId: "cursor",
          redirectUri: "cursor://anysphere.cursor-mcp/oauth/callback",
          codeVerifier: "wrong-verifier-0000000000000000",
        },
        "jwt-secret",
      ),
    ).resolves.toBeNull();
  });
});

describe("authenticateMcpRequest with Google JWT", () => {
  it("accepts a signed access token and exposes the email", async () => {
    const token = await issueAccessToken(
      { ok: true, email: "owner@maisonmarc.com", scopes: ["public"] },
      "jwt-secret",
    );
    const principal = await authenticateMcpRequest(`Bearer ${token}`, {
      rawKeys: "[]",
      jwtSecret: "jwt-secret",
    });
    expect(principal).toEqual({
      keyId: "google:owner@maisonmarc.com",
      scopes: ["public"],
      label: "owner@maisonmarc.com",
      email: "owner@maisonmarc.com",
    });
  });

  it("rejects a JWT signed with the wrong secret", async () => {
    const token = await issueAccessToken(
      { ok: true, email: "owner@maisonmarc.com", scopes: ["public"] },
      "jwt-secret",
    );
    await expect(
      authenticateMcpRequest(`Bearer ${token}`, {
        rawKeys: "[]",
        jwtSecret: "other-secret",
      }),
    ).resolves.toBeNull();
  });
});
