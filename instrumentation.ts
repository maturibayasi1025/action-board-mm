/**
 * Next.js Instrumentation Hook
 * サーバー起動時に1度だけ実行される
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

import { initSentryServer } from "./sentry.setup";

export async function register() {
  // 最初にPrisma関連の環境変数を設定（Cloudflare Pages環境のみ）
  if (process.env.CF_PAGES === "true") {
    // Prismaとopentelemetryを完全に無効化
    process.env.PRISMA_DISABLE_INSTRUMENTATION = "true";
    process.env.OPENTELEMETRY_INSTRUMENTATION_DISABLED = "true";
    process.env.OTEL_SDK_DISABLED = "true";
    process.env.PRISMA_HIDE_UPDATE_MESSAGE = "true";
    process.env.PRISMA_CLIENT_ENGAGEMENT_TIMEOUT = "0";

    // OpenTelemetryのinstrumentationモジュールを無効化
    if (typeof globalThis !== "undefined") {
      (globalThis as any).__DISABLE_INSTRUMENTATION__ = true;
    }
  }

  // Node.jsランタイムでのみ実行
  if (process.env.NEXT_RUNTIME === "nodejs") {
    console.log("[Instrumentation] Initializing server-side monitoring...");

    // Cloudflare Pages環境でのログ
    if (process.env.CF_PAGES === "true") {
      console.log(
        "[Instrumentation] Cloudflare Pages環境 - Prisma/OpenTelemetry instrumentationを無効化済み",
      );
    }

    // Sentryの初期化（有効な場合のみ、かつCloudflare Pages以外）
    if (
      process.env.NEXT_PUBLIC_SENTRY_DSN &&
      process.env.DISABLE_SENTRY !== "true" &&
      process.env.CF_PAGES !== "true"
    ) {
      try {
        await initSentryServer();
      } catch (error) {
        console.error("[Instrumentation] Sentry初期化エラー:", error);
      }
    } else {
      console.log("[Instrumentation] Sentry is disabled");
    }

    // その他のサーバーサイド初期化処理
    // 例: データベース接続、キャッシュ初期化など
  }

  // Edge Runtimeでの初期化
  if (process.env.NEXT_RUNTIME === "edge") {
    console.log(
      "[Instrumentation] Edge runtime detected - monitoring disabled",
    );
    // Edge RuntimeではSentryを使用しない
  }
}

// オプション: experimental.instrumentationHookを使用する場合
export const onRequestError = async (
  error: Error,
  request: Request,
  context: { renderSource: string },
) => {
  // カスタムロガーでエラーを記録
  const { logger } = await import("./lib/logger");

  await logger.log(error, {
    url: request.url,
    method: request.method,
    renderSource: context.renderSource,
    type: "request-error",
  });

  // Sentryが有効な場合は通知
  if (
    process.env.NEXT_RUNTIME === "nodejs" &&
    process.env.NEXT_PUBLIC_SENTRY_DSN
  ) {
    try {
      const Sentry = await import("@sentry/nextjs");
      Sentry.captureException(error, {
        extra: {
          url: request.url,
          method: request.method,
          renderSource: context.renderSource,
        },
      });
    } catch {
      // Sentryが利用できない場合はスキップ
    }
  }
};
