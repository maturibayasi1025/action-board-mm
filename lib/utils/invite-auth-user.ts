export const INVITE_SET_PASSWORD_PATH = "/invite/set-password";

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

export const USER_INVITATIONS_MISSING_TABLE_MESSAGE =
  "招待テーブルが未作成です。Supabase にマイグレーション 20260830000000_add_user_invitations.sql を適用してください（supabase db push）。";

type PostgrestLikeError = {
  code?: string | null;
  message?: string | null;
};

/**
 * user_invitations が未作成、または PostgREST のスキーマキャッシュに無いときの判定。
 */
export function isMissingUserInvitationsRelation(
  error: PostgrestLikeError | null | undefined,
): boolean {
  if (!error) {
    return false;
  }
  const code = error.code ?? "";
  if (code === "42P01" || code === "PGRST205") {
    return true;
  }
  const message = (error.message ?? "").toLowerCase();
  return (
    message.includes("user_invitations") &&
    (message.includes("does not exist") ||
      message.includes("could not find the table") ||
      message.includes("schema cache"))
  );
}

export function userInvitationsQueryErrorMessage(
  error: PostgrestLikeError | null | undefined,
  fallback: string,
): string {
  if (isMissingUserInvitationsRelation(error)) {
    return USER_INVITATIONS_MISSING_TABLE_MESSAGE;
  }
  return fallback;
}

export type InviteSetPasswordAccess =
  | "can_set_password"
  | "wrong_account"
  | "invalid_link";

/**
 * 招待パスワード設定画面を出せるか。経営者のままリンクを開くと wrong_account になる。
 */
export function decideInviteSetPasswordAccess(input: {
  hasUser: boolean;
  hasPendingInvitation: boolean;
}): InviteSetPasswordAccess {
  if (input.hasUser && input.hasPendingInvitation) {
    return "can_set_password";
  }
  if (input.hasUser) {
    return "wrong_account";
  }
  return "invalid_link";
}
