import { redirect } from "next/navigation";

/**
 * 未ログイン時に `/sign-in` へ送り、`returnUrl` でログイン後に元のパスへ戻す。
 * `SignInForm` → `signInActionWithState` → `validateReturnUrl` と連携する。
 */
export function redirectToSignInWithReturnPath(returnPath: string): never {
  const path = returnPath.trim();
  if (!path.startsWith("/")) {
    redirect("/sign-in");
  }
  redirect(`/sign-in?returnUrl=${encodeURIComponent(path)}`);
}
