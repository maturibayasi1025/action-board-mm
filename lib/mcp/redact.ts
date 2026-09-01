export const FORBIDDEN_OUTPUT_KEYS = [
  "date_of_birth",
  "hubspot_contact_id",
  "slack_user_id",
  "email",
  "token_hash",
  "referral_code",
] as const;

export type StripForbiddenOptions = {
  allowSlackUserId?: boolean;
};

function forbiddenKeySet(options?: StripForbiddenOptions): Set<string> {
  const keys = new Set<string>(FORBIDDEN_OUTPUT_KEYS);
  if (options?.allowSlackUserId) {
    keys.delete("slack_user_id");
  }
  return keys;
}

export function pickAllowlisted<T extends Record<string, unknown>>(
  row: T,
  keys: readonly string[],
  options?: StripForbiddenOptions,
): Record<string, unknown> {
  const allow = new Set(keys);
  const forbidden = forbiddenKeySet(options);
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (allow.has(key) && !forbidden.has(key)) {
      out[key] = value;
    }
  }
  return out;
}

export function stripForbiddenKeys(
  value: unknown,
  options?: StripForbiddenOptions,
): unknown {
  const forbidden = forbiddenKeySet(options);
  return stripWithSet(value, forbidden);
}

function stripWithSet(value: unknown, forbidden: Set<string>): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => stripWithSet(item, forbidden));
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value)) {
      if (forbidden.has(key)) {
        continue;
      }
      out[key] = stripWithSet(nested, forbidden);
    }
    return out;
  }
  return value;
}
