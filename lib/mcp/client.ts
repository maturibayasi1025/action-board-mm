import type { Database } from "@/lib/types/supabase";
import { type SupabaseClient, createClient } from "@supabase/supabase-js";

export type McpDb = SupabaseClient<Database>;

export function createMcpDb(): McpDb {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase environment variables are required for MCP");
  }
  return createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        "X-Client-Info": "action-board-mcp",
      },
    },
  });
}
