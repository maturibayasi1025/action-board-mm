/**
 * Sentry Client Configuration
 * Cloudflare Pages互換のためのダミー設定
 */

// Cloudflare Pages環境では何もしない
if (process.env.CF_PAGES === "true" || process.env.DISABLE_SENTRY === "true") {
  // No-op
} else if (typeof window !== "undefined") {
  // クライアントサイドでSentryが必要な場合の設定
  import("./sentry.setup").then(({ initSentryClient }) => {
    initSentryClient().catch(console.error);
  });
}

export {};
