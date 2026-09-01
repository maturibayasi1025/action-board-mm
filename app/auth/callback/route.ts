import { parseEmailOtpType } from "@/lib/auth/email-otp-type";
import { createClient } from "@/lib/supabase/server";
import { INVITE_SET_PASSWORD_PATH } from "@/lib/utils/invite-auth-user";
import { NextResponse } from "next/server";

export const runtime = "edge";

export async function GET(request: Request) {
  // The `/auth/callback` route is required for the server-side auth flow implemented
  // by the SSR package. It exchanges an auth code for the user's session.
  // https://supabase.com/docs/guides/auth/server-side/nextjs
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const otpType = parseEmailOtpType(requestUrl.searchParams.get("type"));
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? requestUrl.origin;
  const redirectTo = requestUrl.searchParams.get("redirect_to")?.toString();
  const isInviteFlow =
    redirectTo === INVITE_SET_PASSWORD_PATH || otpType === "invite";

  const supabase = await createClient();

  // 経営者がログインしたまま招待リンクを開くと、招待先ではなく経営者セッションのまま進む
  if (isInviteFlow) {
    await supabase.auth.signOut({ scope: "local" });
  }

  if (tokenHash && otpType) {
    const { error } = await supabase.auth.verifyOtp({
      type: otpType,
      token_hash: tokenHash,
    });
    if (error && isInviteFlow) {
      return NextResponse.redirect(`${origin}${INVITE_SET_PASSWORD_PATH}`);
    }
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      // PKCE Code Verifier エラーの場合、redirect_to別に適切な画面にリダイレクト
      if (
        error.message?.includes("code verifier") ||
        error.code === "validation_failed"
      ) {
        if (redirectTo === "/reset-password") {
          const resetUrl = `${origin}/reset-password`;
          return NextResponse.redirect(resetUrl);
        }
        if (redirectTo === INVITE_SET_PASSWORD_PATH) {
          return NextResponse.redirect(`${origin}${INVITE_SET_PASSWORD_PATH}`);
        }

        const loginUrl = `${origin}/sign-in?success=${encodeURIComponent("メール認証が完了しました。ログインしてください。")}`;
        return NextResponse.redirect(loginUrl);
      }
    }
  } else if (isInviteFlow) {
    // デフォルト招待メールはトークンを URL ハッシュに付ける。サーバーには届かないので
    // HTML を返してブラウザ側でハッシュをパスワード設定画面へ持ち込む。
    const nextUrl = `${origin}${INVITE_SET_PASSWORD_PATH}`;
    return new NextResponse(
      `<!DOCTYPE html><html lang="ja"><head><meta charset="utf-8"><title>招待を確認しています</title></head><body><p>招待を確認しています…</p><script>
(function () {
  var next = ${JSON.stringify(nextUrl)};
  var hash = window.location.hash || "";
  window.location.replace(hash.indexOf("access_token") >= 0 ? next + hash : next);
})();
</script></body></html>`,
      {
        headers: {
          "content-type": "text/html; charset=utf-8",
          "cache-control": "no-store",
        },
      },
    );
  }

  if (redirectTo) {
    return NextResponse.redirect(`${origin}${redirectTo}`);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: privateUser } = await supabase
      .from("private_users")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();
    if (!privateUser) {
      return NextResponse.redirect(`${origin}/settings/profile?new=true`);
    }
  }

  return NextResponse.redirect(`${origin}/`);
}
