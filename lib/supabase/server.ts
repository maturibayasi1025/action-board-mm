"use server";

import type { Database } from "@/lib/types/supabase";
import { createServerClient } from "@supabase/ssr";
import { createClient as createClientSupabase } from "@supabase/supabase-js";

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

  // ビルド時には環境変数が存在しない場合があるため、フォールバック処理を追加
  if (!supabaseUrl || !supabaseAnonKey) {
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
