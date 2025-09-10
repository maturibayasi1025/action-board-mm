import type { Database } from "@/lib/types/supabase";
import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

export const updateSession = async (request: NextRequest) => {
  try {
    // Cloudflare Pages環境での環境変数チェック
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      console.warn(
        "[Middleware] Supabase environment variables not configured",
      );
      return NextResponse.next({
        request: {
          headers: request.headers,
        },
      });
    }

    // Create an unmodified response
    let response = NextResponse.next({
      request: {
        headers: request.headers,
      },
    });

    const supabase = createServerClient<Database>(
      supabaseUrl,
      supabaseAnonKey,
      {
        cookies: {
          getAll() {
            try {
              return request.cookies.getAll();
            } catch (error) {
              console.warn("[Middleware] Cookie access error:", error);
              return [];
            }
          },
          setAll(cookiesToSet) {
            try {
              for (const { name, value } of cookiesToSet) {
                request.cookies.set(name, value);
              }
              response = NextResponse.next({
                request,
              });
              for (const { name, value, options } of cookiesToSet) {
                response.cookies.set(name, value, options);
              }
            } catch (error) {
              console.warn("[Middleware] Cookie setting error:", error);
            }
          },
        },
      },
    );

    // This will refresh session if expired - required for Server Components
    // https://supabase.com/docs/guides/auth/server-side/nextjs
    try {
      const user = await supabase.auth.getUser();

      // protected routes
      if (request.nextUrl.pathname.startsWith("/protected") && user.error) {
        return NextResponse.redirect(new URL("/sign-in", request.url));
      }
    } catch (authError) {
      console.warn("[Middleware] Auth check error:", authError);
      // 認証エラーは無視して続行
    }

    return response;
  } catch (e) {
    console.warn("[Middleware] General error:", e);
    // エラーが発生してもアプリケーションを継続
    return NextResponse.next({
      request: {
        headers: request.headers,
      },
    });
  }
};
