export async function register() {
  // Sentryが無効化されている場合は何もしない
  if (process.env.DISABLE_SENTRY === "true") {
    return;
  }

  // 動的インポートでSentryを読み込み
  const Sentry = await import("@sentry/nextjs");

  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export const onRequestError =
  process.env.DISABLE_SENTRY === "true"
    ? undefined
    : async (
        error: Error | unknown,
        request: Request,
        context?: { tags?: Record<string, string> },
      ): Promise<void> => {
        const Sentry = await import("@sentry/nextjs");
        return Sentry.captureRequestError(error, request, context);
      };
