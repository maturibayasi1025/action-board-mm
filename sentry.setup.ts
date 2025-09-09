/**
 * Sentryの最小構成セットアップ
 * Next.js 15 + Edge Runtime互換性を重視
 *
 * 使用方法:
 * 1. npm install @sentry/nextjs@latest
 * 2. 環境変数にNEXT_PUBLIC_SENTRY_DSNを設定
 * 3. instrumentation.tsで初期化
 */

// 最小構成のオプション
export const getSentryConfig = () => {
  const isDevelopment = process.env.NODE_ENV === "development";
  const isProduction = process.env.NODE_ENV === "production";
  const isEdgeRuntime = process.env.NEXT_RUNTIME === "edge";

  // DSNが存在するかチェック
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn || dsn === "your-project-dsn") {
    console.log("[Sentry] DSN not configured");
    return { enabled: false };
  }

  // Edge RuntimeではSentryを無効化
  if (isEdgeRuntime) {
    console.log("[Sentry] Disabled for Edge Runtime");
    return { enabled: false };
  }

  // 明示的に無効化されている場合
  if (
    process.env.DISABLE_SENTRY === "true" ||
    process.env.NEXT_PUBLIC_DISABLE_SENTRY === "true"
  ) {
    console.log("[Sentry] Explicitly disabled");
    return { enabled: false };
  }

  return {
    dsn,

    // 開発環境でも有効化（テスト目的）
    enabled: true,

    // 環境設定
    environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || "development",

    // サンプリングレート（パフォーマンスを考慮）
    tracesSampleRate: isProduction ? 0.1 : 1.0,

    // セッショントラッキングを無効化（Server Componentsとの互換性）
    autoSessionTracking: false,

    // Replay機能とPrisma integrationを無効化
    integrations: (integrations: { name: string }[]) => {
      // Replay、ProfilingIntegration、Prisma等を除外
      return integrations.filter((integration) => {
        const name = integration.name;
        return ![
          "Replay",
          "ReplayCanvas",
          "ProfilingIntegration",
          "BrowserTracing",
          "Prisma",
          "PrismaIntegration",
          "prismaIntegration",
        ].includes(name);
      });
    },

    // Prisma instrumentationを無効化
    skipOpenTelemetrySetup: true,

    // エラーフィルタリング
    // biome-ignore lint/suspicious/noExplicitAny: Sentryの型定義との互換性のためanyが必要
    beforeSend(event: any, hint: any): any {
      // 開発環境ではエラーを送信しない
      if (isDevelopment) {
        console.log("[Sentry] Development mode - not sending:", event);
        return null;
      }

      // Next.jsの内部エラーを除外
      if (event?.exception?.values?.[0]?.value?.includes("NEXT_NOT_FOUND")) {
        return null;
      }

      // 404エラーを除外
      if (event?.exception?.values?.[0]?.value?.includes("404")) {
        return null;
      }

      return event;
    },

    // デバッグモード
    debug: isDevelopment && process.env.SENTRY_DEBUG === "true",

    // パフォーマンスの最適化
    attachStacktrace: false,
    normalizeDepth: 3,
  };
};

// Serverサイド初期化用
export async function initSentryServer() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    try {
      const Sentry = await import("@sentry/nextjs");
      const config = getSentryConfig();

      if (config.enabled !== false) {
        Sentry.init(config);
        console.log("[Sentry] Server-side initialized");
      } else {
        console.log("[Sentry] Disabled");
      }
    } catch (error) {
      console.error("[Sentry] Failed to initialize:", error);
    }
  }
}

// Clientサイド初期化用
export async function initSentryClient() {
  if (
    typeof window !== "undefined" &&
    process.env.NEXT_PUBLIC_DISABLE_SENTRY !== "true"
  ) {
    try {
      const Sentry = await import("@sentry/nextjs");
      const config = getSentryConfig();

      if (config.enabled !== false) {
        Sentry.init({
          ...config,
          // クライアント固有の設定
          transport: Sentry.makeFetchTransport,
        });
        console.log("[Sentry] Client-side initialized");
      }
    } catch (error) {
      console.error("[Sentry] Client initialization failed:", error);
    }
  }
}
