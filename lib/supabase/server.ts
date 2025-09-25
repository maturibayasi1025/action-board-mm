// "use server"を削除 - utilityファイルには不要

import type { Database } from "@/lib/types/supabase";
import { createServerClient } from "@supabase/ssr";
import { createClient as createClientSupabase } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { checkSupabaseEnvVars } from "./check-env-vars";

// サービスロールでの操作を行うクライアントです。
// RLSが無効になりますのでご注意ください。
export const createServiceClient = async () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

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
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

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
    if (process.env.NODE_ENV !== "production") {
      console.warn("Using fallback Supabase client for development");
      return createClientSupabase<Database>(
        "https://dummy.supabase.co",
        "dummy-key",
      );
    }

    throw new Error(errorMessage);
  }

  // Cloudflare Edge環境用の簡略化されたクライアント
  if (process.env.CF_PAGES === "true") {
    console.log("[CF_PAGES] Edge環境用Supabaseクライアントを作成");

    // Edge環境ではシンプルなクライアントを使用（cookies無し）
    return createClientSupabase<Database>(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: {
        headers: {
          "X-Client-Info": "cloudflare-pages",
        },
      },
    });
  }

  // 通常のNext.js環境（Vercelなど）
  try {
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
    // cookiesが使えない環境の場合
    console.warn("Cookies not available, using simple client");

    return createClientSupabase<Database>(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }
};
