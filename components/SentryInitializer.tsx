"use client";

export function SentryInitializer() {
  // Cloudflare Pages環境ではSentry初期化をスキップ
  if (
    process.env.NEXT_PUBLIC_CLOUDFLARE_PAGES === "true" ||
    process.env.NEXT_PUBLIC_DISABLE_SENTRY === "true"
  ) {
    return null;
  }

  // 通常環境でのみSentryを初期化
  try {
    import("@/lib/sentry/client")
      .then(({ useSentry }) => {
        // この時点でReactフックは使用できないため、直接初期化
        import("@/lib/sentry/client").then(({ initSentryClient }) => {
          initSentryClient();
        });
      })
      .catch(() => {
        // Sentryが利用できない場合は静かに失敗
      });
  } catch {
    // エラーを無視
  }

  return null; // このコンポーネントは何も描画しない
}
