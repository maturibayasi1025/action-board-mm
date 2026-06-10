/**
 * Next.js Instrumentation Hook
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

import { initSentryServer } from "./sentry.setup";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    process.env.PRISMA_DISABLE_INSTRUMENTATION = "true";
    process.env.OPENTELEMETRY_INSTRUMENTATION_DISABLED = "true";
    process.env.OTEL_SDK_DISABLED = "true";

    if (
      process.env.NEXT_PUBLIC_SENTRY_DSN &&
      process.env.DISABLE_SENTRY !== "true"
    ) {
      await initSentryServer();
    }
  }
}

export const onRequestError = async (
  error: Error,
  request: Request,
  context: { renderSource: string },
) => {
  const { logger } = await import("./lib/logger");

  await logger.log(error, {
    url: request.url,
    method: request.method,
    renderSource: context.renderSource,
    type: "request-error",
  });

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
      // Sentry unavailable
    }
  }
};
