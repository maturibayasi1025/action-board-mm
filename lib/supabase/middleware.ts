import { getPublicEnv } from "@/lib/env";
import type { Database } from "@/lib/types/supabase";
import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

export const updateSession = async (request: NextRequest) => {
  // This `try/catch` block is only here for the interactive tutorial.
  // Feel free to remove once you have Supabase connected.
  try {
    // Create an unmodified response
    let response = NextResponse.next({
      request: {
        headers: request.headers,
      },
    });

    const env = getPublicEnv();
    const supabase = createServerClient<Database>(
      env.supabaseUrl,
      env.supabaseAnonKey,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            for (const { name, value } of cookiesToSet) {
              request.cookies.set(name, value);
            }
            response = NextResponse.next({
              request,
            });
            for (const { name, value, options } of cookiesToSet) {
              response.cookies.set(name, value, options);
            }
          },
        },
      },
    );

    // This will refresh session if expired - required for Server Components
    // https://supabase.com/docs/guides/auth/server-side/nextjs
    const user = await supabase.auth.getUser();

    // protected routes
    if (request.nextUrl.pathname.startsWith("/protected") && user.error) {
      return NextResponse.redirect(new URL("/sign-in", request.url));
    }

    const authUser = user.data.user;
    if (authUser) {
      const { data: profile } = await supabase
        .from("private_users")
        .select("suspended_at")
        .eq("id", authUser.id)
        .maybeSingle();
      if (profile?.suspended_at) {
        await supabase.auth.signOut();
        if (request.nextUrl.pathname.startsWith("/sign-in")) {
          return response;
        }
        const url = request.nextUrl.clone();
        url.pathname = "/sign-in";
        url.search = "";
        url.searchParams.set("error", "suspended");
        const redirectResponse = NextResponse.redirect(url);
        for (const cookie of response.cookies.getAll()) {
          redirectResponse.cookies.set(cookie);
        }
        return redirectResponse;
      }
    }

    return response;
  } catch (e) {
    // If you are here, a Supabase client could not be created!
    // This is likely because you have not set up environment variables.
    // Check out http://localhost:3000 for Next Steps.
    return NextResponse.next({
      request: {
        headers: request.headers,
      },
    });
  }
};
