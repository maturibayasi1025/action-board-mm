import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const runtime = "edge";

export async function GET(request: Request) {
  // The `/auth/callback` route is required for the server-side auth flow implemented
  // by the SSR package. It exchanges an auth code for the user's session.
  // https://supabase.com/docs/guides/auth/server-side/nextjs
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? requestUrl.origin;
  const redirectTo = requestUrl.searchParams.get("redirect_to")?.toString();

  if (code) {
    const supabase = await createClient();
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
        if (redirectTo === "/invite/set-password") {
          return NextResponse.redirect(`${origin}/invite/set-password`);
        }

        const loginUrl = `${origin}/sign-in?success=${encodeURIComponent("メール認証が完了しました。ログインしてください。")}`;
        return NextResponse.redirect(loginUrl);
      }
    }
  }

  if (redirectTo) {
    return NextResponse.redirect(`${origin}${redirectTo}`);
  }

  const supabase = await createClient();
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
