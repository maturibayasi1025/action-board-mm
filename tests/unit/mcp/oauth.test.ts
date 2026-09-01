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
  it("allows Cursor and localhost redirects only", () => {
    expect(
      isAllowedOAuthRedirectUri("cursor://anysphere.cursor-mcp/oauth/callback"),
    ).toBe(true);
    expect(isAllowedOAuthRedirectUri("http://127.0.0.1:8734/callback")).toBe(
      true,
    );
    expect(isAllowedOAuthRedirectUri("https://evil.example/callback")).toBe(
      false,
    );
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
