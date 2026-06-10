import { getPublicEnv } from "@/lib/env";
import type { Database } from "@/lib/types/supabase";
import { createBrowserClient } from "@supabase/ssr";

export const createClient = () => {
  const env = getPublicEnv();
  return createBrowserClient<Database>(env.supabaseUrl, env.supabaseAnonKey);
};
