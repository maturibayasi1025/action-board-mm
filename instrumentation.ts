/**
 * Next.js Instrumentation Hook
 * サーバー起動時に1度だけ実行される
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  // Cloudflare Pages環境ではinstrumentationを完全にスキップ
  if (process.env.CF_PAGES === "true") {
    console.log(
      "[Instrumentation] Cloudflare Pages環境 - instrumentation無効化",
    );
    return;
  }

  // Node.jsランタイムでのみ実行（Cloudflare Pages以外）
  if (process.env.NEXT_RUNTIME === "nodejs") {
    console.log("[Instrumentation] Initializing server-side monitoring...");

    // Sentryの初期化（有効な場合のみ）
    if (
      process.env.NEXT_PUBLIC_SENTRY_DSN &&
      process.env.DISABLE_SENTRY !== "true"
    ) {
      try {
        const { initSentryServer } = await import("./sentry.setup");
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
  // Cloudflare Pages環境ではエラーハンドリングをスキップ
  if (process.env.CF_PAGES === "true") {
    console.error("[Request Error]", error);
    return;
  }

  // カスタムロガーでエラーを記録（Cloudflare Pages以外）
  try {
    const { logger } = await import("./lib/logger");
    await logger.log(error, {
      url: request.url,
      method: request.method,
      renderSource: context.renderSource,
      type: "request-error",
    });
  } catch {
    // ロガーが利用できない場合はコンソールログ
    console.error("[Request Error]", error);
  }

  // Sentryが有効な場合は通知（Cloudflare Pages以外）
  if (
    process.env.NEXT_RUNTIME === "nodejs" &&
    process.env.NEXT_PUBLIC_SENTRY_DSN &&
    process.env.DISABLE_SENTRY !== "true"
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
