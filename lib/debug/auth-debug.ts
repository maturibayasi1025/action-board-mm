"use client";

// Cloudflare Pages環境での認証デバッグ用ユーティリティ

export const logAuthDebug = (message: string, data?: unknown) => {
  if (process.env.NODE_ENV === "production") {
    // 本番環境でもコンソールログを出力（Cloudflare Pagesでデバッグ用）
    console.log(`[Auth Debug] ${message}`, data);
  }
};

export const logSupabaseConfig = () => {
  const config = {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      ? `${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.substring(0, 20)}...`
      : "Not found",
    nodeEnv: process.env.NODE_ENV,
  };

  logAuthDebug("Supabase Configuration:", config);

  // カスタムロガーにも送信
  if (typeof window !== "undefined") {
    fetch("/api/logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        timestamp: new Date().toISOString(),
        message: "Supabase Config Debug",
        level: "info",
        context: {
          supabaseUrl: config.url,
          hasAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
          nodeEnv: config.nodeEnv,
          userAgent: navigator.userAgent,
        },
      }),
    }).catch(console.error);
  }

  return config;
};

export const testSupabaseConnection = async () => {
  try {
    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();

    logAuthDebug("Testing Supabase connection...");

    // 簡単なAPIコールでテスト
    const { data, error } = await supabase
      .from("missions")
      .select("count")
      .limit(1);

    if (error) {
      logAuthDebug("Supabase connection test failed:", error);
      return { success: false, error };
    }
    logAuthDebug("Supabase connection test passed:", data);
    return { success: true, data };
  } catch (error) {
    logAuthDebug("Supabase connection test error:", error);
    return { success: false, error };
  }
};
