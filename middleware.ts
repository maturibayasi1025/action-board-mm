import {
  INVITE_CONTINUE_PATH,
  shouldRewriteInviteAuthCallback,
} from "@/lib/auth/invite-callback-rewrite";
import { updateSession } from "@/lib/supabase/middleware";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export async function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  if (
    shouldRewriteInviteAuthCallback({
      pathname,
      code: searchParams.get("code"),
      tokenHash: searchParams.get("token_hash"),
      redirectTo: searchParams.get("redirect_to"),
    })
  ) {
    const rewriteUrl = request.nextUrl.clone();
    rewriteUrl.pathname = INVITE_CONTINUE_PATH;
    return NextResponse.rewrite(rewriteUrl);
  }

  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - sw.js / manifest.webmanifest / offline.html / icons (PWA 静的アセット)
     * - images - .svg, .png, .jpg, .jpeg, .gif, .webp
     * Feel free to modify this pattern to include more paths.
     */
    "/((?!_next/static|_next/image|favicon.ico|sw.js|invite-hash-bootstrap.js|manifest.webmanifest|offline.html|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
