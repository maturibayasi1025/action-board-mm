import {
  EXISTING_AUTH_INVITE_MESSAGES,
  canDeleteUnusedInviteAuthUser,
  decideExistingAuthInvite,
} from "./invite-auth-user";

describe("decideExistingAuthInvite", () => {
  it("does not invite or delete a registered profile", () => {
    expect(
      decideExistingAuthInvite({ hasProfile: true, hasPendingInvite: false }),
    ).toBe("already_registered");
  });

  it("does not invite or delete when a pending invite already exists", () => {
    expect(
      decideExistingAuthInvite({ hasProfile: false, hasPendingInvite: true }),
    ).toBe("pending_invite");
  });

  it("does not delete an unfinished account without a pending invite", () => {
    expect(
      decideExistingAuthInvite({ hasProfile: false, hasPendingInvite: false }),
    ).toBe("unfinished_account");
    expect(EXISTING_AUTH_INVITE_MESSAGES.unfinished_account).toMatch(
      /プロフィール未完了/,
    );
  });
});

describe("canDeleteUnusedInviteAuthUser", () => {
  it("allows deleting an unused invite Auth user", () => {
    expect(
      canDeleteUnusedInviteAuthUser({
        hasProfile: false,
        lastSignInAt: null,
      }),
    ).toBe(true);
  });

  it("does not delete after the invitee has signed in", () => {
    expect(
      canDeleteUnusedInviteAuthUser({
        hasProfile: false,
        lastSignInAt: "2026-08-30T00:00:00Z",
      }),
    ).toBe(false);
  });

  it("does not delete a user who already has a profile", () => {
    expect(
      canDeleteUnusedInviteAuthUser({
        hasProfile: true,
        lastSignInAt: null,
      }),
    ).toBe(false);
  });
});
