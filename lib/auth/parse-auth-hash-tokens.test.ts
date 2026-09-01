import {
  parseAuthCallbackTokens,
  parseAuthHashTokens,
} from "./parse-auth-hash-tokens";

describe("parseAuthHashTokens", () => {
  it("reads access and refresh tokens from a hash fragment", () => {
    expect(
      parseAuthHashTokens(
        "#access_token=aaa&refresh_token=bbb&type=invite&expires_in=3600",
      ),
    ).toEqual({
      access_token: "aaa",
      refresh_token: "bbb",
    });
  });

  it("returns null when tokens are missing", () => {
    expect(parseAuthHashTokens("#type=invite")).toBeNull();
    expect(parseAuthHashTokens("")).toBeNull();
  });
});

describe("parseAuthCallbackTokens", () => {
  it("falls back to query string tokens", () => {
    expect(
      parseAuthCallbackTokens(
        "",
        "?access_token=aaa&refresh_token=bbb&type=invite",
      ),
    ).toEqual({
      access_token: "aaa",
      refresh_token: "bbb",
    });
  });

  it("prefers hash tokens over query string tokens", () => {
    expect(
      parseAuthCallbackTokens(
        "#access_token=from-hash&refresh_token=hash-refresh",
        "?access_token=from-query&refresh_token=query-refresh",
      ),
    ).toEqual({
      access_token: "from-hash",
      refresh_token: "hash-refresh",
    });
  });
});
