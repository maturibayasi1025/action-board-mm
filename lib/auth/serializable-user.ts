import type { User } from "@supabase/supabase-js";

/**
 * Server Components から Client に渡す Supabase User の最小形。
 * 生の `User` にはシリアライズできないプロパティが含まれる場合がある。
 */
export type SerializableAuthUser = Pick<User, "id" | "email">;

export function toSerializableAuthUser(
  user: User | null,
): SerializableAuthUser | null {
  if (!user) return null;
  return { id: user.id, email: user.email ?? null };
}
