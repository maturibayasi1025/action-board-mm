import {
  EXISTING_AUTH_INVITE_MESSAGES,
  USER_INVITATIONS_MISSING_TABLE_MESSAGE,
  canDeleteUnusedInviteAuthUser,
  decideExistingAuthInvite,
  decideInviteSetPasswordAccess,
  isMissingUserInvitationsRelation,
  normalizeInviteEmail,
  userInvitationsQueryErrorMessage,
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

describe("isMissingUserInvitationsRelation", () => {
  it("detects Postgres undefined-table errors", () => {
    expect(
      isMissingUserInvitationsRelation({
        code: "42P01",
        message: 'relation "public.user_invitations" does not exist',
      }),
    ).toBe(true);
  });

  it("detects PostgREST schema-cache misses", () => {
    expect(
      isMissingUserInvitationsRelation({
        code: "PGRST205",
        message:
          "Could not find the table 'public.user_invitations' in the schema cache",
      }),
    ).toBe(true);
  });

  it("does not treat other errors as a missing table", () => {
    expect(
      isMissingUserInvitationsRelation({
        code: "23505",
        message: "duplicate key value violates unique constraint",
      }),
    ).toBe(false);
  });
});

describe("userInvitationsQueryErrorMessage", () => {
  it("returns the migration instruction for a missing table", () => {
    expect(
      userInvitationsQueryErrorMessage(
        { code: "42P01", message: "does not exist" },
        "招待の保存に失敗しました",
      ),
    ).toBe(USER_INVITATIONS_MISSING_TABLE_MESSAGE);
  });
});

describe("decideInviteSetPasswordAccess", () => {
  it("allows password setup when the logged-in user has a pending invite", () => {
    expect(
      decideInviteSetPasswordAccess({
        hasUser: true,
        hasPendingInvitation: true,
      }),
    ).toBe("can_set_password");
  });

  it("treats a logged-in user without a pending invite as the wrong account", () => {
    expect(
      decideInviteSetPasswordAccess({
        hasUser: true,
        hasPendingInvitation: false,
      }),
    ).toBe("wrong_account");
  });

  it("treats a missing session as an invalid link", () => {
    expect(
      decideInviteSetPasswordAccess({
        hasUser: false,
        hasPendingInvitation: false,
      }),
    ).toBe("invalid_link");
  });
});
