import { INVITE_CONTINUE_PATH } from "./invite-callback-rewrite";
import {
  INVITE_HASH_BOOTSTRAP_SCRIPT_PATH,
  inviteContinueDestination,
  inviteHashFallbackHtml,
} from "./invite-hash-fallback";

describe("inviteContinueDestination", () => {
  it("keeps search and hash so implicit tokens survive", () => {
    expect(
      inviteContinueDestination(
        "?redirect_to=/invite/set-password",
        "#access_token=aaa&refresh_token=bbb",
      ),
    ).toBe(
      `${INVITE_CONTINUE_PATH}?redirect_to=/invite/set-password#access_token=aaa&refresh_token=bbb`,
    );
  });
});

describe("inviteHashFallbackHtml", () => {
  it("loads an external script instead of redirecting", () => {
    const html = inviteHashFallbackHtml();
    expect(html).toContain(`src="${INVITE_HASH_BOOTSTRAP_SCRIPT_PATH}"`);
    expect(html).not.toContain("location.replace");
  });
});
