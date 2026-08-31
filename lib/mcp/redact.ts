export const FORBIDDEN_OUTPUT_KEYS = [
  "date_of_birth",
  "hubspot_contact_id",
  "slack_user_id",
  "email",
  "token_hash",
  "referral_code",
] as const;

const FORBIDDEN_KEY_SET = new Set<string>(FORBIDDEN_OUTPUT_KEYS);

export function pickAllowlisted<T extends Record<string, unknown>>(
  row: T,
  keys: readonly string[],
): Record<string, unknown> {
  const allow = new Set(keys);
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (allow.has(key) && !FORBIDDEN_KEY_SET.has(key)) {
      out[key] = value;
    }
  }
  return out;
}

export function stripForbiddenKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stripForbiddenKeys);
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value)) {
      if (FORBIDDEN_KEY_SET.has(key)) {
        continue;
      }
      out[key] = stripForbiddenKeys(nested);
    }
    return out;
  }
  return value;
}
