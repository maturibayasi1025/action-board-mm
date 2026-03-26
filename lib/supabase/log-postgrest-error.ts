import type { PostgrestError } from "@supabase/supabase-js";

/** サーバーアクションで Postgrest エラーを調査しやすい形でログする */
export function logPostgrestError(
  context: string,
  error: PostgrestError,
  extra?: Record<string, unknown>,
): void {
  console.error(`[${context}]`, {
    code: error.code,
    message: error.message,
    details: error.details,
    hint: error.hint,
    ...extra,
  });
}
