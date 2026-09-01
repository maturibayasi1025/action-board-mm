import { INVITE_SET_PASSWORD_PATH } from "@/lib/utils/invite-auth-user";

export const INVITE_CONTINUE_PATH = "/auth/invite-continue";

export function shouldRewriteInviteAuthCallback(input: {
  pathname: string;
  code: string | null;
  tokenHash: string | null;
  redirectTo: string | null;
}): boolean {
  return (
    input.pathname === "/auth/callback" &&
    !input.code &&
    !input.tokenHash &&
    input.redirectTo === INVITE_SET_PASSWORD_PATH
  );
}
