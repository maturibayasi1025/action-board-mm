import { resolveSupabasePublicCredentials } from "@/lib/env";
import type { Database } from "@/lib/types/supabase";
import { createServerClient } from "@supabase/ssr";
import { createClient as createClientSupabase } from "@supabase/supabase-js";

export const createServiceClient = async () => {
  const { url: supabaseUrl } = resolveSupabasePublicCredentials(undefined, {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
  });
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error("Supabase service role environment variables are required");
  }
  return createClientSupabase<Database>(supabaseUrl, supabaseServiceRoleKey);
};

export const createClient = async () => {
  const { url: supabaseUrl, anonKey: supabaseAnonKey } =
    resolveSupabasePublicCredentials(undefined, {
      url: process.env.NEXT_PUBLIC_SUPABASE_URL,
      anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    });

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("Supabase public environment variables are missing");
    return createClientSupabase<Database>(
      "https://dummy.supabase.co",
      "dummy-key",
    );
  }

  try {
    const { cookies } = await import("next/headers");
    const cookieStore = await cookies();

    return createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Server Component からの呼び出し時は cookie 設定をスキップ
          }
        },
      },
      global: {
        headers: {
          "X-Client-Info": "cloudflare-pages",
        },
      },
    });
  } catch {
    return createClientSupabase<Database>(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: {
        headers: {
          "X-Client-Info": "cloudflare-pages-fallback",
        },
      },
    });
  }
};

/** ナビ等の共通レイアウト用。認証確認に失敗してもページ全体を落とさない */
export async function getCurrentUserSafe() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user;
  } catch (error) {
    console.error("Failed to get current user", error);
    return null;
  }
}
