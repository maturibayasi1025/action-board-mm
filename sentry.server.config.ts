/**
 * Sentry Server Configuration
 * Cloudflare Pages互換のためのダミー設定
 */

// Cloudflare Pages環境では何もしない
if (process.env.CF_PAGES === "true" || process.env.DISABLE_SENTRY === "true") {
  // No-op
} else if (process.env.NEXT_RUNTIME === "nodejs") {
  // サーバーサイドでSentryが必要な場合の設定
  import("./sentry.setup").then(({ initSentryServer }) => {
    initSentryServer().catch(console.error);
  });
}

export {};
