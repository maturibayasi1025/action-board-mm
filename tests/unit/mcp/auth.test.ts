/**
 * @jest-environment node
 */
import {
  authenticateMcpRequest,
  extractBearerToken,
  parseMcpApiKeys,
} from "@/lib/mcp/auth";

const KEYS = JSON.stringify([
  {
    id: "ops-public",
    secret: "public-secret",
    scopes: ["public"],
    label: "public",
  },
  {
    id: "owner-raw",
    secret: "raw-secret",
    scopes: ["public", "survey_raw"],
    label: "restricted",
  },
]);

describe("parseMcpApiKeys", () => {
  it("parses valid keys and drops unknown scopes", () => {
    const keys = parseMcpApiKeys(
      JSON.stringify([
        { id: "a", secret: "s", scopes: ["public", "not-a-scope"] },
      ]),
    );
    expect(keys).toEqual([
      { keyId: "a", secret: "s", scopes: ["public"], label: null, email: null },
    ]);
  });

  it("returns empty on invalid JSON", () => {
    expect(parseMcpApiKeys("{")).toEqual([]);
    expect(parseMcpApiKeys("")).toEqual([]);
    expect(parseMcpApiKeys('{"id":"x"}')).toEqual([]);
  });
});

describe("extractBearerToken", () => {
  it("reads Bearer tokens", () => {
    expect(extractBearerToken("Bearer abc")).toBe("abc");
    expect(extractBearerToken("bearer abc")).toBe("abc");
    expect(extractBearerToken("Token abc")).toBeNull();
    expect(extractBearerToken(null)).toBeNull();
  });
});

describe("authenticateMcpRequest", () => {
  it("accepts a matching secret and returns scopes", async () => {
    const principal = await authenticateMcpRequest(
      "Bearer public-secret",
      KEYS,
    );
    expect(principal).toEqual({
      keyId: "ops-public",
      scopes: ["public"],
      label: "public",
      email: null,
    });
  });

  it("rejects missing or unknown secrets", async () => {
    expect(await authenticateMcpRequest(null, KEYS)).toBeNull();
    expect(await authenticateMcpRequest("Bearer no-such", KEYS)).toBeNull();
    expect(
      await authenticateMcpRequest("Bearer public-secret", undefined),
    ).toBeNull();
  });
});
