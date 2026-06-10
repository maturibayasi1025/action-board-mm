// "use server"を削除 - utilityファイルには不要

import { getEnv } from "@/lib/env";
import type { Database } from "@/lib/types/supabase";
import { createServerClient } from "@supabase/ssr";
import { createClient as createClientSupabase } from "@supabase/supabase-js";

// サービスロールでの操作を行うクライアントです。
// RLSが無効になりますのでご注意ください。
export const createServiceClient = async () => {
  const env = getEnv();
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    console.warn(
      "Supabase service environment variables not found, using fallback values",
    );
    return createClientSupabase<Database>(
      "https://dummy.supabase.co",
      "dummy-key",
    );
  }
  return createClientSupabase<Database>(supabaseUrl, supabaseServiceRoleKey);
};

export const createClient = async () => {
  const env = getEnv();
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Cloudflare Pages環境での詳細なログ出力
  if (process.env.CF_PAGES === "true") {
    console.log("[CF_PAGES] Supabaseクライアント作成開始:", {
      hasUrl: !!supabaseUrl,
      hasKey: !!supabaseAnonKey,
    });
  }

  // 環境変数チェック
  if (!supabaseUrl || !supabaseAnonKey) {
    const errorMessage = "Supabase環境変数が見つかりません";

    if (process.env.CF_PAGES === "true") {
      console.error("[CF_PAGES] 環境変数エラー:", errorMessage);
    }

    // 開発/ビルド時のフォールバック
    if (env.NODE_ENV !== "production") {
      console.warn("Using fallback Supabase client for development");
      return createClientSupabase<Database>(
        "https://dummy.supabase.co",
        "dummy-key",
      );
    }

    throw new Error(errorMessage);
  }

  // Cloudflare Pages環境でもセッション管理を試行
  if (process.env.CF_PAGES === "true") {
    console.log("[CF_PAGES] Edge環境用Supabaseクライアントを作成");

    try {
      // Edge Runtime環境では cookies を dynamic import
      const { cookies } = await import("next/headers");
      const cookieStore = await cookies();

      console.log("[CF_PAGES] Cookiesを使用したクライアントを作成");
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
            } catch (error) {
              console.warn("[CF_PAGES] Cookie設定をスキップ:", error);
            }
          },
        },
        global: {
          headers: {
            "X-Client-Info": "cloudflare-pages",
          },
        },
      });
    } catch (error) {
      console.warn(
        "[CF_PAGES] Cookiesが利用できないため、シンプルクライアントを使用",
      );
      // フォールバック: シンプルクライアント（セッション管理無し）
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
  }

  // 通常のNext.js環境（Vercelなど）
  try {
    // Edge Runtime環境では cookies を dynamic import
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
          } catch (error) {
            // Server Componentからの呼び出しの場合は無視
            console.warn("Cookie setting skipped in Server Component");
          }
        },
      },
    });
  } catch (error) {
    // Edge Runtime環境やcookiesが使えない環境の場合
    console.warn("Cookies not available, using simple client");

    return createClientSupabase<Database>(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }
};
