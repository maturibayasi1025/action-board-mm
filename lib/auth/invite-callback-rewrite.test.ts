import {
  authCallbackRedirectPath,
  shouldRewriteInviteAuthCallback,
} from "./invite-callback-rewrite";

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

describe("authCallbackRedirectPath", () => {
  it("sends PKCE and token_hash invites to password setup", () => {
    expect(
      authCallbackRedirectPath({
        pathname: "/auth/callback",
        code: "abc",
        tokenHash: null,
        redirectTo: "/invite/set-password",
      }),
    ).toBe("/invite/set-password");
    expect(
      authCallbackRedirectPath({
        pathname: "/auth/callback",
        code: null,
        tokenHash: "hash",
        redirectTo: "/invite/set-password",
      }),
    ).toBe("/invite/set-password");
  });

  it("does not 302 hash-only invite callbacks", () => {
    expect(
      authCallbackRedirectPath({
        pathname: "/auth/callback",
        code: null,
        tokenHash: null,
        redirectTo: "/invite/set-password",
      }),
    ).toBeNull();
  });
});
