import { getPublicEnv } from "@/lib/env";
import type { Database } from "@/lib/types/supabase";
import { createServerClient } from "@supabase/ssr";
import { createClient as createClientSupabase } from "@supabase/supabase-js";

export const createServiceClient = async () => {
  const { supabaseUrl } = getPublicEnv();
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error("Supabase service role environment variables are required");
  }
  return createClientSupabase<Database>(supabaseUrl, supabaseServiceRoleKey);
};

export const createClient = async () => {
  const { supabaseUrl, supabaseAnonKey } = getPublicEnv();

  if (!supabaseUrl || !supabaseAnonKey) {
    if (process.env.NODE_ENV !== "production") {
      return createClientSupabase<Database>(
        "https://dummy.supabase.co",
        "dummy-key",
      );
    }
    throw new Error("Supabase environment variables are required");
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
