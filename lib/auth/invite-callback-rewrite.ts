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

/**
 * PKCE / token_hash 成功後に進むパス。ハッシュのみの招待は 302 せず HTML に渡すので null。
 */
export function authCallbackRedirectPath(input: {
  pathname: string;
  code: string | null;
  tokenHash: string | null;
  redirectTo: string | null;
}): string | null {
  if (!input.redirectTo) {
    return null;
  }
  if (shouldRewriteInviteAuthCallback(input)) {
    return null;
  }
  return input.redirectTo;
}
