import { parseAuthCallbackTokens } from "@/lib/auth/parse-auth-hash-tokens";
import { createClient } from "@/lib/supabase/client";

export async function recoverInviteSessionFromLocation(): Promise<
  "recovered" | "none" | "error"
> {
  const tokens = parseAuthCallbackTokens(
    window.location.hash,
    window.location.search,
  );
  if (!tokens) {
    return "none";
  }

  const supabase = createClient();
  const { error } = await supabase.auth.setSession(tokens);
  if (error) {
    return "error";
  }
  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    return "error";
  }
  return "recovered";
}
