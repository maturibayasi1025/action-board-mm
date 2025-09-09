"use server";

import type { Database } from "@/lib/types/supabase";
import { createServerClient } from "@supabase/ssr";
import { createClient as createClientSupabase } from "@supabase/supabase-js";
import { checkSupabaseEnvVars } from "./check-env-vars";

import { cookies } from "next/headers";

// サービスロールでの操作を行うクライアントです。
// RLSが無効になりますのでご注意ください。
export const createServiceClient = async () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // ビルド時には環境変数が存在しない場合があるため、フォールバック処理を追加
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    console.warn(
      "Supabase service environment variables not found, using fallback values",
    );
    // ビルド時のエラーを回避するためのダミー値
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
  if (process.env.CF_PAGES) {
    console.log("[CF_PAGES] 環境変数チェック:", {
      NODE_ENV: process.env.NODE_ENV,
      CF_PAGES: process.env.CF_PAGES,
      hasSupabaseUrl: !!supabaseUrl,
      hasSupabaseAnonKey: !!supabaseAnonKey,
      supabaseUrlLength: supabaseUrl?.length || 0,
      supabaseAnonKeyLength: supabaseAnonKey?.length || 0,
    });
  }

  // 本番環境では環境変数の存在をチェック（Cloudflare Pagesは緩い検証）
  if (process.env.NODE_ENV === "production" && !process.env.CF_PAGES) {
    if (!checkSupabaseEnvVars()) {
      throw new Error(
        "Required Supabase environment variables are missing in production",
      );
    }
  }

  // 環境変数が存在しない場合の処理
  if (!supabaseUrl || !supabaseAnonKey) {
    const errorMessage = `Supabase環境変数が見つかりません: URL=${!!supabaseUrl}, ANON_KEY=${!!supabaseAnonKey}`;

    // Cloudflare Pages環境では詳細エラーを出力
    if (process.env.CF_PAGES) {
      console.error("[CF_PAGES] 環境変数エラー:", {
        supabaseUrl: supabaseUrl ? "設定済み" : "未設定",
        supabaseAnonKey: supabaseAnonKey ? "設定済み" : "未設定",
        allEnvVars: Object.keys(process.env).filter(
          (key) => key.includes("SUPABASE") || key.includes("NEXT_PUBLIC"),
        ),
      });
      throw new Error(`[Cloudflare] ${errorMessage}`);
    }

    // 開発環境ではフォールバック処理を使用
    console.warn(
      "Supabase environment variables not found, using fallback values",
    );
    // ビルド時のエラーを回避するためのダミー値
    return createServerClient<Database>(
      "https://dummy.supabase.co",
      "dummy-key",
      {
        cookies: {
          async getAll() {
            return [];
          },
          async setAll() {
            // 何もしない
          },
        },
      },
    );
  }

  return createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      async getAll() {
        const cookieStore = await cookies();
        return cookieStore.getAll();
      },
      async setAll(cookiesToSet) {
        try {
          const cookieStore = await cookies();
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch (error) {
          // The `set` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing
          // user sessions.
        }
      },
    },
  });
};
