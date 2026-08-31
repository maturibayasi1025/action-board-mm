export function normalizeInviteEmail(email: string): string {
  return email.trim().toLowerCase();
}

export type ExistingAuthInviteDecision =
  | "already_registered"
  | "pending_invite"
  | "unfinished_account";

export const EXISTING_AUTH_INVITE_MESSAGES = {
  already_registered: "このメールアドレスは既に登録されています",
  pending_invite:
    "このメールアドレスには未完了の招待があります。再送してください。",
  unfinished_account:
    "このメールアドレスには、プロフィール未完了のアカウントがあります。招待ではなく、本人にログインまたはパスワード再設定を案内してください。",
} as const satisfies Record<ExistingAuthInviteDecision, string>;

/**
 * 既存 Auth ユーザーがいる場合は新規招待を作らない。
 * プロフィール未完了の自己登録・招待受け入れ途中アカウントは削除対象にしない。
 */
export function decideExistingAuthInvite(input: {
  hasProfile: boolean;
  hasPendingInvite: boolean;
}): ExistingAuthInviteDecision {
  if (input.hasProfile) {
    return "already_registered";
  }
  if (input.hasPendingInvite) {
    return "pending_invite";
  }
  return "unfinished_account";
}

/**
 * 招待で作った Auth ユーザーは、プロフィール未作成なら再送・取消で削除してよい。
 * 招待リンクのクリックで last_sign_in_at が付いても、パスワード未設定のままなので消してよい。
 */
export function canDeleteUnusedInviteAuthUser(input: {
  hasProfile: boolean;
}): boolean {
  return !input.hasProfile;
}
