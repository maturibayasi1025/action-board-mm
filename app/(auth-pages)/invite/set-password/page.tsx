import { InviteAuthHashBootstrap } from "@/components/auth/invite-auth-hash-bootstrap";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { signOutAction } from "@/lib/actions";
import { findPendingInvitation } from "@/lib/services/user-invitations";
import { createClient } from "@/lib/supabase/server";
import { decideInviteSetPasswordAccess } from "@/lib/utils/invite-auth-user";
import Image from "next/image";
import Link from "next/link";
import InviteSetPasswordForm from "./InviteSetPasswordForm";

export const runtime = "edge";

export default async function InviteSetPasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const pendingInvitation = user
    ? await findPendingInvitation({
        authUserId: user.id,
        email: user.email,
      })
    : null;
  const access = decideInviteSetPasswordAccess({
    hasUser: Boolean(user),
    hasPendingInvitation: Boolean(pendingInvitation),
  });

  return (
    <div className="flex-1 flex flex-col min-w-72">
      <div className="flex justify-center items-center m-4">
        <Image
          src="/img/MMHD_symbol.png"
          alt="MMHD_symbol"
          width={114}
          height={96}
        />
      </div>
      <div className="flex justify-center">
        <InviteAuthHashBootstrap>
          {renderInviteAccess(access)}
        </InviteAuthHashBootstrap>
      </div>
    </div>
  );
}

function renderInviteAccess(
  access: ReturnType<typeof decideInviteSetPasswordAccess>,
) {
  switch (access) {
    case "can_set_password":
      return <InviteSetPasswordForm />;
    case "wrong_account":
      return (
        <div className="flex flex-col items-center gap-4 min-w-72 max-w-72">
          <h1 className="text-2xl font-medium text-center">
            別のアカウントでログインしています
          </h1>
          <FormMessage
            message={{
              error:
                "招待を受け取るには、一度ログアウトしてから招待メールのリンクを開き直してください。シークレットウィンドウを使うと確実です。",
            }}
          />
          <form action={signOutAction}>
            <SubmitButton pendingText="ログアウト中...">
              ログアウトする
            </SubmitButton>
          </form>
        </div>
      );
    case "invalid_link":
      return (
        <div className="flex flex-col items-center gap-4 min-w-72 max-w-72">
          <h1 className="text-2xl font-medium text-center">
            招待リンクが無効です
          </h1>
          <FormMessage
            message={{
              error:
                "招待リンクの有効期限が切れているか、すでに使用されています。経営者に再送を依頼し、ログインしていない状態で新しいメールのリンクを開いてください。",
            }}
          />
          <Link className="text-primary underline" href="/sign-in">
            ログイン画面へ
          </Link>
        </div>
      );
    default: {
      const _exhaustive: never = access;
      return _exhaustive;
    }
  }
}
