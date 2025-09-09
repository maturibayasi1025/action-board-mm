/**
 * Next.js Instrumentation Hook
 * サーバー起動時に1度だけ実行される
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

import { initSentryServer } from "./sentry.setup";

export async function register() {
  // Node.jsランタイムでのみ実行
  if (process.env.NEXT_RUNTIME === "nodejs") {
    console.log("[Instrumentation] Initializing server-side monitoring...");

    // Cloudflare Pages環境でのPrisma instrumentationエラー対策
    if (process.env.CF_PAGES === "true") {
      console.log(
        "[Instrumentation] Cloudflare Pages環境 - Prisma instrumentationを無効化",
      );

      // 環境変数でPrismaのinstrumentationを無効化
      process.env.PRISMA_DISABLE_INSTRUMENTATION = "true";
      process.env.OPENTELEMETRY_INSTRUMENTATION_DISABLED = "true";
      process.env.OTEL_SDK_DISABLED = "true";
    }

    // Sentryの初期化（有効な場合のみ）
    if (
      process.env.NEXT_PUBLIC_SENTRY_DSN &&
      process.env.DISABLE_SENTRY !== "true"
    ) {
      await initSentryServer();
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
