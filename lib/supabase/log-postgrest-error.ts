import type { PostgrestError } from "@supabase/supabase-js";

/** サーバーアクションで Postgrest エラーを調査しやすい形でログする */
export function logPostgrestError(
  context: string,
  error: PostgrestError,
  extra?: Record<string, unknown>,
): void {
  const payload = {
    code: error.code,
    message: error.message,
    details: error.details,
    hint: error.hint,
    ...extra,
  };
  console.error(`[${context}]`, payload);

  if (typeof window !== "undefined") {
    return;
  }
  void import("@sentry/nextjs")
    .then((Sentry) => {
      Sentry.captureMessage(`[${context}] ${error.message}`, {
        level: "error",
        extra: payload,
        tags: { source: "postgrest" },
      });
    })
    .catch(() => {});
}
