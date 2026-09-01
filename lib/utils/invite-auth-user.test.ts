import {
  EXISTING_AUTH_INVITE_MESSAGES,
  canDeleteUnusedInviteAuthUser,
  decideExistingAuthInvite,
  normalizeInviteEmail,
} from "./invite-auth-user";

describe("normalizeInviteEmail", () => {
  it("lowercases and trims without treating underscore as a wildcard", () => {
    expect(normalizeInviteEmail("  First_Last@Company.com  ")).toBe(
      "first_last@company.com",
    );
  });
});

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
  it("allows deleting an invite Auth user without a profile", () => {
    expect(canDeleteUnusedInviteAuthUser({ hasProfile: false })).toBe(true);
  });

  it("does not delete a user who already has a profile", () => {
    expect(canDeleteUnusedInviteAuthUser({ hasProfile: true })).toBe(false);
  });
});
