"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

let isInitialized = false;

export function initSentryClient() {
  if (typeof window === "undefined" || isInitialized) {
    return;
  }

  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  const disabled = process.env.NEXT_PUBLIC_DISABLE_SENTRY === "true";

  if (!dsn || dsn === "your-project-dsn" || disabled) {
    console.log("[Sentry Client] Disabled or DSN not configured");
    return;
  }

  try {
    Sentry.init({
      dsn,
      environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || "development",

      // デバッグモード（開発環境のみ）
      debug: process.env.NODE_ENV === "development",

      // サンプリングレート
      tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

      // 最小構成（統合機能なし）
      integrations: [],

      // エラーフィルタリング
      beforeSend(event) {
        // 開発環境では詳細ログを表示
        if (process.env.NODE_ENV === "development") {
          console.log("[Sentry Client] Sending error:", event);
        }

        // 特定のエラーを除外
        if (
          event.exception?.values?.[0]?.value?.includes(
            "Non-Error promise rejection",
          )
        ) {
          return null;
        }

        return event;
      },
    });

    isInitialized = true;
    console.log("[Sentry Client] Initialized successfully");
  } catch (error) {
    console.error("[Sentry Client] Initialization failed:", error);
  }
}

// React Hook for Sentry initialization
export function useSentry() {
  useEffect(() => {
    initSentryClient();
  }, []);
}

// Utility function to capture errors manually
export function captureError(error: Error, context?: Record<string, unknown>) {
  if (typeof window === "undefined") return;

  try {
    Sentry.captureException(error, {
      extra: context,
      tags: {
        source: "manual-capture",
      },
    });
  } catch (sentryError) {
    console.error("[Sentry Client] Failed to capture error:", sentryError);
    // フォールバックとしてカスタムロガーを使用
    import("../logger").then(({ logger }) => {
      logger.log(error, context);
    });
  }
}

// Test function for Sentry
export function testSentry() {
  if (typeof window === "undefined") return;

  console.log("[Sentry Client] Testing error capture...");

  try {
    throw new Error(
      `Sentry test error from client: ${new Date().toISOString()}`,
    );
  } catch (error) {
    captureError(error as Error, {
      test: true,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
    });
  }
}
