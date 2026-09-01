import { shouldRewriteInviteAuthCallback } from "./invite-callback-rewrite";

describe("shouldRewriteInviteAuthCallback", () => {
  it("rewrites invite callbacks that only have a redirect_to", () => {
    expect(
      shouldRewriteInviteAuthCallback({
        pathname: "/auth/callback",
        code: null,
        tokenHash: null,
        redirectTo: "/invite/set-password",
      }),
    ).toBe(true);
  });

  it("does not rewrite PKCE or token_hash callbacks", () => {
    expect(
      shouldRewriteInviteAuthCallback({
        pathname: "/auth/callback",
        code: "abc",
        tokenHash: null,
        redirectTo: "/invite/set-password",
      }),
    ).toBe(false);
    expect(
      shouldRewriteInviteAuthCallback({
        pathname: "/auth/callback",
        code: null,
        tokenHash: "hash",
        redirectTo: "/invite/set-password",
      }),
    ).toBe(false);
  });

  it("does not rewrite callbacks without the invite redirect", () => {
    expect(
      shouldRewriteInviteAuthCallback({
        pathname: "/auth/callback",
        code: null,
        tokenHash: null,
        redirectTo: null,
      }),
    ).toBe(false);
  });
});
