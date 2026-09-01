import { parseAuthHashTokens } from "./parse-auth-hash-tokens";

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
